import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../helpers/db";

const currentUser = vi.hoisted(() => ({ role: "ADMIN" as "ADMIN" | "AGENT" }));

vi.mock("@/lib/auth/current-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/current-user")>();
  return {
    ...actual,
    requireUser: vi.fn(async (role?: string) => {
      if (role && role !== currentUser.role) throw new actual.ForbiddenError();
      return { id: "u1", email: "admin@sc.studio", name: "Admin", role: currentUser.role };
    }),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revalidatePath } = await import("next/cache");
const actions = await import("@/app/(app)/settings/actions");

const project = { name: "Kingar Heights", slug: "kingar-heights", city: "Bengaluru", priceMin: "80L", priceMax: "1.6Cr" };

describe("settings actions", () => {
  beforeEach(async () => {
    await resetDb();
    currentUser.role = "ADMIN";
    vi.mocked(revalidatePath).mockClear();
  });

  it("refuses every action for a non-admin", async () => {
    currentUser.role = "AGENT";
    const forbidden = { ok: false, error: expect.stringMatching(/permission/i) };
    expect(await actions.createProjectAction(project)).toEqual(forbidden);
    expect(await actions.updateProjectAction("x", project)).toEqual(forbidden);
    expect(await actions.setProjectActiveAction("x", false)).toEqual(forbidden);
    expect(await actions.inviteUserAction({ email: "a@sc.studio", name: "A", role: "AGENT" })).toEqual(forbidden);
    expect(await actions.setUserActiveAction("x", false)).toEqual(forbidden);
    expect(await actions.resetPasswordAction("x")).toEqual(forbidden);
    expect(await db.project.count()).toBe(0);
    expect(await db.user.count()).toBe(0);
  });

  it("createProjectAction returns field errors keyed by input name", async () => {
    const r = await actions.createProjectAction({ ...project, priceMin: "1Cr", priceMax: "80L" });
    expect(r).toEqual({ ok: false, error: expect.any(String), fieldErrors: { priceMax: "Max must be at least Min" } });
  });

  it("createProjectAction reports a duplicate slug on the slug field and revalidates on success", async () => {
    expect(await actions.createProjectAction(project)).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith("/settings", undefined);
    expect(revalidatePath).toHaveBeenCalledWith("/leads", "layout");
    expect(revalidatePath).toHaveBeenCalledWith("/pipeline", undefined);
    const r = await actions.createProjectAction(project);
    expect(r).toMatchObject({ ok: false, fieldErrors: { slug: expect.stringMatching(/already/i) } });
  });

  it("setProjectActiveAction toggles a project", async () => {
    await actions.createProjectAction(project);
    const { id } = await db.project.findFirstOrThrow();
    expect(await actions.setProjectActiveAction(id, false)).toEqual({ ok: true });
    expect((await db.project.findUniqueOrThrow({ where: { id } })).isActive).toBe(false);
  });

  it("inviteUserAction returns the temporary password but never the hash", async () => {
    const r = await actions.inviteUserAction({ email: "New@SC.studio", name: "New", role: "AGENT" });
    expect(r).toEqual({ ok: true, temporaryPassword: expect.stringMatching(/^.{12}$/) });
    const { passwordHash } = await db.user.findUniqueOrThrow({ where: { email: "new@sc.studio" } });
    expect(JSON.stringify(r)).not.toContain("passwordHash");
    expect(JSON.stringify(r)).not.toContain(passwordHash);
  });

  it("inviteUserAction reports a duplicate email on the email field", async () => {
    await actions.inviteUserAction({ email: "a@sc.studio", name: "A", role: "AGENT" });
    const r = await actions.inviteUserAction({ email: "A@sc.studio", name: "A", role: "AGENT" });
    expect(r).toMatchObject({ ok: false, fieldErrors: { email: expect.stringMatching(/already/i) } });
  });

  it("setUserActiveAction refuses to deactivate the last admin with a readable error", async () => {
    await actions.inviteUserAction({ email: "admin@sc.studio", name: "Admin", role: "ADMIN" });
    const { id } = await db.user.findFirstOrThrow();
    expect(await actions.setUserActiveAction(id, false)).toEqual({ ok: false, error: expect.stringMatching(/last/i) });
  });

  it("resetPasswordAction returns a new password and errors readably for a missing user", async () => {
    await actions.inviteUserAction({ email: "a@sc.studio", name: "A", role: "AGENT" });
    const { id } = await db.user.findFirstOrThrow();
    expect(await actions.resetPasswordAction(id)).toEqual({ ok: true, temporaryPassword: expect.any(String) });
    expect(await actions.resetPasswordAction("missing")).toEqual({ ok: false, error: expect.stringMatching(/not found/i) });
  });
});
