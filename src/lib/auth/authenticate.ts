import { z } from "zod";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_TTL_MS, signSession } from "@/lib/auth/session";

export type AuthenticatedUser = { id: string; email: string; name: string; role: Role };

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

// Verified against when the user is missing or inactive so every failed login
// costs one argon2 verification and timing does not reveal accounts.
let dummyHash: Promise<string> | undefined;

/** Checks credentials; returns the user on success and null on any failure (no enumeration). */
export async function authenticate(email: unknown, password: unknown): Promise<AuthenticatedUser | null> {
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) return null;

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive) {
    await verifyPassword(parsed.data.password, await (dummyHash ??= hashPassword("dummy-password-for-timing")));
    return null;
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function issueSession(userId: string): { token: string; exp: Date } {
  const exp = new Date(Date.now() + SESSION_TTL_MS);
  return { token: signSession({ userId, exp: exp.getTime() }), exp };
}
