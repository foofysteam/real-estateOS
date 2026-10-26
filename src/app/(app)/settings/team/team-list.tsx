"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormError } from "@/app/(app)/leads/[id]/field";
import { useAction } from "@/app/(app)/leads/[id]/use-action";
import { resetPasswordAction, setUserActiveAction } from "../actions";
import { ActiveToggle } from "../active-toggle";
import { TemporaryPassword } from "../temporary-password";
import { InviteButton } from "./invite-form";

export type TeamRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  phone: string | null;
  isActive: boolean;
};

const LAST_ADMIN_REASON = "At least one active admin is required";

function RoleBadge({ role }: { role: TeamRow["role"] }) {
  return <Badge tone={role === "ADMIN" ? "accent" : "neutral"}>{role === "ADMIN" ? "Admin" : "Agent"}</Badge>;
}

/** The team, one row per person; the last active admin's switch is locked. */
export function TeamList({ users, lastAdminId }: { users: TeamRow[]; lastAdminId: string | null }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="team-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="team-heading" className="text-base font-semibold text-fg">
          Team
        </h2>
        <InviteButton />
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-fg">{u.name}</span>
                <RoleBadge role={u.role} />
                {!u.isActive && <Badge>Inactive</Badge>}
              </span>
              <span className="flex min-w-0 flex-wrap gap-x-1.5 text-sm text-fg-muted">
                <span className="truncate">{u.email}</span>
                {u.phone && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{u.phone}</span>
                  </>
                )}
              </span>
            </div>
            <div className="-mb-1 flex items-center justify-between gap-2 md:mb-0 md:justify-end">
              <ActiveToggle
                label={`${u.name} active`}
                active={u.isActive}
                onToggle={(next) => setUserActiveAction(u.id, next)}
                disabledReason={u.id === lastAdminId ? LAST_ADMIN_REASON : undefined}
              />
              <ResetPasswordButton user={u} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResetPasswordButton({ user }: { user: TeamRow }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const { pending, error, run, clearError } = useAction();

  function reset() {
    run(async () => {
      const result = await resetPasswordAction(user.id);
      if (result.ok) setPassword(result.temporaryPassword);
      return result;
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Closing forgets the password: it is shown once.
        setPassword(null);
        clearError();
        setOpen(o);
      }}
    >
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Reset password for ${user.name}`}>
        <KeyRound aria-hidden="true" />
        Reset password
      </Button>
      <DialogContent title={password ? "New password" : `Reset ${user.name}'s password?`}>
        {password ? (
          <div className="flex flex-col gap-4">
            <TemporaryPassword password={password} />
            <Button onClick={() => setOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-muted">Their current password stops working right away.</p>
            <FormError error={error} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={reset} disabled={pending}>
                Reset password
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
