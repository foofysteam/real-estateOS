"use client";

import type { ComponentProps } from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export const Select = RadixSelect.Root;

export function SelectTrigger({
  placeholder,
  className,
  ...props
}: ComponentProps<typeof RadixSelect.Trigger> & { placeholder?: string }) {
  return (
    <RadixSelect.Trigger
      className={cn(
        "inline-flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 text-base text-fg lg:min-h-9 md:text-sm",
        "transition-[border-color] focus-visible:border-accent disabled:opacity-50 data-[placeholder]:text-fg-muted",
        className,
      )}
      {...props}
    >
      <span className="truncate">
        <RadixSelect.Value placeholder={placeholder} />
      </span>
      <RadixSelect.Icon>
        <ChevronDown className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

export function SelectContent({ className, children, ...props }: ComponentProps<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position="popper"
        sideOffset={4}
        className={cn(
          "z-50 max-h-[min(var(--radix-select-content-available-height),20rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden",
          "rounded-md border border-border bg-surface shadow-lg data-[state=open]:animate-fade-in",
          className,
        )}
        {...props}
      >
        <RadixSelect.Viewport className="p-1">{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

export function SelectItem({ className, children, ...props }: ComponentProps<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      className={cn(
        "relative flex min-h-11 cursor-default items-center rounded-sm pr-8 pl-2 text-sm outline-none select-none lg:min-h-8",
        "data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2">
        <Check className="size-4 text-accent" aria-hidden="true" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}
