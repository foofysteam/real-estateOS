"use client";

import { useState, type FormEvent } from "react";
import { changePasswordAction, type ChangePasswordInput } from "@/app/(app)/account/actions";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAction } from "@/lib/use-action";

type Key = keyof ChangePasswordInput;

const FIELDS: { key: Key; label: string; autoComplete: string }[] = [
  { key: "currentPassword", label: "Current password", autoComplete: "current-password" },
  { key: "newPassword", label: "New password", autoComplete: "new-password" },
  { key: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" },
];

/** Self-service password change, opened from the user menu. */
export function ChangePasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  // Remount the form on every open so typed passwords never linger.
  const [round, setRound] = useState(0);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setRound((r) => r + 1);
        onOpenChange(next);
      }}
    >
      <SheetContent title="Change password">
        <ChangePasswordForm key={round} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [values, setValues] = useState<ChangePasswordInput>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errorField, setErrorField] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { pending, error, run } = useAction();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorField(null);
    const result = await run(
      () => changePasswordAction(values),
      () => setDone(true),
    );
    if (!result.ok && result.field) setErrorField(result.field);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-fg">
          Password changed. Use it next time you sign in.
        </p>
        <Button onClick={onDone}>Done</Button>
      </div>
    );
  }

  const fieldError = (key: Key) => (error && errorField === key ? error : undefined);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {FIELDS.map(({ key, label, autoComplete }) => (
        <Field key={key} id={`pw-${key}`} label={label} error={fieldError(key)}>
          <Input
            id={`pw-${key}`}
            type="password"
            autoComplete={autoComplete}
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            aria-invalid={fieldError(key) ? true : undefined}
            aria-describedby={fieldError(key) ? `pw-${key}-error` : undefined}
          />
        </Field>
      ))}
      <p className="text-sm text-fg-muted">At least 8 characters.</p>
      <FormError error={errorField && FIELDS.some((f) => f.key === errorField) ? null : error} />
      <Button type="submit" disabled={pending}>
        Change password
      </Button>
    </form>
  );
}
