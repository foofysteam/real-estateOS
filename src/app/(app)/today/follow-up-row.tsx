"use client";

import { Check, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/leads/stage-badge";
import { formatIstTime } from "@/lib/dates";
import { toTelLink, toWaLink } from "@/lib/phone";
import type { FollowUpWithLead } from "@/lib/leads/queries";

export function FollowUpRow({
  item,
  onDone,
  pending = false,
}: {
  item: FollowUpWithLead;
  onDone: (id: string) => void;
  pending?: boolean;
}) {
  const { lead } = item;
  return (
    <li className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:min-h-11 lg:flex-row lg:items-center lg:gap-4 lg:py-1.5">
      <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-1 lg:min-h-0 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 items-center gap-2 lg:flex-1">
          <span className="truncate font-medium text-fg">{lead.name}</span>
          <StageBadge stage={lead.stage} className="shrink-0" />
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm text-fg-muted lg:w-64 lg:shrink-0">
          <time dateTime={item.dueAt.toISOString()} className="shrink-0 tabular-nums">
            {formatIstTime(item.dueAt)}
          </time>
          {lead.project && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{lead.project.name}</span>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 lg:flex lg:shrink-0">
        <Button asChild variant="secondary" size="sm">
          <a href={toTelLink(lead.phone)}>
            <Phone aria-hidden="true" />
            Call
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href={toWaLink(lead.phone)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            WhatsApp
          </a>
        </Button>
        <Button variant="primary" size="sm" disabled={pending} onClick={() => onDone(item.id)}>
          <Check aria-hidden="true" />
          Done
        </Button>
      </div>
    </li>
  );
}
