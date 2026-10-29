import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(new Date(0)));
  return res;
}
