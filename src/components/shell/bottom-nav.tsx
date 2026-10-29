"use client";

import Link from "next/link";
import type { Role } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import { isActivePath, navItemsFor } from "./nav-items";

export function BottomNav({ pathname, role }: { pathname: string; role: Role }) {
  const items = navItemsFor(role);
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className={cn("grid", items.length === 5 ? "grid-cols-5" : "grid-cols-4")}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 min-h-11 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                  active ? "text-accent" : "text-fg-muted hover:text-fg",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
