"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABELS } from "@/lib/channels";
import { formatIstDateTime } from "@/lib/dates";
import type { LeadDetail } from "@/lib/leads/queries";
import { completeFollowUpAction } from "./actions";
import { FormError } from "@/components/ui/field";
import { useAction } from "@/lib/use-action";

export function OpenFollowUps({ items }: { items: LeadDetail["followUps"] }) {
  const { pending, error, run } = useAction();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (items.length === 0) return <p className="text-sm text-fg-muted">No open follow-ups.</p>;

  return (
    <div className="flex flex-col gap-2">
      <FormError error={error} />
      <ul>
        {items.map((fu) => (
          <li key={fu.id} className="flex min-h-14 items-center gap-3 border-b border-border py-2 last:border-b-0 lg:min-h-11">
            <div className="min-w-0 flex-1">
              <p className="text-fg">
                {CHANNEL_LABELS[fu.channel]} ·{" "}
                <time dateTime={fu.dueAt.toISOString()} className="tabular-nums">
                  {formatIstDateTime(fu.dueAt)}
                </time>
              </p>
              <p className="truncate text-sm text-fg-muted">{[fu.owner?.name, fu.note].filter(Boolean).join(" · ")}</p>
            </div>
            <Button
              size="sm"
              disabled={pending && pendingId === fu.id}
              onClick={() => {
                setPendingId(fu.id);
                run(() => completeFollowUpAction(fu.id));
              }}
            >
              <Check aria-hidden="true" />
              Done
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
