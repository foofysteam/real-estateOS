"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  error: unknown;
  /** Re-fetches and re-renders the segment (Next 16); preferred over reset for server errors. */
  retry?: () => void;
  reset?: () => void;
};

/** In-shell fallback for any error thrown while rendering an app page. */
export default function AppError({ error, retry, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-md bg-tone-danger-bg text-tone-danger-fg">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <h1 className="text-lg font-semibold text-fg">Something went wrong</h1>
      <p className="text-sm text-fg-muted">This page hit an unexpected error. Try again, or head back to Today.</p>
      {digest && (
        <p className="text-xs text-fg-muted">
          Error reference: <code className="tabular-nums">{digest}</code>
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => (retry ?? reset)?.()}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/today">Go to Today</Link>
        </Button>
      </div>
    </div>
  );
}
