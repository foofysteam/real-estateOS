import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { DuplicateEmailError, inviteUser, LastAdminError, listUsers, resetPassword, setUserActive } from "@/lib/team";
import { resetDb } from "../helpers/db";

describe("team", () => {
  beforeEach(resetDb);

  it("inviteUser lower-cases email, hashes the temp password and returns it once", async () => {
    const r = await inviteUser({ email: "A@SC.Studio", name: "A", role: "AGENT" });
    expect(r.user.email).toBe("a@sc.studio");
    expect(await verifyPassword(r.temporaryPassword, r.user.passwordHash)).toBe(true);
    expect(r.user.passwordHash).not.toContain(r.temporaryPassword);
  });

  it("generates a 12-char password with no ambiguous characters", async () => {
    const r = await inviteUser({ email: "b@sc.studio", name: "B", role: "ADMIN", phone: "98450 12345" });
    expect(r.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(r.temporaryPassword).not.toMatch(/[0O1lI]/);
    expect(r.user.phone).toBe("+919845012345");
  });

  it("inviteUser rejects duplicate email with DuplicateEmailError", async () => {
    await inviteUser({ email: "a@sc.studio", name: "A", role: "AGENT" });
    await expect(inviteUser({ email: " A@sc.studio ", name: "A2", role: "AGENT" })).rejects.toBeInstanceOf(
      DuplicateEmailError,
    );
  });

  it("inviteUser rejects an invalid phone", async () => {
    await expect(inviteUser({ email: "c@sc.studio", name: "C", role: "AGENT", phone: "123" })).rejects.toThrow();
  });

  it("setUserActive refuses to deactivate the last active admin", async () => {
    const { user: admin } = await inviteUser({ email: "admin@sc.studio", name: "Admin", role: "ADMIN" });
    const { user: agent } = await inviteUser({ email: "agent@sc.studio", name: "Agent", role: "AGENT" });
    await expect(setUserActive(admin.id, false)).rejects.toBeInstanceOf(LastAdminError);
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).isActive).toBe(true);
    await setUserActive(agent.id, false);
    expect((await db.user.findUniqueOrThrow({ where: { id: agent.id } })).isActive).toBe(false);
  });

  it("setUserActive lets one admin go when another active admin remains", async () => {
    const { user: a } = await inviteUser({ email: "a@sc.studio", name: "A", role: "ADMIN" });
    const { user: b } = await inviteUser({ email: "b@sc.studio", name: "B", role: "ADMIN" });
    await setUserActive(a.id, false);
    await expect(setUserActive(b.id, false)).rejects.toBeInstanceOf(LastAdminError);
    await setUserActive(a.id, true);
    expect((await db.user.findUniqueOrThrow({ where: { id: a.id } })).isActive).toBe(true);
  });

  it("resetPassword replaces the hash and returns the new password", async () => {
    const { user, temporaryPassword } = await inviteUser({ email: "a@sc.studio", name: "A", role: "AGENT" });
    const next = await resetPassword(user.id);
    expect(next).not.toBe(temporaryPassword);
    const { passwordHash } = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(next, passwordHash)).toBe(true);
    expect(await verifyPassword(temporaryPassword, passwordHash)).toBe(false);
  });

  it("listUsers orders by name and omits password hashes", async () => {
    await inviteUser({ email: "z@sc.studio", name: "Zed", role: "AGENT" });
    await inviteUser({ email: "a@sc.studio", name: "Amy", role: "ADMIN" });
    const users = await listUsers();
    expect(users.map((u) => u.name)).toEqual(["Amy", "Zed"]);
    expect(users[0]).not.toHaveProperty("passwordHash");
  });
});
