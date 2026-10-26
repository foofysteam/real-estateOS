"use client";

import { useState, type FormEvent } from "react";
import type { LeadStage } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { STAGE_LABELS, STAGE_ORDER, canTransition } from "@/lib/stages";
import { Field, FormError, nativeControl } from "./field";

type Props = {
  current: LeadStage;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (to: LeadStage, lostReason?: string) => void;
  pending?: boolean;
  error?: string | null;
};

export function StageDialog({ current, open, onOpenChange, ...form }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Change stage" description={`Currently ${STAGE_LABELS[current]}`}>
        <StageForm current={current} {...form} />
      </SheetContent>
    </Sheet>
  );
}

function StageForm({ current, onSubmit, pending, error }: Omit<Props, "open" | "onOpenChange">) {
  const options = STAGE_ORDER.filter((s) => canTransition(current, s));
  const [to, setTo] = useState<LeadStage>(options[0]);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (to !== "LOST") return onSubmit(to, undefined);
    const trimmed = reason.trim();
    if (!trimmed) return setReasonError("Add a reason for losing this lead");
    onSubmit(to, trimmed);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="stage-to" label="New stage">
        {/* size ≥ 2 renders an always-open list box on desktop; phones show their native picker. */}
        <select
          id="stage-to"
          size={Math.max(2, options.length)}
          value={to}
          onChange={(e) => setTo(e.target.value as LeadStage)}
          className={`${nativeControl} px-1 [&>option]:rounded-sm [&>option]:px-2 [&>option]:py-2.5`}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      {to === "LOST" && (
        <Field id="stage-lost-reason" label="Reason" error={reasonError}>
          <Input
            id="stage-lost-reason"
            value={reason}
            maxLength={200}
            autoFocus
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? "stage-lost-reason-error" : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(undefined);
            }}
          />
        </Field>
      )}
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Move
      </Button>
    </form>
  );
}
