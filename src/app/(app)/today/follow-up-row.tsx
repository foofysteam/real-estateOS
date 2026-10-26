"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { StageBadge } from "@/components/leads/stage-badge";
import { formatIstDateTime, formatIstTime } from "@/lib/dates";
import type { FollowUpWithLead } from "@/lib/leads/queries";
import { CallLink, WhatsAppLink } from "./contact-links";

export function FollowUpRow({
  item,
  onDone,
  pending = false,
  error = null,
  overdue = false,
}: {
  item: FollowUpWithLead;
  onDone: (id: string) => void;
  pending?: boolean;
  /** Why the last Done on this row failed; shown under the row. */
  error?: string | null;
  /** Overdue items may be days old, so show the date as well as the time. */
  overdue?: boolean;
}) {
  const { lead } = item;
  return (
    <li className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:min-h-11 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-4 lg:gap-y-1 lg:py-1.5">
      <Link
        href={`/leads/${lead.id}`}
        className="-mx-2 flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-1 rounded-md px-2 hover:bg-surface-2 lg:min-h-11 lg:flex-row lg:items-center lg:gap-4"
      >
        <div className="flex min-w-0 items-center gap-2 lg:flex-1">
          <span className="truncate font-medium text-fg">{lead.name}</span>
          <StageBadge stage={lead.stage} className="shrink-0" />
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm text-fg-muted lg:w-64 lg:shrink-0">
          <time dateTime={item.dueAt.toISOString()} className="shrink-0 tabular-nums">
            {overdue ? formatIstDateTime(item.dueAt) : formatIstTime(item.dueAt)}
          </time>
          {lead.project && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{lead.project.name}</span>
            </>
          )}
        </div>
      </Link>
      <div className="grid grid-cols-3 gap-2 lg:flex lg:shrink-0">
        <CallLink phone={lead.phone} />
        <WhatsAppLink phone={lead.phone} />
        <Button variant="primary" size="sm" disabled={pending} onClick={() => onDone(item.id)}>
          <Check aria-hidden="true" />
          Done
        </Button>
      </div>
      {error && (
        <div className="lg:basis-full">
          <FormError error={error} />
        </div>
      )}
    </li>
  );
}
