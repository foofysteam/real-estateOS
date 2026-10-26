"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./actions";

/** Runs a server action in a transition, keeps its readable error, and calls onOk on success. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onOk?.();
      else setError(result.error);
    });
  }

  return { pending, error, run, clearError: () => setError(null) };
}
