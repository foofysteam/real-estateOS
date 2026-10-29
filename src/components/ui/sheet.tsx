"use client";

import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Sheet = RadixDialog.Root;
export const SheetTrigger = RadixDialog.Trigger;
export const SheetClose = RadixDialog.Close;

/** Bottom sheet below md; right-hand side panel from md up. */
export function SheetContent({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-fade-in" />
      <RadixDialog.Content
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed z-50 flex flex-col border-border bg-surface shadow-lg",
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg border-t pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-sheet-up",
          "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none md:border-t-0 md:border-l md:pb-0 md:data-[state=open]:animate-sheet-left",
          className,
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border md:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-2 px-4 pt-2 md:pt-4">
          <div className="min-w-0 pt-2.5">
            <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-1 text-sm text-fg-muted">{description}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            aria-label="Close"
            className="-mr-2 grid size-11 shrink-0 place-items-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </RadixDialog.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
