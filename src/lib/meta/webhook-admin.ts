import { db } from "@/lib/db";
import type { WebhookStatus } from "@/generated/prisma/enums";
import { processLeadgen } from "./webhook";

/** A PROCESSING row older than this is treated as stuck (its run died before recording an outcome). */
export const STALE_PROCESSING_MS = 15 * 60_000;
export const MAX_RETRY_BATCH = 50;

export type FailedWebhookEvent = {
  id: string;
  externalId: string;
  status: WebhookStatus;
  error: string | null;
  receivedAt: Date;
};

function failedOrStuckWhere(now = Date.now()) {
  return {
    provider: "meta",
    OR: [
      { status: "FAILED" as const },
      { status: "PROCESSING" as const, receivedAt: { lt: new Date(now - STALE_PROCESSING_MS) } },
    ],
  };
}

/** FAILED deliveries plus PROCESSING ones stuck for over 15 minutes, newest first. */
export function listFailedWebhookEvents(limit = 50): Promise<FailedWebhookEvent[]> {
  return db.webhookEvent.findMany({
    where: failedOrStuckWhere(),
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: { id: true, externalId: true, status: true, error: true, receivedAt: true },
  });
}

export class WebhookEventNotFoundError extends Error {
  constructor() {
    super("Webhook event not found");
    this.name = "WebhookEventNotFoundError";
  }
}

export class WebhookEventNotRetryableError extends Error {
  constructor() {
    super("Only failed deliveries can be retried");
    this.name = "WebhookEventNotRetryableError";
  }
}

/**
 * Put a FAILED delivery back to RECEIVED and run it through the same processing as the webhook; returns the row's
 * final status. Only FAILED rows are reset: a PROCESSING row (stale or not) may still be mid-run, and staleness is
 * measured from receivedAt, so resetting it could process the lead twice.
 */
export async function retryWebhookEvent(id: string, fetchImpl?: typeof fetch): Promise<WebhookStatus> {
  const reset = await db.webhookEvent.updateMany({ where: { id, status: "FAILED" }, data: { status: "RECEIVED", error: null } });
  if (reset.count === 0) {
    const exists = await db.webhookEvent.findUnique({ where: { id }, select: { id: true } });
    throw exists ? new WebhookEventNotRetryableError() : new WebhookEventNotFoundError();
  }
  const status = await processLeadgen(id, fetchImpl);
  if (status === null) throw new WebhookEventNotFoundError();
  return status;
}

/** Retry up to MAX_RETRY_BATCH FAILED deliveries one after another; stuck PROCESSING rows are skipped. */
export async function retryAllFailedWebhookEvents(
  fetchImpl?: typeof fetch,
): Promise<{ retried: number; processed: number; failed: number }> {
  const rows = await db.webhookEvent.findMany({
    where: { provider: "meta", status: "FAILED" },
    orderBy: { receivedAt: "desc" },
    take: MAX_RETRY_BATCH,
    select: { id: true },
  });
  let processed = 0;
  let failed = 0;
  let retried = 0;
  for (const row of rows) {
    let status: WebhookStatus;
    try {
      status = await retryWebhookEvent(row.id, fetchImpl);
    } catch (err) {
      // Claimed by a concurrent per-row retry since we listed it: skip rather than reprocess.
      if (err instanceof WebhookEventNotRetryableError || err instanceof WebhookEventNotFoundError) continue;
      throw err;
    }
    retried++;
    if (status === "PROCESSED") processed++;
    else if (status === "FAILED") failed++;
  }
  return { retried, processed, failed };
}
