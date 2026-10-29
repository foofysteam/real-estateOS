import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Spec §7.1: one sentence and one primary action. */
export function EmptyState({
  icon: Icon,
  message,
  action,
  className,
}: {
  icon?: LucideIcon;
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-4 py-12 text-center", className)}>
      {Icon && (
        <span className="grid size-10 place-items-center rounded-md bg-surface-2 text-fg-muted">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <p className="max-w-xs text-sm text-fg-muted">{message}</p>
      {action}
    </div>
  );
}
