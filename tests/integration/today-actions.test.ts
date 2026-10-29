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

const { completeFollowUpAction } = await import("@/app/(app)/today/actions");

describe("completeFollowUpAction", () => {
  let agent: User;
  let otherAgent: User;
  let leadId: string;

  beforeEach(async () => {
    await resetDb();
    agent = await db.user.create({ data: { email: "agent@x.in", name: "Agent", role: "AGENT", passwordHash: "x" } });
    otherAgent = await db.user.create({ data: { email: "other@x.in", name: "Other", role: "AGENT", passwordHash: "x" } });
    leadId = (
      await db.lead.create({ data: { name: "Lead", phone: "+919845012345", source: "WEBSITE", stage: "CONTACTED" } })
    ).id;
    currentUser.value = { id: agent.id, email: agent.email, name: agent.name, role: "AGENT" };
  });

  function followUp(ownerId: string | null) {
    return db.followUp.create({ data: { leadId, ownerId, dueAt: new Date(), channel: "CALL" } });
  }

  async function completedAt(id: string) {
    return (await db.followUp.findUniqueOrThrow({ where: { id } })).completedAt;
  }

  it("completes the agent's own follow-up", async () => {
    const fu = await followUp(agent.id);
    expect(await completeFollowUpAction(fu.id)).toEqual({ ok: true });
    expect(await completedAt(fu.id)).not.toBeNull();
  });

  it("refuses another agent's follow-up with a readable error and leaves it open", async () => {
    const fu = await followUp(otherAgent.id);
    expect(await completeFollowUpAction(fu.id)).toEqual({ ok: false, error: "You don't have permission to do that" });
    expect(await completedAt(fu.id)).toBeNull();
  });

  it("completes an unowned follow-up", async () => {
    const fu = await followUp(null);
    expect(await completeFollowUpAction(fu.id)).toEqual({ ok: true });
    expect(await completedAt(fu.id)).not.toBeNull();
  });

  it("returns a readable error for a missing follow-up", async () => {
    expect(await completeFollowUpAction("missing")).toEqual({ ok: false, error: "Follow-up not found" });
  });
});
