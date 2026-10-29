import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { verifySession } from "@/lib/auth/session";
import { POST } from "@/app/api/auth/login/route";
import { POST as LOGOUT } from "@/app/api/auth/logout/route";
import { resetDb } from "../helpers/db";

function login(body: unknown) {
  return POST(new Request("http://x/api/auth/login", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" } }));
}

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await resetDb();
    await db.user.create({ data: { email: "admin@sc.studio", name: "Admin", role: "ADMIN", passwordHash: await hashPassword("pass1234") } });
  });

  it("logs in and sets the session cookie", async () => {
    const res = await login({ email: "admin@sc.studio", password: "pass1234" });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/sales_os_session=.+HttpOnly/);
    const token = /sales_os_session=([^;]+)/.exec(cookie)![1];
    const user = await db.user.findUniqueOrThrow({ where: { email: "admin@sc.studio" } });
    const session = verifySession(token);
    expect(session?.userId).toBe(user.id);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(session!.exp - (Date.now() + thirtyDays))).toBeLessThan(60_000);
    const expires = Date.parse(/Expires=([^;]+)/.exec(cookie)![1]);
    expect(Math.abs(expires - (Date.now() + thirtyDays))).toBeLessThan(60_000);
    const json = await res.json();
    expect(json.user).toEqual({ id: user.id, email: "admin@sc.studio", name: "Admin", role: "ADMIN" });
  });

  it("normalises email case and whitespace", async () => {
    const res = await login({ email: "  Admin@SC.studio ", password: "pass1234" });
    expect(res.status).toBe(200);
  });

  it("returns 401 on wrong password", async () => {
    const res = await login({ email: "admin@sc.studio", password: "bad" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid credentials" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns 401 on unknown email", async () => {
    const res = await login({ email: "nobody@sc.studio", password: "pass1234" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for inactive user", async () => {
    await db.user.updateMany({ data: { isActive: false } });
    const res = await login({ email: "admin@sc.studio", password: "pass1234" });
    expect(res.status).toBe(401);
  });

  it("returns 401 on malformed body", async () => {
    expect((await login("not json")).status).toBe(401);
    expect((await login({ email: "admin@sc.studio" })).status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie and returns 204", async () => {
    const res = await LOGOUT();
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/sales_os_session=;.*Expires=Thu, 01 Jan 1970/);
  });
});
