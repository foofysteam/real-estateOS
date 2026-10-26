"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LoginState } from "./actions";

type Props = { action: (prev: LoginState, formData: FormData) => Promise<LoginState> };

export function LoginForm({ action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  // Controlled so React's post-action form reset does not wipe the typed email.
  // `state.email` repopulates it on the no-JS path, where the page re-renders from the server.
  const [email, setEmail] = useState(state.email ?? "");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sales OS</h1>
        <p className="mt-1 text-sm text-fg-muted">Sign in to your workspace.</p>

        <form action={formAction} className="mt-8 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={state.error ? true : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={state.error ? true : undefined}
            />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            Sign in
          </Button>
        </form>
      </Card>
    </main>
  );
}
