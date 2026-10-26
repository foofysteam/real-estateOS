import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth/current-user";
import { ShellNav } from "./shell-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <ShellNav role={user.role} variant="sidebar" />
      <div className="flex min-w-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)] lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-2 pr-2 pl-4 lg:pl-6">
            <span className="text-sm font-semibold tracking-tight lg:invisible">Sales OS</span>
            <div className="flex items-center">
              <ThemeToggle />
              <UserMenu name={user.name} email={user.email} role={user.role} />
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <ShellNav role={user.role} variant="bottom" />
    </div>
  );
}
