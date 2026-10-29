import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import type { LeadStage, User } from "@/generated/prisma/client";
import { getTodayBoard } from "@/lib/leads/queries";
import { resetDb } from "../helpers/db";

// 2026-10-26T06:00:00Z = 11:30 IST on 26 Oct.
const NOW = new Date("2026-10-26T06:00:00Z");

let phoneSeq = 0;
function nextPhone(): string {
  phoneSeq += 1;
  return `+9198450${String(10000 + phoneSeq).slice(-5)}`;
}

async function makeLead(opts: { ownerId?: string | null; stage?: LeadStage; createdAt?: Date; name?: string } = {}) {
  return db.lead.create({
    data: {
      name: opts.name ?? "Lead",
      phone: nextPhone(),
      source: "WEBSITE",
      stage: opts.stage ?? "CONTACTED",
      ownerId: opts.ownerId ?? null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

async function makeFollowUp(leadId: string, ownerId: string | null, dueAt: string, completedAt?: string) {
  return db.followUp.create({
    data: {
      leadId,
      ownerId,
      dueAt: new Date(dueAt),
      channel: "CALL",
      completedAt: completedAt ? new Date(completedAt) : null,
    },
  });
}

describe("getTodayBoard", () => {
  let admin: User;
  let agent: User;
  let otherAgent: User;

  beforeEach(async () => {
    await resetDb();
    admin = await db.user.create({ data: { email: "admin@x.in", name: "Admin", role: "ADMIN", passwordHash: "x" } });
    agent = await db.user.create({ data: { email: "agent@x.in", name: "Agent", role: "AGENT", passwordHash: "x" } });
    otherAgent = await db.user.create({ data: { email: "other@x.in", name: "Other", role: "AGENT", passwordHash: "x" } });
  });

  it("buckets overdue (yesterday), due today (IST), and excludes tomorrow and completed", async () => {
    const lead = await makeLead({ ownerId: agent.id });
    const overdue = await makeFollowUp(lead.id, agent.id, "2026-10-25T10:00:00Z");
    const today = await makeFollowUp(lead.id, agent.id, "2026-10-26T12:00:00Z"); // 17:30 IST
    await makeFollowUp(lead.id, agent.id, "2026-10-27T01:00:00Z"); // 06:30 IST tomorrow
    await makeFollowUp(lead.id, agent.id, "2026-10-26T08:00:00Z", "2026-10-26T05:00:00Z"); // completed today

    const b = await getTodayBoard({ id: agent.id, role: "AGENT" }, NOW);

    expect(b.overdue).toHaveLength(1);
    expect(b.dueToday).toHaveLength(1);
    expect(b.overdue[0].id).toBe(overdue.id);
    expect(b.dueToday[0].id).toBe(today.id);
    expect(b.dueToday[0].lead.id).toBe(lead.id);
  });

  it("uses IST day boundaries across the UTC midnight gap", async () => {
    const lead = await makeLead({ ownerId: agent.id });
    // 2026-10-25T18:29:59Z = 23:59:59 IST on 25 Oct -> overdue
    const lastSecondYesterday = await makeFollowUp(lead.id, agent.id, "2026-10-25T18:29:59Z");
    // 2026-10-25T18:30:00Z = 00:00 IST on 26 Oct -> due today (although still 25 Oct in UTC)
    const firstSecondToday = await makeFollowUp(lead.id, agent.id, "2026-10-25T18:30:00Z");
    // 2026-10-26T18:29:59Z = 23:59:59 IST on 26 Oct -> due today
    const lastSecondToday = await makeFollowUp(lead.id, agent.id, "2026-10-26T18:29:59Z");
    // 2026-10-26T18:30:00Z = 00:00 IST on 27 Oct -> excluded (still 26 Oct in UTC)
    await makeFollowUp(lead.id, agent.id, "2026-10-26T18:30:00Z");

    // now = 2026-10-25T20:00:00Z is already 26 Oct 01:30 IST.
    const b = await getTodayBoard({ id: agent.id, role: "AGENT" }, new Date("2026-10-25T20:00:00Z"));

    expect(b.overdue.map((f) => f.id)).toEqual([lastSecondYesterday.id]);
    expect(b.dueToday.map((f) => f.id)).toEqual([firstSecondToday.id, lastSecondToday.id]);
  });

  it("excludes follow-ups on BOOKED and LOST leads", async () => {
    const booked = await makeLead({ ownerId: agent.id, stage: "BOOKED" });
    const lost = await makeLead({ ownerId: agent.id, stage: "LOST" });
    await makeFollowUp(booked.id, agent.id, "2026-10-26T12:00:00Z");
    await makeFollowUp(lost.id, agent.id, "2026-10-25T12:00:00Z");

    const b = await getTodayBoard({ id: agent.id, role: "AGENT" }, NOW);

    expect(b.overdue).toHaveLength(0);
    expect(b.dueToday).toHaveLength(0);
  });

  it("AGENT sees only own follow-ups and own NEW leads; ADMIN sees all follow-ups and unassigned NEW leads", async () => {
    const mine = await makeLead({ ownerId: agent.id, name: "Mine" });
    const theirs = await makeLead({ ownerId: otherAgent.id, name: "Theirs" });
    const dup = await makeLead({ ownerId: null, name: "Duplicate inbound" });
    const myFu = await makeFollowUp(mine.id, agent.id, "2026-10-26T12:00:00Z");
    const theirFu = await makeFollowUp(theirs.id, otherAgent.id, "2026-10-26T12:00:00Z");
    const unownedFu = await makeFollowUp(dup.id, null, "2026-10-25T12:00:00Z");

    const myNew = await makeLead({ ownerId: agent.id, stage: "NEW", name: "My new" });
    await makeLead({ ownerId: otherAgent.id, stage: "NEW", name: "Their new" });
    const unassignedOld = await makeLead({ ownerId: null, stage: "NEW", createdAt: new Date("2026-10-24T00:00:00Z") });
    const unassignedNew = await makeLead({ ownerId: null, stage: "NEW", createdAt: new Date("2026-10-26T05:00:00Z") });
    await makeLead({ ownerId: null, stage: "CONTACTED", name: "Unassigned contacted" });

    const a = await getTodayBoard({ id: agent.id, role: "AGENT" }, NOW);
    expect(a.overdue).toHaveLength(0);
    expect(a.dueToday.map((f) => f.id)).toEqual([myFu.id]);
    expect(a.newLeads.map((l) => l.id)).toEqual([myNew.id]);

    const ad = await getTodayBoard({ id: admin.id, role: "ADMIN" }, NOW);
    expect(ad.overdue.map((f) => f.id)).toEqual([unownedFu.id]);
    expect(ad.dueToday.map((f) => f.id).sort()).toEqual([myFu.id, theirFu.id].sort());
    expect(ad.newLeads.map((l) => l.id)).toEqual([unassignedNew.id, unassignedOld.id]);
  });

  it("caps newLeads at 50", async () => {
    for (let i = 0; i < 52; i++) await makeLead({ ownerId: agent.id, stage: "NEW" });
    const b = await getTodayBoard({ id: agent.id, role: "AGENT" }, NOW);
    expect(b.newLeads).toHaveLength(50);
  });
});
