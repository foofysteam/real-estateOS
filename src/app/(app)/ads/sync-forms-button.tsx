"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { syncLeadFormsAction } from "./actions";

/** Stores the page's current lead-form ids on the Meta connection and reports the outcome inline. */
export function SyncFormsButton() {
  const { pending, error, run } = useAction();
  const [synced, setSynced] = useState<number | null>(null);

  function sync() {
    setSynced(null);
    void run(async () => {
      const result = await syncLeadFormsAction();
      if (result.ok) setSynced(result.count);
      return result.ok ? { ok: true } : result;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p role="status" className="text-sm text-fg-muted empty:hidden">
          {synced != null && `Synced ${synced} form${synced === 1 ? "" : "s"}`}
        </p>
      )}
      <Button variant="secondary" size="sm" disabled={pending} onClick={sync}>
        <RefreshCw aria-hidden="true" className={pending ? "animate-spin" : undefined} />
        {pending ? "Syncing…" : "Sync forms"}
      </Button>
    </div>
  );
}
