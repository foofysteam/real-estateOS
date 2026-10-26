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

function retryableWhere(now = Date.now()) {
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
    where: retryableWhere(),
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

/**
 * Put a failed (or stale) delivery back to RECEIVED and run it through the same processing as the webhook.
 * Returns the row's final status; a row that is no longer retryable is left alone.
 */
export async function retryWebhookEvent(id: string, fetchImpl?: typeof fetch): Promise<WebhookStatus> {
  await db.webhookEvent.updateMany({ where: { id, ...retryableWhere() }, data: { status: "RECEIVED", error: null } });
  const status = await processLeadgen(id, fetchImpl);
  if (status === null) throw new WebhookEventNotFoundError();
  return status;
}

/** Retry up to MAX_RETRY_BATCH retryable deliveries one after another. */
export async function retryAllFailedWebhookEvents(
  fetchImpl?: typeof fetch,
): Promise<{ retried: number; processed: number; failed: number }> {
  const rows = await listFailedWebhookEvents(MAX_RETRY_BATCH);
  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    const status = await retryWebhookEvent(row.id, fetchImpl);
    if (status === "PROCESSED") processed++;
    else if (status === "FAILED") failed++;
  }
  return { retried: rows.length, processed, failed };
}
