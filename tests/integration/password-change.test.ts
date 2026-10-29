import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePassword, InvalidPasswordError } from "@/lib/auth/password-change";
import { resetDb } from "../helpers/db";

const currentUser = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/auth/current-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/current-user")>();
  return { ...actual, requireUser: vi.fn(async () => ({ id: currentUser.id, email: "a@x.in", name: "A", role: "AGENT" })) };
});

const { changePasswordAction } = await import("@/app/(app)/account/actions");

describe("changePassword", () => {
  let userId: string;
  const hashOf = async () => (await db.user.findUniqueOrThrow({ where: { id: userId } })).passwordHash;

  beforeEach(async () => {
    await resetDb();
    userId = (await db.user.create({ data: { email: "a@x.in", name: "A", role: "AGENT", passwordHash: await hashPassword("temp-pass-1") } })).id;
    currentUser.id = userId;
  });

  it("rejects a wrong current password and leaves the hash alone", async () => {
    const before = await hashOf();
    await expect(changePassword(userId, "wrong", "new-pass-123")).rejects.toMatchObject({
      name: "InvalidPasswordError",
      field: "currentPassword",
    });
    expect(await hashOf()).toBe(before);
  });

  it("rejects a short or reused new password", async () => {
    await expect(changePassword(userId, "temp-pass-1", "short")).rejects.toBeInstanceOf(InvalidPasswordError);
    await expect(changePassword(userId, "temp-pass-1", "temp-pass-1")).rejects.toThrow(/aren't using now/);
  });

  it("changes the password: the new one verifies and the old one doesn't", async () => {
    await changePassword(userId, "temp-pass-1", "new-pass-123");
    const hash = await hashOf();
    expect(await verifyPassword("new-pass-123", hash)).toBe(true);
    expect(await verifyPassword("temp-pass-1", hash)).toBe(false);
  });

  it("changePasswordAction returns field errors and succeeds", async () => {
    expect(await changePasswordAction({ currentPassword: "temp-pass-1", newPassword: "new-pass-123", confirmPassword: "nope" })).toEqual({
      ok: false,
      error: "Passwords don't match",
      field: "confirmPassword",
    });
    expect(await changePasswordAction({ currentPassword: "bad", newPassword: "new-pass-123", confirmPassword: "new-pass-123" })).toEqual({
      ok: false,
      error: "Current password is incorrect",
      field: "currentPassword",
    });
    expect(
      await changePasswordAction({ currentPassword: "temp-pass-1", newPassword: "new-pass-123", confirmPassword: "new-pass-123" }),
    ).toEqual({ ok: true });
    expect(await verifyPassword("new-pass-123", await hashOf())).toBe(true);
  });
});
