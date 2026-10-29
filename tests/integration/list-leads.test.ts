import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import type { LeadSource, LeadStage } from "@/generated/prisma/client";
import { listLeads, parseLeadFilters } from "@/lib/leads/queries";
import { resetDb } from "../helpers/db";

let phoneSeq = 0;
function nextPhone(): string {
  phoneSeq += 1;
  return `+9170000${String(10000 + phoneSeq).slice(-5)}`;
}

async function makeLead(
  opts: {
    name?: string;
    phone?: string;
    stage?: LeadStage;
    source?: LeadSource;
    ownerId?: string | null;
    score?: number;
    createdAt?: Date;
  } = {},
) {
  return db.lead.create({
    data: {
      name: opts.name ?? "Lead",
      phone: opts.phone ?? nextPhone(),
      source: opts.source ?? "WEBSITE",
      stage: opts.stage ?? "NEW",
      score: opts.score ?? 0,
      ownerId: opts.ownerId ?? null,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

describe("listLeads", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("filters by stage and source", async () => {
    const match = await makeLead({ name: "Match", stage: "QUALIFIED", source: "REFERRAL" });
    await makeLead({ name: "Wrong stage", stage: "NEW", source: "REFERRAL" });
    await makeLead({ name: "Wrong source", stage: "QUALIFIED", source: "WEBSITE" });

    expect((await listLeads({ stage: "QUALIFIED", source: "REFERRAL" })).items.map((i) => i.id)).toEqual([match.id]);
    expect((await listLeads({ stage: "QUALIFIED" })).items).toHaveLength(2);
    expect((await listLeads({ source: "REFERRAL" })).items).toHaveLength(2);
  });

  it("q matches name case-insensitively and phone digits", async () => {
    await makeLead({ name: "Rohan", phone: "+919845012345" });
    await makeLead({ name: "Priya", phone: "+919900011122" });

    expect((await listLeads({ q: "roh" })).items.map((i) => i.name)).toEqual(["Rohan"]);
    expect((await listLeads({ q: "98450" })).items).toHaveLength(1);
    expect((await listLeads({ q: "984-50" })).items.map((i) => i.name)).toEqual(["Rohan"]);
    expect((await listLeads({ q: "nobody" })).items).toHaveLength(0);
  });

  it("pages by cursor without overlap", async () => {
    const base = Date.parse("2026-10-01T00:00:00Z");
    // Pairs share a createdAt so the id tie-breaker is exercised across the page boundary.
    for (let i = 0; i < 35; i++) await makeLead({ createdAt: new Date(base + Math.floor(i / 2) * 60_000) });

    const p1 = await listLeads({}, undefined, 30);
    const p2 = await listLeads({}, p1.nextCursor!, 30);

    expect(p1.items).toHaveLength(30);
    expect(p1.nextCursor).toBe(p1.items[29].id);
    expect(p2.items).toHaveLength(5);
    expect(p2.nextCursor).toBeNull();
    expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(35);
  });

  it("returns nextCursor null when a page is exactly full", async () => {
    for (let i = 0; i < 3; i++) await makeLead();
    const p = await listLeads({}, undefined, 3);
    expect(p.items).toHaveLength(3);
    expect(p.nextCursor).toBeNull();
  });

  it("sorts by score desc when sort=score, newest first by default", async () => {
    const low = await makeLead({ score: 10, createdAt: new Date("2026-10-03T00:00:00Z") });
    const high = await makeLead({ score: 90, createdAt: new Date("2026-10-01T00:00:00Z") });
    const mid = await makeLead({ score: 50, createdAt: new Date("2026-10-02T00:00:00Z") });

    expect((await listLeads({ sort: "score" })).items.map((i) => i.id)).toEqual([high.id, mid.id, low.id]);
    expect((await listLeads({})).items.map((i) => i.id)).toEqual([low.id, mid.id, high.id]);
  });

  it("ownerId=unassigned returns only null owners", async () => {
    const agent = await db.user.create({ data: { email: "a@x.in", name: "Agent", role: "AGENT", passwordHash: "x" } });
    const owned = await makeLead({ name: "Owned", ownerId: agent.id });
    const unowned = await makeLead({ name: "Unowned", ownerId: null });

    expect((await listLeads({ ownerId: "unassigned" })).items.map((i) => i.id)).toEqual([unowned.id]);
    const mine = await listLeads({ ownerId: agent.id });
    expect(mine.items.map((i) => i.id)).toEqual([owned.id]);
    expect(mine.items[0].owner).toEqual({ id: agent.id, name: "Agent" });
  });
});

describe("parseLeadFilters", () => {
  it("parses URLSearchParams and defaults sort to created", () => {
    expect(parseLeadFilters(new URLSearchParams("stage=QUALIFIED&q=roh"))).toEqual({
      stage: "QUALIFIED",
      q: "roh",
      sort: "created",
    });
  });

  it("drops invalid or empty values instead of throwing", () => {
    expect(parseLeadFilters({ stage: "BOGUS", source: "WEBSITE", sort: "nope", q: "  " })).toEqual({
      source: "WEBSITE",
      sort: "created",
    });
    expect(parseLeadFilters({ stage: ["QUALIFIED", "NEW"] })).toEqual({ stage: "QUALIFIED", sort: "created" });
  });
});
