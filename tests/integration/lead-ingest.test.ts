import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { ingestLead, InvalidPhoneError } from "@/lib/leads/ingest";
import { changeStage } from "@/lib/leads/service";
import type { NormalizedLead } from "@/lib/leads/types";
import { resetDb } from "../helpers/db";

const base: NormalizedLead = { source: "WEBSITE", name: "Rohan Mehta", phone: "98450 12345", receivedAt: new Date() };

describe("ingestLead", () => {
  beforeEach(resetDb);

  it("creates a lead with E.164 phone, score and CREATED event", async () => {
    const r = await ingestLead(base);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: r.leadId }, include: { events: true } });
    expect(r.deduplicated).toBe(false);
    expect(lead.phone).toBe("+919845012345");
    expect(lead.score).toBe(45);
    expect(lead.stage).toBe("NEW");
    expect(lead.events.map((e) => e.type)).toEqual(["CREATED"]);
    expect(lead.events[0].payload).toEqual({ source: "WEBSITE", score: 45 });
  });

  it("deduplicates on phone and appends DUPLICATE_INBOUND", async () => {
    const a = await ingestLead(base);
    const b = await ingestLead({ ...base, phone: "+91-98450-12345", source: "META_LEAD_AD" });
    expect(b).toEqual({ leadId: a.leadId, deduplicated: true });
    expect(await db.lead.count()).toBe(1);
    const ev = await db.leadEvent.findMany({ where: { leadId: a.leadId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(ev.map((e) => e.type)).toEqual(["CREATED", "DUPLICATE_INBOUND"]);
    expect(ev[1].payload).toMatchObject({ source: "META_LEAD_AD", phone: "+919845012345", name: "Rohan Mehta" });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: a.leadId } });
    expect(lead.nextFollowUpAt).not.toBeNull();
    expect(lead.source).toBe("WEBSITE");
    expect(await db.followUp.count({ where: { leadId: a.leadId } })).toBe(1);
    const fu = await db.followUp.findFirstOrThrow({ where: { leadId: a.leadId } });
    expect(fu).toMatchObject({ channel: "CALL", note: "Duplicate inbound from META_LEAD_AD", completedAt: null, ownerId: null });
    expect(lead.nextFollowUpAt).toEqual(fu.dueAt);
  });

  it("does not set nextFollowUpAt on a duplicate for a LOST lead", async () => {
    const actor = await db.user.create({ data: { email: "a@x.in", name: "Admin", role: "ADMIN", passwordHash: "x" } });
    const a = await ingestLead(base);
    await changeStage(a.leadId, "LOST", actor.id, { lostReason: "Not interested" });
    const b = await ingestLead({ ...base, source: "GOOGLE_ADS" });
    expect(b).toEqual({ leadId: a.leadId, deduplicated: true });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: a.leadId }, include: { events: true } });
    expect(lead.nextFollowUpAt).toBeNull();
    expect(lead.events.map((e) => e.type)).toContain("DUPLICATE_INBOUND");
    expect(await db.followUp.count({ where: { leadId: a.leadId } })).toBe(0);
  });

  it("resolves projectSlug and scores budget in range", async () => {
    const project = await db.project.create({
      data: { name: "Krishvi Triple One", slug: "krishvi-111", city: "Bengaluru", priceMinRupees: 8_000_000, priceMaxRupees: 16_000_000 },
    });
    const r = await ingestLead({ ...base, projectSlug: "krishvi-111", budgetRupees: 10_000_000 });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: r.leadId } });
    expect(lead.projectId).toBe(project.id);
    expect(lead.budgetRupees).toBe(10_000_000);
    expect(lead.score).toBe(65);
  });

  it("ignores an unknown projectSlug", async () => {
    const r = await ingestLead({ ...base, projectSlug: "nope", budgetRupees: 10_000_000 });
    const lead = await db.lead.findUniqueOrThrow({ where: { id: r.leadId } });
    expect(lead.projectId).toBeNull();
    expect(lead.score).toBe(45);
  });

  it("throws InvalidPhoneError for junk phone", async () => {
    await expect(ingestLead({ ...base, phone: "12" })).rejects.toBeInstanceOf(InvalidPhoneError);
    expect(await db.lead.count()).toBe(0);
  });
});
