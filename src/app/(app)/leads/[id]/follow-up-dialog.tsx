"use client";

import { useState, type FormEvent } from "react";
import type { FollowUpChannel } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CHANNEL_LABELS, CHANNEL_ORDER } from "@/lib/channels";
import { Field, FormError, nativeControl } from "@/components/ui/field";

export type FollowUpInput = { dueAt: string; channel: FollowUpChannel; note?: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: FollowUpInput) => void;
  pending?: boolean;
  error?: string | null;
};

/** `datetime-local` value (device time zone) for tomorrow at 10:00. */
function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

export function FollowUpDialog({ open, onOpenChange, ...form }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Schedule follow-up">
        <FollowUpForm {...form} />
      </SheetContent>
    </Sheet>
  );
}

function FollowUpForm({ onSubmit, pending, error }: Omit<Props, "open" | "onOpenChange">) {
  const [due, setDue] = useState(defaultDue);
  const [channel, setChannel] = useState<FollowUpChannel>("CALL");
  const [note, setNote] = useState("");
  const [dueError, setDueError] = useState<string>();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const dueAt = new Date(due);
    if (Number.isNaN(dueAt.getTime())) return setDueError("Pick a date and time");
    if (dueAt.getTime() < Date.now() + 60_000) return setDueError("Pick a time in the future");
    onSubmit({ dueAt: dueAt.toISOString(), channel, note: note.trim() || undefined });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="fu-due" label="When" error={dueError}>
        <Input
          id="fu-due"
          type="datetime-local"
          value={due}
          aria-invalid={dueError ? true : undefined}
          onChange={(e) => {
            setDue(e.target.value);
            setDueError(undefined);
          }}
        />
      </Field>
      <Field id="fu-channel" label="Channel">
        <select
          id="fu-channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value as FollowUpChannel)}
          className={nativeControl}
        >
          {CHANNEL_ORDER.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field id="fu-note" label="Note (optional)">
        <textarea
          id="fu-note"
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={nativeControl}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Schedule
      </Button>
    </form>
  );
}
