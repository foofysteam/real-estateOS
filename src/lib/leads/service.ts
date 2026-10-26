import { db } from "@/lib/db";
import type { FollowUp, FollowUpChannel, Lead, LeadEvent, LeadStage, Prisma, Role } from "@/generated/prisma/client";
import { ForbiddenError } from "@/lib/auth/current-user";
import { computeScore } from "@/lib/score";
import { canTransition, isTerminal } from "@/lib/stages";

type Tx = Prisma.TransactionClient;

export class InvalidTransitionError extends Error {
  constructor(from: LeadStage, to: LeadStage) {
    super(`Cannot move a lead from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class LostReasonRequiredError extends Error {
  constructor() {
    super("A reason is required to mark a lead as LOST");
    this.name = "LostReasonRequiredError";
  }
}

export class LeadNotFoundError extends Error {
  constructor(id: string) {
    super(`Lead not found: ${id}`);
    this.name = "LeadNotFoundError";
  }
}

export class LeadClosedError extends Error {
  constructor() {
    super("Lead is closed");
    this.name = "LeadClosedError";
  }
}

async function findLead(tx: Tx, leadId: string): Promise<Lead> {
  const lead = await tx.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadNotFoundError(leadId);
  return lead;
}

/**
 * Keeps the invariant: lead.nextFollowUpAt is the earliest dueAt among open follow-ups, or null.
 * Internal to the leads module (also used by the ingest dedupe path).
 */
export async function recomputeNextFollowUp(tx: Tx, leadId: string): Promise<Lead> {
  const next = await tx.followUp.findFirst({
    where: { leadId, completedAt: null },
    orderBy: { dueAt: "asc" },
    select: { dueAt: true },
  });
  return tx.lead.update({ where: { id: leadId }, data: { nextFollowUpAt: next?.dueAt ?? null } });
}

export function changeStage(
  leadId: string,
  to: LeadStage,
  actorId: string,
  opts: { lostReason?: string } = {},
): Promise<Lead> {
  return db.$transaction(async (tx) => {
    const lead = await findLead(tx, leadId);
    if (!canTransition(lead.stage, to)) throw new InvalidTransitionError(lead.stage, to);
    const lostReason = opts.lostReason?.trim();
    if (to === "LOST" && !lostReason) throw new LostReasonRequiredError();
    const payload = to === "LOST" ? { from: lead.stage, to, lostReason } : { from: lead.stage, to };
    await tx.leadEvent.create({ data: { leadId, actorId, type: "STAGE_CHANGED", payload } });
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: { stage: to, lostReason: to === "LOST" ? lostReason : null },
    });
    if (!isTerminal(to)) return updated;
    await tx.followUp.updateMany({ where: { leadId, completedAt: null }, data: { completedAt: new Date() } });
    return recomputeNextFollowUp(tx, leadId);
  });
}

export function assignLead(leadId: string, ownerId: string | null, actorId: string): Promise<Lead> {
  return db.$transaction(async (tx) => {
    const lead = await findLead(tx, leadId);
    await tx.leadEvent.create({
      data: { leadId, actorId, type: "ASSIGNED", payload: { from: lead.ownerId, to: ownerId } },
    });
    return tx.lead.update({ where: { id: leadId }, data: { ownerId } });
  });
}

export async function addNote(leadId: string, text: string, actorId: string): Promise<LeadEvent> {
  await findLead(db, leadId);
  return db.leadEvent.create({ data: { leadId, actorId, type: "NOTE_ADDED", payload: { text } } });
}

export type LeadFieldPatch = Partial<
  Pick<Lead, "name" | "email" | "budgetRupees" | "configuration" | "locality" | "projectId">
>;

export function updateLeadFields(leadId: string, patch: LeadFieldPatch, actorId: string): Promise<Lead> {
  return db.$transaction(async (tx) => {
    const lead = await findLead(tx, leadId);
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as LeadFieldPatch;
    const fields = Object.keys(clean);
    const merged = { ...lead, ...clean };
    const project = merged.projectId ? await tx.project.findUnique({ where: { id: merged.projectId } }) : null;
    const score = computeScore({ ...merged, project });
    await tx.leadEvent.create({ data: { leadId, actorId, type: "FIELD_UPDATED", payload: { fields } } });
    if (score !== lead.score) {
      await tx.leadEvent.create({
        data: { leadId, actorId, type: "SCORE_CHANGED", payload: { from: lead.score, to: score } },
      });
    }
    return tx.lead.update({ where: { id: leadId }, data: { ...clean, score } });
  });
}

export function logContact(
  leadId: string,
  channel: FollowUpChannel,
  note: string | undefined,
  actorId: string,
): Promise<Lead> {
  return db.$transaction(async (tx) => {
    const lead = await findLead(tx, leadId);
    await tx.leadEvent.create({ data: { leadId, actorId, type: "CONTACT_LOGGED", payload: { channel, note } } });
    const moveToContacted = lead.stage === "NEW";
    if (moveToContacted) {
      await tx.leadEvent.create({
        data: { leadId, actorId, type: "STAGE_CHANGED", payload: { from: "NEW", to: "CONTACTED" } },
      });
    }
    return tx.lead.update({
      where: { id: leadId },
      data: { lastContactedAt: new Date(), ...(moveToContacted && { stage: "CONTACTED" }) },
    });
  });
}

export function scheduleFollowUp(
  leadId: string,
  input: { dueAt: Date; channel: FollowUpChannel; note?: string; ownerId: string },
  actorId: string,
): Promise<FollowUp> {
  return db.$transaction(async (tx) => {
    await findLead(tx, leadId);
    const followUp = await tx.followUp.create({ data: { leadId, ...input } });
    await tx.leadEvent.create({
      data: {
        leadId,
        actorId,
        type: "FOLLOW_UP_SCHEDULED",
        payload: { followUpId: followUp.id, dueAt: followUp.dueAt.toISOString(), channel: followUp.channel },
      },
    });
    await recomputeNextFollowUp(tx, leadId);
    return followUp;
  });
}

/** Unowned follow-ups (duplicate-inbound leads) are anyone's; owned ones belong to their owner or an ADMIN. */
export function assertCanCompleteFollowUp(
  followUp: { ownerId: string | null },
  user: { id: string; role: Role },
): void {
  if (followUp.ownerId !== null && followUp.ownerId !== user.id && user.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

export function completeFollowUp(followUpId: string, actorId: string): Promise<FollowUp> {
  return db.$transaction(async (tx) => {
    const existing = await tx.followUp.findUniqueOrThrow({ where: { id: followUpId } });
    if (existing.completedAt) return existing;
    const followUp = await tx.followUp.update({ where: { id: followUpId }, data: { completedAt: new Date() } });
    await tx.leadEvent.create({
      data: { leadId: followUp.leadId, actorId, type: "FOLLOW_UP_COMPLETED", payload: { followUpId } },
    });
    await recomputeNextFollowUp(tx, followUp.leadId);
    return followUp;
  });
}
