import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Loading placeholder. Size it with className; the pulse stops under prefers-reduced-motion. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface-2", className)} {...props} />;
}
