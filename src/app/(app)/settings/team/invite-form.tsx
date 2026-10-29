"use client";

import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Field, FormError, nativeControl } from "@/components/ui/field";
import { useAction } from "@/lib/use-action";
import { inviteUserAction, type FieldErrors } from "../actions";
import { TemporaryPassword } from "../show-once";

type Values = { email: string; name: string; role: "AGENT" | "ADMIN"; phone: string };

const TEXT_FIELDS: { key: "email" | "name" | "phone"; label: string; type: string; hint?: string }[] = [
  { key: "email", label: "Email", type: "email" },
  { key: "name", label: "Name", type: "text" },
  { key: "phone", label: "Phone (optional)", type: "tel", hint: "e.g. 98450 12345" },
];

/** "Invite" opens a sheet; on success the form is replaced by the temporary password, shown once. */
export function InviteButton() {
  const [open, setOpen] = useState(false);
  // Remount on every open so a previous password or draft never reappears.
  const [round, setRound] = useState(0);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setRound((r) => r + 1);
        setOpen(o);
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden="true" />
          Invite
        </Button>
      </SheetTrigger>
      <SheetContent title="Invite a teammate">
        <InviteForm key={round} onDone={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function InviteForm({ onDone }: { onDone: () => void }) {
  const [values, setValues] = useState<Values>({ email: "", name: "", role: "AGENT", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [password, setPassword] = useState<string | null>(null);
  const { pending, error, run } = useAction();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const result = await inviteUserAction({ ...values, phone: values.phone || undefined });
      setFieldErrors(result.ok ? {} : (result.fieldErrors ?? {}));
      if (result.ok) setPassword(result.temporaryPassword);
      return result;
    });
  }

  if (password) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-fg">
          {values.name} can now sign in as <span className="font-medium">{values.email.trim().toLowerCase()}</span>.
        </p>
        <TemporaryPassword password={password} />
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {TEXT_FIELDS.map(({ key, label, type, hint }) => {
        const id = `invite-${key}`;
        const fieldError = fieldErrors[key];
        return (
          <Field key={key} id={id} label={label} error={fieldError}>
            <Input
              id={id}
              type={type}
              value={values[key]}
              placeholder={hint}
              required={key !== "phone"}
              autoComplete="off"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${id}-error` : undefined}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            />
          </Field>
        );
      })}
      <Field id="invite-role" label="Role" error={fieldErrors.role}>
        <select
          id="invite-role"
          value={values.role}
          onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as Values["role"] }))}
          className={nativeControl}
        >
          <option value="AGENT">Agent</option>
          <option value="ADMIN">Admin</option>
        </select>
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending}>
        Send invite
      </Button>
    </form>
  );
}
