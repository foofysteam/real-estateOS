import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// 16 px text below md stops iOS Safari from zooming on focus.
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "block min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-base text-fg md:min-h-9 md:text-sm",
        "placeholder:text-fg-muted transition-[border-color] focus-visible:border-accent",
        "disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
