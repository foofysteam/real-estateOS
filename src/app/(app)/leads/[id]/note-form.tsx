"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { addNoteAction } from "./actions";
import { FormError, nativeControl } from "./field";
import { useAction } from "./use-action";

export function NoteForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const { pending, error, run } = useAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    run(() => addNoteAction(leadId, text), () => setText(""));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="lead-note" className="sr-only">
        Add a note
      </label>
      <textarea
        id="lead-note"
        rows={2}
        maxLength={2000}
        placeholder="Add a note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={nativeControl}
      />
      <FormError error={error} />
      <Button type="submit" variant="secondary" className="self-end" disabled={pending || !text.trim()}>
        Add note
      </Button>
    </form>
  );
}
