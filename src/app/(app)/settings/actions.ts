"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireUser } from "@/lib/auth/current-user";
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

/** Domain errors that belong to one form field; the rest show as a form-level error. */
const FIELD_DOMAIN_ERRORS: [new (...args: never[]) => Error, string][] = [
  [DuplicateSlugError, "slug"],
  [DuplicateEmailError, "email"],
];
const DOMAIN_ERRORS = [ProjectNotFoundError, UserNotFoundError, LastAdminError];

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

async function adminRun<T extends object>(targets: RevalidateTarget[], work: () => Promise<T>): Promise<SettingsResult<T>> {
  let value: T;
  try {
    await requireUser("ADMIN");
    value = await work();
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
