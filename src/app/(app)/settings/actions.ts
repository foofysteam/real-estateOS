"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireUser, type CurrentUser } from "@/lib/auth/current-user";
import { importLeadsCsv, type CsvImportResult } from "@/lib/csv";
import { db } from "@/lib/db";
import { createIngestKey, revokeIngestKey } from "@/lib/ingest-keys";
import { getMetaGateway, resetMetaGateway } from "@/lib/meta";
import { saveMetaConnection } from "@/lib/meta/connection";
import {
  retryAllFailedWebhookEvents,
  retryWebhookEvent,
  WebhookEventNotFoundError,
} from "@/lib/meta/webhook-admin";
import type { WebhookStatus } from "@/generated/prisma/enums";
import { CSV_IMPORT_SOURCES, INGEST_KEY_SOURCES } from "@/lib/sources";
import { emptyToUndefined } from "@/lib/zod-helpers";
import {
  createProject,
  DuplicateSlugError,
  ProjectNotFoundError,
  setProjectActive,
  updateProject,
  type ProjectInput,
} from "@/lib/projects";
import {
  DuplicateEmailError,
  inviteUser,
  LastAdminError,
  resetPassword,
  setUserActive,
  UserNotFoundError,
  type InviteInput,
} from "@/lib/team";

export type FieldErrors = Record<string, string>;
export type SettingsFailure = { ok: false; error: string; fieldErrors?: FieldErrors };
export type SettingsResult<T extends object = object> = ({ ok: true } & T) | SettingsFailure;

const FIELD_ERROR = "Check the highlighted fields";

/** A readable failure raised by an action itself; its message is shown as-is. */
class ActionError extends Error {}

/** Domain errors that belong to one form field; the rest show as a form-level error. */
const FIELD_DOMAIN_ERRORS: [new (...args: never[]) => Error, string][] = [
  [DuplicateSlugError, "slug"],
  [DuplicateEmailError, "email"],
];
const DOMAIN_ERRORS = [ProjectNotFoundError, UserNotFoundError, LastAdminError, WebhookEventNotFoundError, ActionError];

function fieldErrorsFrom(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function toFailure(err: unknown): SettingsFailure {
  if (err instanceof ForbiddenError) return { ok: false, error: "You don't have permission to do that" };
  if (err instanceof z.ZodError) return { ok: false, error: FIELD_ERROR, fieldErrors: fieldErrorsFrom(err) };
  const field = FIELD_DOMAIN_ERRORS.find(([E]) => err instanceof E);
  if (field) return { ok: false, error: FIELD_ERROR, fieldErrors: { [field[1]]: (err as Error).message } };
  if (DOMAIN_ERRORS.some((E) => err instanceof E)) return { ok: false, error: (err as Error).message };
  throw err;
}

/** ADMIN-gated: validation and domain failures become readable results; anything unexpected still throws. */
type RevalidateTarget = [path: string, type?: "layout" | "page"];

async function adminRun<T extends object>(
  targets: RevalidateTarget[],
  work: (admin: CurrentUser) => Promise<T>,
): Promise<SettingsResult<T>> {
  let value: T;
  try {
    value = await work(await requireUser("ADMIN"));
  } catch (err) {
    return toFailure(err);
  }
  for (const [path, type] of targets) revalidatePath(path, type);
  return { ok: true, ...value };
}

// "/leads" as a layout also covers the lead detail, whose edit sheet lists projects.
const PROJECT_PATHS: RevalidateTarget[] = [["/settings"], ["/leads", "layout"], ["/pipeline"]];
const TEAM_PATHS: RevalidateTarget[] = [["/settings"]];
const id = z.string().min(1).max(64);
const flag = z.boolean();

export async function createProjectAction(input: ProjectInput): Promise<SettingsResult> {
  return adminRun(PROJECT_PATHS, async () => {
    await createProject(input);
    return {};
  });
}

export async function updateProjectAction(projectId: string, input: ProjectInput): Promise<SettingsResult> {
  return adminRun(PROJECT_PATHS, async () => {
    await updateProject(id.parse(projectId), input);
    return {};
  });
}

export async function setProjectActiveAction(projectId: string, active: boolean): Promise<SettingsResult> {
  return adminRun(PROJECT_PATHS, async () => {
    await setProjectActive(id.parse(projectId), flag.parse(active));
    return {};
  });
}

/** Returns the temporary password once; the user record (and its hash) never leaves the server. */
export async function inviteUserAction(input: InviteInput): Promise<SettingsResult<{ temporaryPassword: string }>> {
  return adminRun(TEAM_PATHS, async () => {
    const { temporaryPassword } = await inviteUser(input);
    return { temporaryPassword };
  });
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<SettingsResult> {
  return adminRun(TEAM_PATHS, async () => {
    await setUserActive(id.parse(userId), flag.parse(active));
    return {};
  });
}

export async function resetPasswordAction(userId: string): Promise<SettingsResult<{ temporaryPassword: string }>> {
  return adminRun(TEAM_PATHS, async () => ({ temporaryPassword: await resetPassword(id.parse(userId)) }));
}

// ── Integrations ─────────────────────────────────────────────────────────────

const META_PATHS: RevalidateTarget[] = [["/settings"], ["/ads"]];
const KEY_PATHS: RevalidateTarget[] = [["/settings"]];
const IMPORT_PATHS: RevalidateTarget[] = [["/leads"], ["/pipeline"], ["/today"]];
const MAX_ERROR = 300;
const MAX_CSV_BYTES = 2 * 1024 * 1024;

const metaId = z.string().trim().min(1, "Required").max(64, "64 characters at most");
const metaConnectionSchema = z.object({
  pageId: metaId,
  adAccountId: metaId,
  accessToken: z.preprocess(emptyToUndefined, z.string().max(1024, "Token is too long").optional()),
  mcpUrl: z.preprocess(
    emptyToUndefined,
    z
      .url("Enter a full URL")
      .refine((u) => u.toLowerCase().startsWith("https://"), "MCP URL must use https")
      .optional(),
  ),
});
export type MetaConnectionForm = z.input<typeof metaConnectionSchema>;

/** Saves the connection (a blank token keeps the stored one) and drops the memoised gateway so it picks up the change. */
export async function saveMetaConnectionAction(input: MetaConnectionForm): Promise<SettingsResult> {
  return adminRun(META_PATHS, async () => {
    await saveMetaConnection(metaConnectionSchema.parse(input));
    resetMetaGateway();
    return {};
  });
}

/** Lists the ad account's campaigns as a live check; Meta failures come back as a short readable error. */
export async function testMetaConnectionAction(): Promise<SettingsResult<{ count: number }>> {
  return adminRun([], async () => {
    const conn = await db.metaConnection.findUnique({ where: { id: 1 }, select: { adAccountId: true } });
    if (!conn) throw new ActionError("Save the connection first");
    try {
      const campaigns = await (await getMetaGateway()).listCampaigns(conn.adAccountId);
      return { count: campaigns.length };
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "Meta request failed";
      throw new ActionError(message.slice(0, MAX_ERROR));
    }
  });
}

const WEBHOOK_PATHS: RevalidateTarget[] = [["/settings"], ["/leads"], ["/pipeline"], ["/today"]];

/** Re-run one failed or stuck Meta delivery; `status` is the row's status afterwards. */
export async function retryWebhookEventAction(eventId: string): Promise<SettingsResult<{ status: WebhookStatus }>> {
  return adminRun(WEBHOOK_PATHS, async () => ({ status: await retryWebhookEvent(id.parse(eventId)) }));
}

/** Re-run up to 50 failed or stuck Meta deliveries. */
export async function retryAllFailedAction(): Promise<
  SettingsResult<{ retried: number; processed: number; failed: number }>
> {
  return adminRun(WEBHOOK_PATHS, () => retryAllFailedWebhookEvents());
}

const ingestKeySchema = z.object({
  name: z.string().trim().min(1, "Required").max(80, "80 characters at most"),
  source: z.enum(INGEST_KEY_SOURCES, "Choose a source"),
});

/** Returns the key's plaintext once; only its hash is stored. */
export async function createIngestKeyAction(
  name: string,
  source: (typeof INGEST_KEY_SOURCES)[number],
): Promise<SettingsResult<{ id: string; plaintext: string }>> {
  return adminRun(KEY_PATHS, async () => {
    const input = ingestKeySchema.parse({ name, source });
    return createIngestKey(input.name, input.source);
  });
}

export async function revokeIngestKeyAction(keyId: string): Promise<SettingsResult> {
  return adminRun(KEY_PATHS, async () => {
    await revokeIngestKey(id.parse(keyId));
    return {};
  });
}

// ── Import ───────────────────────────────────────────────────────────────────

const csvSourceSchema = z.object({ source: z.enum(CSV_IMPORT_SOURCES, "Choose a source") });

/** Form action: `file` (≤ 2 MB) and `source`. Row problems come back per line; the import carries on past them. */
export async function importCsvAction(formData: FormData): Promise<SettingsResult<CsvImportResult>> {
  return adminRun(IMPORT_PATHS, async (admin) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Choose a CSV file");
    if (file.size > MAX_CSV_BYTES) throw new ActionError("File too large (max 2 MB)");
    const { source } = csvSourceSchema.parse({ source: formData.get("source") });
    return importLeadsCsv(await file.text(), source, admin.id);
  });
}
