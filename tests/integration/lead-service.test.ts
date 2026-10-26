import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { ingestLead } from "@/lib/leads/ingest";
import {
  addNote,
  assignLead,
  changeStage,
  completeFollowUp,
  InvalidTransitionError,
  LeadNotFoundError,
  logContact,
  LostReasonRequiredError,
  scheduleFollowUp,
  updateLeadFields,
} from "@/lib/leads/service";
import { resetDb } from "../helpers/db";

const DAY = 24 * 60 * 60 * 1000;

function lastEvent(leadId: string) {
  return db.leadEvent.findFirstOrThrow({ where: { leadId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}

function eventsOf(leadId: string) {
  return db.leadEvent.findMany({ where: { leadId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}

describe("lead service", () => {
  let actor: User;
  let agent: User;
  let leadId: string;

  beforeEach(async () => {
    await resetDb();
    actor = await db.user.create({ data: { email: "admin@x.in", name: "Admin", role: "ADMIN", passwordHash: "x" } });
    agent = await db.user.create({ data: { email: "agent@x.in", name: "Agent", role: "AGENT", passwordHash: "x" } });
    ({ leadId } = await ingestLead({ source: "WEBSITE", name: "Rohan Mehta", phone: "98450 12345", receivedAt: new Date() }));
  });

  it("moves forward and records STAGE_CHANGED with from/to", async () => {
    const l = await changeStage(leadId, "QUALIFIED", actor.id);
    expect(l.stage).toBe("QUALIFIED");
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).stage).toBe("QUALIFIED");
    const ev = await lastEvent(leadId);
    expect(ev.type).toBe("STAGE_CHANGED");
    expect(ev.actorId).toBe(actor.id);
    expect(ev.payload).toEqual({ from: "NEW", to: "QUALIFIED" });
  });

  it("rejects two steps back", async () => {
    await changeStage(leadId, "QUALIFIED", actor.id);
    await expect(changeStage(leadId, "NEW", actor.id)).rejects.toBeInstanceOf(InvalidTransitionError);
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).stage).toBe("QUALIFIED");
  });

  it("requires lostReason for LOST", async () => {
    await expect(changeStage(leadId, "LOST", actor.id)).rejects.toBeInstanceOf(LostReasonRequiredError);
    const l = await changeStage(leadId, "LOST", actor.id, { lostReason: "Budget" });
    expect(l.lostReason).toBe("Budget");
    expect(l.stage).toBe("LOST");
    expect((await lastEvent(leadId)).payload).toEqual({ from: "NEW", to: "LOST", lostReason: "Budget" });
  });

  it("throws LeadNotFoundError for a missing lead", async () => {
    await expect(changeStage("missing", "CONTACTED", actor.id)).rejects.toBeInstanceOf(LeadNotFoundError);
  });

  it("assigns and unassigns with ASSIGNED events", async () => {
    const assigned = await assignLead(leadId, agent.id, actor.id);
    expect(assigned.ownerId).toBe(agent.id);
    const unassigned = await assignLead(leadId, null, actor.id);
    expect(unassigned.ownerId).toBeNull();
    const events = await eventsOf(leadId);
    const assignedEvents = events.filter((e) => e.type === "ASSIGNED");
    expect(assignedEvents).toHaveLength(2);
    expect(assignedEvents.map((e) => e.payload)).toEqual([
      { from: null, to: agent.id },
      { from: agent.id, to: null },
    ]);
  });

  it("addNote stores text in payload.text", async () => {
    const e = await addNote(leadId, "Prefers east facing", actor.id);
    expect(e.type).toBe("NOTE_ADDED");
    expect(e.payload).toEqual({ text: "Prefers east facing" });
    expect((await lastEvent(leadId)).id).toBe(e.id);
  });

  it("updateLeadFields recomputes score and emits SCORE_CHANGED", async () => {
    await updateLeadFields(leadId, { configuration: "3BHK" }, actor.id);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.configuration).toBe("3BHK");
    expect(lead.score).toBe(55);
    const events = await eventsOf(leadId);
    const types = events.map((e) => e.type);
    expect(types).toContain("FIELD_UPDATED");
    expect(types).toContain("SCORE_CHANGED");
    expect(events.find((e) => e.type === "FIELD_UPDATED")?.payload).toEqual({ fields: ["configuration"] });
    expect(events.find((e) => e.type === "SCORE_CHANGED")?.payload).toEqual({ from: 45, to: 55 });
  });

  it("updateLeadFields skips SCORE_CHANGED when the score is unchanged", async () => {
    await updateLeadFields(leadId, { name: "Rohan M" }, actor.id);
    const types = (await eventsOf(leadId)).map((e) => e.type);
    expect(types).toEqual(["CREATED", "FIELD_UPDATED"]);
  });

  it("logContact moves NEW to CONTACTED and sets lastContactedAt", async () => {
    const l = await logContact(leadId, "CALL", "Picked up, call back", actor.id);
    expect(l.stage).toBe("CONTACTED");
    expect(l.lastContactedAt).not.toBeNull();
    const stored = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(stored.stage).toBe("CONTACTED");
    const events = await eventsOf(leadId);
    expect(events.find((e) => e.type === "CONTACT_LOGGED")?.payload).toEqual({ channel: "CALL", note: "Picked up, call back" });
    expect(events.find((e) => e.type === "STAGE_CHANGED")?.payload).toEqual({ from: "NEW", to: "CONTACTED" });

    await changeStage(leadId, "QUALIFIED", actor.id);
    const again = await logContact(leadId, "WHATSAPP", undefined, actor.id);
    expect(again.stage).toBe("QUALIFIED");
  });

  it("scheduleFollowUp sets nextFollowUpAt to earliest open; completeFollowUp advances it", async () => {
    const now = Date.now();
    const in2 = new Date(now + 2 * DAY);
    const in1 = new Date(now + 1 * DAY);
    const f2 = await scheduleFollowUp(leadId, { dueAt: in2, channel: "CALL", ownerId: agent.id }, actor.id);
    const f1 = await scheduleFollowUp(leadId, { dueAt: in1, channel: "WHATSAPP", note: "Send brochure", ownerId: agent.id }, actor.id);
    expect(f1.ownerId).toBe(agent.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).nextFollowUpAt).toEqual(in1);
    expect((await lastEvent(leadId)).payload).toEqual({ followUpId: f1.id, dueAt: in1.toISOString(), channel: "WHATSAPP" });

    const done = await completeFollowUp(f1.id, actor.id);
    expect(done.completedAt).not.toBeNull();
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).nextFollowUpAt).toEqual(in2);
    expect((await lastEvent(leadId)).payload).toEqual({ followUpId: f1.id });

    await completeFollowUp(f2.id, actor.id);
    expect((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).nextFollowUpAt).toBeNull();
    const types = (await eventsOf(leadId)).map((e) => e.type);
    expect(types.filter((t) => t === "FOLLOW_UP_SCHEDULED")).toHaveLength(2);
    expect(types.filter((t) => t === "FOLLOW_UP_COMPLETED")).toHaveLength(2);
  });
});
