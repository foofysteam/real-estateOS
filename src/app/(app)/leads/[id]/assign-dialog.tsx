"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Field, FormError, nativeControl } from "./field";

export type Owner = { id: string; name: string };

const UNASSIGNED = "";

type Props = {
  owners: Owner[];
  currentOwnerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (ownerId: string | null) => void;
  pending?: boolean;
  error?: string | null;
};

export function AssignDialog({ open, onOpenChange, ...form }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Assign lead">
        <AssignForm {...form} />
      </SheetContent>
    </Sheet>
  );
}

function AssignForm({ owners, currentOwnerId, onSubmit, pending, error }: Omit<Props, "open" | "onOpenChange">) {
  const [ownerId, setOwnerId] = useState(currentOwnerId ?? UNASSIGNED);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(ownerId === UNASSIGNED ? null : ownerId);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field id="assign-owner" label="Owner">
        <select id="assign-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={nativeControl}>
          <option value={UNASSIGNED}>Unassigned</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending || ownerId === (currentOwnerId ?? UNASSIGNED)}>
        Assign
      </Button>
    </form>
  );
}
