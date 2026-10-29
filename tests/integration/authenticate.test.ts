import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { verifySession } from "@/lib/auth/session";
import { authenticate, issueSession } from "@/lib/auth/authenticate";
import { resetDb } from "../helpers/db";

describe("authenticate", () => {
  beforeEach(async () => {
    await resetDb();
    await db.user.create({ data: { email: "admin@sc.studio", name: "Admin", role: "ADMIN", passwordHash: await hashPassword("pass1234") } });
  });

  it("returns null for an unknown email", async () => {
    expect(await authenticate("nobody@sc.studio", "pass1234")).toBeNull();
  });

  it("returns null for an inactive user", async () => {
    await db.user.updateMany({ data: { isActive: false } });
    expect(await authenticate("admin@sc.studio", "pass1234")).toBeNull();
  });

  it("returns null for a wrong password", async () => {
    expect(await authenticate("admin@sc.studio", "bad")).toBeNull();
  });

  it("returns null for missing or non-string input", async () => {
    expect(await authenticate("", "pass1234")).toBeNull();
    expect(await authenticate("admin@sc.studio", null)).toBeNull();
  });

  it("returns the user without passwordHash, normalising the email", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: "admin@sc.studio" } });
    expect(await authenticate("  Admin@SC.studio ", "pass1234")).toEqual({ id: user.id, email: "admin@sc.studio", name: "Admin", role: "ADMIN" });
  });
});

describe("issueSession", () => {
  it("signs a token for the user expiring in 30 days", () => {
    const { token, exp } = issueSession("u1");
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(exp.getTime() - (Date.now() + thirtyDays))).toBeLessThan(60_000);
    expect(verifySession(token)).toEqual({ userId: "u1", exp: exp.getTime() });
  });
});
