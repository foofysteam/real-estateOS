"use client";

import { cn } from "@/lib/cn";
import type { SettingsResult } from "./actions";
import { useAction } from "@/lib/use-action";

/** A 44 px switch that calls a server action; the page re-renders with the new state on success. */
export function ActiveToggle({
  label,
  active,
  onToggle,
  disabledReason,
}: {
  label: string;
  active: boolean;
  onToggle: (next: boolean) => Promise<SettingsResult>;
  /** Shown as a tooltip when the switch cannot be used. */
  disabledReason?: string;
}) {
  const { pending, error, run } = useAction();
  const disabled = pending || Boolean(disabledReason);

  return (
    <span className="inline-flex flex-col items-start gap-1" title={disabledReason}>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={label}
        disabled={disabled}
        onClick={() => run(() => onToggle(!active))}
        className="group grid min-h-11 min-w-11 place-items-center rounded-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            active ? "bg-accent" : "bg-border",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 size-4 rounded-full bg-surface shadow transition-transform",
              active && "translate-x-4",
            )}
          />
        </span>
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
