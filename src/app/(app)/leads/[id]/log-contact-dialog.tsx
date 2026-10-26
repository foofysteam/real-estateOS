"use client";

import { useState, type FormEvent } from "react";
import type { FollowUpChannel } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CHANNEL_LABELS, CHANNEL_ORDER } from "@/lib/channels";
import { Field, FormError, nativeControl } from "./field";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (channel: FollowUpChannel, note?: string) => void;
  pending?: boolean;
  error?: string | null;
};

export function LogContactDialog({ open, onOpenChange, ...form }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Log contact">
        <LogContactForm {...form} />
      </SheetContent>
    </Sheet>
  );
}

function LogContactForm({ onSubmit, pending, error }: Omit<Props, "open" | "onOpenChange">) {
  const [channel, setChannel] = useState<FollowUpChannel>("CALL");
  const [note, setNote] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(channel, note.trim() || undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="contact-channel" label="Channel">
        <select
          id="contact-channel"
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
      <Field id="contact-note" label="Note (optional)">
        <textarea
          id="contact-note"
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={nativeControl}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Log contact
      </Button>
    </form>
  );
}
