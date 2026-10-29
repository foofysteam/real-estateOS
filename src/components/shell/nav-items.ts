import { CalendarCheck, Megaphone, Settings, SquareKanban, Users, type LucideIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/client";

export type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly?: boolean };

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: SquareKanban },
  { href: "/ads", label: "Ads", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
];

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN");
}

/** `/leads` is active on `/leads` and `/leads/abc`, not on `/leadsx`. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
