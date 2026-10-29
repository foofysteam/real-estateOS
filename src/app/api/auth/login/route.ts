import { NextResponse } from "next/server";
import { authenticate, issueSession } from "@/lib/auth/authenticate";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

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
  const body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const user = await authenticate(body.email, body.password);
  if (!user) return invalid();

  const { token, exp } = issueSession(user.id);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(exp));
  return res;
}
