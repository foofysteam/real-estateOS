"use client";

import { useState } from "react";
import { RotateCw, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormError } from "@/components/ui/field";
import type { WebhookStatus } from "@/generated/prisma/enums";
import { formatIstDateTime } from "@/lib/dates";
import { useAction } from "@/lib/use-action";
import { retryAllFailedAction, retryWebhookEventAction } from "../actions";

export type WebhookEventRow = {
  id: string;
  externalId: string;
  status: WebhookStatus;
  error: string | null;
  receivedAt: Date;
};

const TH = "h-10 border-b border-border px-3 text-left text-xs font-medium text-fg-muted";
const TD = "h-11 border-b border-border px-3 py-2 text-sm align-top group-last:border-b-0";

function StatusBadge({ status }: { status: WebhookStatus }) {
  return status === "FAILED" ? <Badge tone="danger">Failed</Badge> : <Badge tone="warning">Stuck</Badge>;
}

const errorText = (e: WebhookEventRow) => e.error ?? (e.status === "PROCESSING" ? "Processing never finished" : "Unknown error");

/** Meta lead deliveries that failed or got stuck, each retryable: cards below md, a table from md up. */
export function WebhookEvents({ events }: { events: WebhookEventRow[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="webhook-events-heading">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="webhook-events-heading" className="text-base font-semibold text-fg">
            Webhook events
          </h2>
          <p className="text-sm text-fg-muted">Meta lead deliveries that failed. Fix the cause, then retry.</p>
        </div>
        {events.length > 0 && <RetryAllButton />}
      </div>

      {events.length === 0 ? (
        <EmptyState icon={Webhook} message="No failed deliveries." className="rounded-lg border border-border bg-surface" />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {events.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-fg tabular-nums">Lead {e.externalId}</span>
                  <StatusBadge status={e.status} />
                </span>
                <span className="text-sm break-words text-fg-muted">{errorText(e)}</span>
                <span className="text-sm text-fg-muted">Received {formatIstDateTime(e.receivedAt)}</span>
                <RetryButton event={e} />
              </li>
            ))}
          </ul>
          <table className="hidden w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface md:table">
            <thead>
              <tr>
                <th className={`${TH} w-[22%]`}>Lead ID</th>
                <th className={`${TH} w-24`}>Status</th>
                <th className={TH}>Error</th>
                <th className={`${TH} w-44`}>Received</th>
                <th className={`${TH} w-40 text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="group">
                  <td className={`${TD} truncate font-medium text-fg tabular-nums`}>{e.externalId}</td>
                  <td className={TD}>
                    <StatusBadge status={e.status} />
                  </td>
                  <td className={`${TD} break-words text-fg-muted`}>{errorText(e)}</td>
                  <td className={`${TD} text-fg-muted tabular-nums`}>{formatIstDateTime(e.receivedAt)}</td>
                  <td className={`${TD} text-right`}>
                    <RetryButton event={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function RetryButton({ event }: { event: WebhookEventRow }) {
  const { pending, error, run } = useAction();
  const [stillFailing, setStillFailing] = useState(false);

  async function retry() {
    setStillFailing(false);
    await run(async () => {
      const result = await retryWebhookEventAction(event.id);
      if (result.ok && result.status === "FAILED") setStillFailing(true);
      return result;
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button variant="secondary" size="sm" disabled={pending} onClick={retry} aria-label={`Retry lead ${event.externalId}`}>
        <RotateCw aria-hidden="true" />
        Retry
      </Button>
      <FormError error={error ?? (stillFailing ? "Still failing. Check the error and try again." : null)} />
    </span>
  );
}

function RetryAllButton() {
  const { pending, error, run } = useAction();
  const [summary, setSummary] = useState<string | null>(null);

  async function retryAll() {
    setSummary(null);
    await run(async () => {
      const result = await retryAllFailedAction();
      if (result.ok) setSummary(`${result.processed} of ${result.retried} imported`);
      return result;
    });
  }

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button size="sm" disabled={pending} onClick={retryAll}>
        <RotateCw aria-hidden="true" />
        Retry all
      </Button>
      {summary && (
        <span role="status" className="text-sm text-fg-muted">
          {summary}
        </span>
      )}
      <FormError error={error} />
    </span>
  );
}
