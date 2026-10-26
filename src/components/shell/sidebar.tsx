"use client";

import Link from "next/link";
import type { Role } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import { isActivePath, navItemsFor } from "./nav-items";

export function Sidebar({ pathname, role }: { pathname: string; role: Role }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-14 items-center px-4 text-sm font-semibold tracking-tight">Sales OS</div>
      <nav aria-label="Primary" className="px-2">
        <ul className="flex flex-col gap-0.5">
          {navItemsFor(role).map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors pointer-coarse:min-h-11",
                    active ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className={cn("size-4", active && "text-accent")} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
