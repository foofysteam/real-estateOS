import { describe, it, expect } from "vitest";
import { signSession, verifySession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

describe("session", () => {
  it("round-trips a payload", () => {
    const t = signSession({ userId: "u1", exp: Date.now() + 1000 });
    expect(verifySession(t)?.userId).toBe("u1");
  });

  it("rejects tampered tokens", () => {
    const t = signSession({ userId: "u1", exp: Date.now() + 1000 });
    expect(verifySession(t.slice(0, -2) + "zz")).toBeNull();
  });

  it("rejects a token whose payload was swapped", () => {
    const t = signSession({ userId: "u1", exp: Date.now() + 1000 });
    const forged = Buffer.from(JSON.stringify({ userId: "admin", exp: Date.now() + 1000 })).toString("base64url");
    expect(verifySession(forged + "." + t.split(".")[1])).toBeNull();
  });

  it("rejects expired tokens", () => {
    expect(verifySession(signSession({ userId: "u1", exp: Date.now() - 1 }))).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession("abc")).toBeNull();
    expect(verifySession("a.b.c")).toBeNull();
  });

  it("builds http-only lax cookie options", () => {
    const exp = new Date(Date.now() + 1000);
    expect(SESSION_COOKIE).toBe("sales_os_session");
    expect(sessionCookieOptions(exp)).toEqual({ httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: exp });
  });
});
