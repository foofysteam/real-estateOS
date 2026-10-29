"use client";

import { useState } from "react";
import type { FollowUpWithLead } from "@/lib/leads/queries";
import { useAction } from "@/lib/use-action";
import { completeFollowUpAction } from "./actions";
import { FollowUpRow } from "./follow-up-row";

/** Wires each row's Done button to the server action; the page revalidates and drops the row. A failure shows inline. */
export function FollowUpList({ items, overdue = false }: { items: FollowUpWithLead[]; overdue?: boolean }) {
  const { pending, error, run } = useAction();
  const [activeId, setActiveId] = useState<string | null>(null);

  function handleDone(id: string) {
    setActiveId(id);
    void run(() => completeFollowUpAction(id));
  }

  return (
    <ul>
      {items.map((item) => (
        <FollowUpRow
          key={item.id}
          item={item}
          onDone={handleDone}
          pending={pending && activeId === item.id}
          error={!pending && activeId === item.id ? error : null}
          overdue={overdue}
        />
      ))}
    </ul>
  );
}
