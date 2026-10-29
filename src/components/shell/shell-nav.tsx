"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";

/** Reads the route so Sidebar/BottomNav stay router-free (and testable with plain props). */
export function ShellNav({ role, variant }: { role: Role; variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();
  return variant === "sidebar" ? <Sidebar pathname={pathname} role={role} /> : <BottomNav pathname={pathname} role={role} />;
}
