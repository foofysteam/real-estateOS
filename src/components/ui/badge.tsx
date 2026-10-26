import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-accent",
  success: "bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-success",
  warning: "bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-warning",
  danger: "bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-danger",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
