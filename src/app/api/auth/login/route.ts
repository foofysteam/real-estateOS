import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

// Verified against when the user is missing or inactive so every failed login
// costs one argon2 verification and response timing does not reveal accounts.
let dummyHash: Promise<string> | undefined;

function invalid() {
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return invalid();
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return invalid();
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    await verifyPassword(password, await (dummyHash ??= hashPassword("dummy-password-for-timing")));
    return invalid();
  }
  if (!(await verifyPassword(password, user.passwordHash))) return invalid();

  const exp = new Date(Date.now() + SESSION_TTL_MS);
  const token = signSession({ userId: user.id, exp: exp.getTime() });
  const res = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(exp));
  return res;
}
