import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

export const SESSION_COOKIE = "sales_os_session";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionPayload = { userId: string; exp: number };

function sign(data: string): Buffer {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(data).digest();
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify({ userId: payload.userId, exp: payload.exp })).toString("base64url");
  return `${body}.${sign(body).toString("base64url")}`;
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  const { userId, exp } = payload as Record<string, unknown>;
  if (typeof userId !== "string" || typeof exp !== "number") return null;
  if (exp <= Date.now()) return null;
  return { userId, exp };
}

export function sessionCookieOptions(exp: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: exp,
  };
}
