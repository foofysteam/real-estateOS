"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./actions";

export const GENERIC_ERROR = "Something went wrong. Try again.";

/** Runs a server action in a transition, keeps its readable error, and calls onOk on success. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** Never throws: a thrown action or dropped connection becomes GENERIC_ERROR, so the sheet and its values stay. */
  function run(action: () => Promise<ActionResult>, onOk?: () => void): Promise<ActionResult> {
    setError(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        let result: ActionResult;
        try {
          result = await action();
        } catch {
          result = { ok: false, error: GENERIC_ERROR };
        }
        if (result.ok) onOk?.();
        else setError(result.error);
        resolve(result);
      });
    });
  }

  return { pending, error, run, clearError: () => setError(null) };
}
