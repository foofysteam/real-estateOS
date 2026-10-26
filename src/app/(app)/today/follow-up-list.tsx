"use client";

import { useTransition, useState } from "react";
import type { FollowUpWithLead } from "@/lib/leads/queries";
import { completeFollowUpAction } from "./actions";
import { FollowUpRow } from "./follow-up-row";

/** Wires each row's Done button to the server action; the page revalidates and drops the row. */
export function FollowUpList({ items, overdue = false }: { items: FollowUpWithLead[]; overdue?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleDone(id: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await completeFollowUpAction(id);
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <ul>
      {items.map((item) => (
        <FollowUpRow
          key={item.id}
          item={item}
          onDone={handleDone}
          pending={isPending && pendingId === item.id}
          overdue={overdue}
        />
      ))}
    </ul>
  );
}
