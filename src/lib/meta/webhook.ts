import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import type { WebhookStatus } from "@/generated/prisma/enums";
import { getEnv } from "@/lib/env";
import { ingestLead } from "@/lib/leads/ingest";
import { fetchLeadgen } from "./graph";
import { getMetaAccessToken } from "./token";

const PROVIDER = "meta";

/** Constant-time check of `X-Hub-Signature-256: sha256=<hex HMAC of the raw body>`. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type LeadgenChange = { leadgenId: string; pageId: string; formId: string; createdTime: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Every `entry[].changes[]` with `field === "leadgen"`; anything else is ignored. */
export function extractLeadgenIds(body: unknown): LeadgenChange[] {
  if (!isRecord(body) || !Array.isArray(body.entry)) return [];
  const out: LeadgenChange[] = [];
  for (const entry of body.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "leadgen" || !isRecord(change.value)) continue;
      const v = change.value;
      if (v.leadgen_id === undefined || v.leadgen_id === null || v.leadgen_id === "") continue;
      out.push({
        leadgenId: String(v.leadgen_id),
        pageId: String(v.page_id ?? ""),
        formId: String(v.form_id ?? ""),
        createdTime: Number(v.created_time ?? 0),
      });
    }
  }
  return out;
}

/**
 * Claim a RECEIVED event, fetch its lead from the Graph API and ingest it. Returns the row's final status;
 * an event someone else already claimed (or finished) is left alone and its current status returned.
 */
export async function processLeadgen(eventId: string, fetchImpl?: typeof fetch): Promise<WebhookStatus | null> {
  // Claim atomically so a redelivery scheduled before this run finishes cannot process the lead twice.
  const claimed = await db.webhookEvent.updateMany({ where: { id: eventId, status: "RECEIVED" }, data: { status: "PROCESSING" } });
  if (claimed.count === 0) {
    const row = await db.webhookEvent.findUnique({ where: { id: eventId }, select: { status: true } });
    return row?.status ?? null;
  }
  try {
    const { externalId } = await db.webhookEvent.findUniqueOrThrow({ where: { id: eventId }, select: { externalId: true } });
    const token = await getMetaAccessToken();
    if (!token) throw new Error("No Meta access token configured");
    const lead = await fetchLeadgen(externalId, token, fetchImpl);
    await ingestLead(lead);
    await db.webhookEvent.update({ where: { id: eventId }, data: { status: "PROCESSED", processedAt: new Date(), error: null } });
    return "PROCESSED";
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    try {
      await db.webhookEvent.update({ where: { id: eventId }, data: { status: "FAILED", error } });
    } catch (markErr) {
      // Runs inside after(): never let this escape. The row stays PROCESSING and shows as stale in Settings.
      console.error(
        `Meta webhook event ${eventId}: could not mark FAILED (${markErr instanceof Error ? markErr.message : String(markErr)})`,
      );
    }
    return "FAILED";
  }
}

/**
 * Verify, record each leadgen as a WebhookEvent (idempotent on leadgen_id), and schedule the
 * Graph fetch + ingest to run after the response. Unsigned requests are rejected, including
 * when META_APP_SECRET is unset.
 */
export async function handleMetaWebhook(
  rawBody: string,
  signature: string | null,
  deps: { schedule: (fn: () => Promise<void>) => void; fetchImpl?: typeof fetch },
): Promise<{ status: 200 | 401; accepted: number }> {
  const secret = getEnv().META_APP_SECRET;
  if (!secret || !verifyMetaSignature(rawBody, signature, secret)) return { status: 401, accepted: 0 };

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { status: 200, accepted: 0 };
  }

  const changes = extractLeadgenIds(body);
  for (const change of changes) {
    const event = await db.webhookEvent.upsert({
      where: { provider_externalId: { provider: PROVIDER, externalId: change.leadgenId } },
      create: { provider: PROVIDER, externalId: change.leadgenId, raw: change },
      update: {},
    });
    if (event.status === "RECEIVED") {
      deps.schedule(async () => {
        await processLeadgen(event.id, deps.fetchImpl);
      });
    }
  }
  return { status: 200, accepted: changes.length };
}
