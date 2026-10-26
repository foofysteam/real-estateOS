"use client";

import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut } from "lucide-react";
import type { Role } from "@/generated/prisma/client";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Account menu for ${name}`}
        className="grid size-11 place-items-center rounded-md hover:bg-surface-2"
      >
        <span className="grid size-8 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-fg ring-1 ring-border">
          {initials(name)}
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={16}
          className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-surface p-1 shadow-lg data-[state=open]:animate-fade-in"
        >
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-fg-muted">{email}</p>
            <p className="mt-1 text-xs text-fg-muted">{role === "ADMIN" ? "Admin" : "Agent"}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={logout}
            className="flex min-h-11 cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-none select-none data-[highlighted]:bg-surface-2 md:min-h-9"
          >
            <LogOut className="size-4 text-fg-muted" aria-hidden="true" />
            Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
