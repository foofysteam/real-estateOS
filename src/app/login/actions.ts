"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions, signSession } from "@/lib/auth/session";

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

// Verified against when the user is missing or inactive so every failed login
// costs one argon2 verification and timing does not reveal accounts.
let dummyHash: Promise<string> | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";
  const fail = { error: "Invalid credentials", email };

  const parsed = schema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return fail;

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.isActive) {
    await verifyPassword(parsed.data.password, await (dummyHash ??= hashPassword("dummy-password-for-timing")));
    return fail;
  }
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return fail;

  const exp = new Date(Date.now() + SESSION_TTL_MS);
  const token = signSession({ userId: user.id, exp: exp.getTime() });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(exp));
  redirect("/today");
}
