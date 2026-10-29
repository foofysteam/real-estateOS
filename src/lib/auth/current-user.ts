import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export type CurrentUser = { id: string; email: string; name: string; role: Role };

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = verifySession(token);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function requireUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) throw new ForbiddenError();
  return user;
}
