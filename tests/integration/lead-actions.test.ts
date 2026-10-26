import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { resetDb } from "../helpers/db";

const currentUser = vi.hoisted(() => ({ value: null as null | { id: string; email: string; name: string; role: "AGENT" | "ADMIN" } }));

vi.mock("@/lib/auth/current-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/current-user")>();
  return { ...actual, requireUser: vi.fn(async () => currentUser.value) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { revalidatePath } = await import("next/cache");
const actions = await import("@/app/(app)/leads/[id]/actions");

describe("lead detail actions", () => {
  let agent: User;
  let other: User;
  let leadId: string;

  beforeEach(async () => {
    await resetDb();
    vi.mocked(revalidatePath).mockClear();
    agent = await db.user.create({ data: { email: "agent@x.in", name: "Agent", role: "AGENT", passwordHash: "x" } });
    other = await db.user.create({ data: { email: "other@x.in", name: "Other", role: "AGENT", passwordHash: "x" } });
    leadId = (await db.lead.create({ data: { name: "Lead", phone: "+919845012345", source: "WEBSITE" } })).id;
    currentUser.value = { id: agent.id, email: agent.email, name: agent.name, role: "AGENT" };
  });

  const lead = () => db.lead.findUniqueOrThrow({ where: { id: leadId } });

  it("changeStageAction returns a readable error on illegal transition", async () => {
    const r = await actions.changeStageAction(leadId, "LOST");
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/reason/i) });
    expect((await lead()).stage).toBe("NEW");
  });

  it("changeStageAction rejects a transition the stage rules forbid", async () => {
    await db.lead.update({ where: { id: leadId }, data: { stage: "BOOKED" } });
    const r = await actions.changeStageAction(leadId, "NEW");
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/cannot move/i) });
  });

  it("changeStageAction moves the stage and revalidates", async () => {
    expect(await actions.changeStageAction(leadId, "LOST", "Budget")).toEqual({ ok: true });
    expect(await lead()).toMatchObject({ stage: "LOST", lostReason: "Budget" });
    expect(revalidatePath).toHaveBeenCalledWith("/leads/[id]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/pipeline");
  });

  it("changeStageAction rejects an unknown stage and a missing lead", async () => {
    expect(await actions.changeStageAction(leadId, "NOPE" as never)).toMatchObject({ ok: false });
    expect(await actions.changeStageAction("missing", "CONTACTED")).toEqual({
      ok: false,
      error: expect.stringMatching(/not found/i),
    });
  });

  it("scheduleFollowUpAction defaults the owner to the lead's owner, else the actor", async () => {
    const dueAt = new Date(Date.now() + 3_600_000).toISOString();
    expect(await actions.scheduleFollowUpAction(leadId, { dueAt, channel: "CALL" })).toEqual({ ok: true });
    await db.lead.update({ where: { id: leadId }, data: { ownerId: other.id } });
    expect(await actions.scheduleFollowUpAction(leadId, { dueAt, channel: "VISIT", note: "Site" })).toEqual({ ok: true });
    const owners = await db.followUp.findMany({ orderBy: { createdAt: "asc" }, select: { ownerId: true } });
    expect(owners.map((f) => f.ownerId)).toEqual([agent.id, other.id]);
  });

  it("scheduleFollowUpAction rejects a past due time", async () => {
    const r = await actions.scheduleFollowUpAction(leadId, { dueAt: new Date(Date.now() - 60_000).toISOString(), channel: "CALL" });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/future/i) });
    expect(await db.followUp.count()).toBe(0);
  });

  it("updateFieldsAction parses a rupee budget and rejects a bad one", async () => {
    expect(await actions.updateFieldsAction(leadId, { budget: "45L", locality: "Whitefield" })).toEqual({ ok: true });
    expect(await lead()).toMatchObject({ budgetRupees: 4_500_000, locality: "Whitefield" });
    expect(await actions.updateFieldsAction(leadId, { budget: "lots" })).toEqual({
      ok: false,
      error: expect.stringMatching(/budget/i),
      field: "budget",
    });
  });

  it("updateFieldsAction rejects a budget above MAX_RUPEES as a budget field error", async () => {
    expect(await actions.updateFieldsAction(leadId, { budget: "300Cr" })).toEqual({
      ok: false,
      error: "Budget too large",
      field: "budget",
    });
    expect((await lead()).budgetRupees).toBeNull();
  });

  it("assignLeadAction assigns, unassigns and rejects an unknown user", async () => {
    expect(await actions.assignLeadAction(leadId, other.id)).toEqual({ ok: true });
    expect((await lead()).ownerId).toBe(other.id);
    expect(await actions.assignLeadAction(leadId, null)).toEqual({ ok: true });
    expect((await lead()).ownerId).toBeNull();
    expect(await actions.assignLeadAction(leadId, "ghost")).toMatchObject({ ok: false });
  });

  it("addNoteAction and logContactAction validate text", async () => {
    expect(await actions.addNoteAction(leadId, "   ")).toMatchObject({ ok: false });
    expect(await actions.addNoteAction(leadId, "Likes 3BHK")).toEqual({ ok: true });
    expect(await actions.logContactAction(leadId, "WHATSAPP")).toEqual({ ok: true });
    expect((await lead()).stage).toBe("CONTACTED");
  });

  it("completeFollowUpAction refuses another agent's follow-up", async () => {
    const fu = await db.followUp.create({ data: { leadId, ownerId: other.id, dueAt: new Date(), channel: "CALL" } });
    expect(await actions.completeFollowUpAction(fu.id)).toEqual({ ok: false, error: expect.stringMatching(/permission/i) });
    currentUser.value = { id: other.id, email: other.email, name: other.name, role: "AGENT" };
    expect(await actions.completeFollowUpAction(fu.id)).toEqual({ ok: true });
  });

  it("completeFollowUpAction lets an ADMIN complete another agent's follow-up", async () => {
    const fu = await db.followUp.create({ data: { leadId, ownerId: other.id, dueAt: new Date(), channel: "CALL" } });
    currentUser.value = { id: agent.id, email: agent.email, name: agent.name, role: "ADMIN" };
    expect(await actions.completeFollowUpAction(fu.id)).toEqual({ ok: true });
    expect((await db.followUp.findUniqueOrThrow({ where: { id: fu.id } })).completedAt).not.toBeNull();
  });
});
