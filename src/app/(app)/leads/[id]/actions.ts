"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { FollowUpChannel, LeadStage } from "@/generated/prisma/enums";
import { ForbiddenError, requireUser } from "@/lib/auth/current-user";
import { MAX_RUPEES, parseRupees } from "@/lib/money";
import type { ActionResult } from "@/lib/use-action";
import {
  addNote,
  assertCanCompleteFollowUp,
  assignLead,
  changeStage,
  completeFollowUp,
  InvalidTransitionError,
  LeadNotFoundError,
  logContact,
  LostReasonRequiredError,
  scheduleFollowUp,
  updateLeadFields,
  type LeadFieldPatch,
} from "@/lib/leads/service";


class ActionError extends Error {}

const DOMAIN_ERRORS = [InvalidTransitionError, LostReasonRequiredError, LeadNotFoundError, ActionError];

/** Validation and domain failures become readable results; anything unexpected still throws. */
async function run(work: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await work();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: "You don't have permission to do that" };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Invalid input" };
    if (DOMAIN_ERRORS.some((E) => err instanceof E)) return { ok: false, error: (err as Error).message };
    throw err;
  }
  revalidatePath("/leads/[id]", "page");
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/today");
  return { ok: true };
}

const id = z.string().min(1).max(64);
const noteText = z.string().trim().min(1, "Write something first").max(2000, "Keep it under 2000 characters");
const optionalNote = z
  .string()
  .trim()
  .max(2000, "Keep the note under 2000 characters")
  .optional()
  .transform((v) => v || undefined);
/** "" clears an optional text field. */
const clearable = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v === "" ? null : v));

export async function changeStageAction(leadId: string, to: LeadStage, lostReason?: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const input = z
      .object({
        leadId: id,
        to: z.enum(LeadStage, "Pick a stage"),
        lostReason: z.string().trim().max(200, "Keep the reason under 200 characters").optional(),
      })
      .parse({ leadId, to, lostReason });
    await changeStage(input.leadId, input.to, user.id, { lostReason: input.lostReason || undefined });
  });
}

export async function assignLeadAction(leadId: string, ownerId: string | null): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const input = z.object({ leadId: id, ownerId: id.nullable() }).parse({ leadId, ownerId });
    if (input.ownerId) {
      const owner = await db.user.findFirst({ where: { id: input.ownerId, isActive: true }, select: { id: true } });
      if (!owner) throw new ActionError("That user is not available");
    }
    await assignLead(input.leadId, input.ownerId, user.id);
  });
}

export async function addNoteAction(leadId: string, text: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const input = z.object({ leadId: id, text: noteText }).parse({ leadId, text });
    await addNote(input.leadId, input.text, user.id);
  });
}

export async function logContactAction(leadId: string, channel: FollowUpChannel, note?: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const input = z
      .object({ leadId: id, channel: z.enum(FollowUpChannel, "Pick a channel"), note: optionalNote })
      .parse({ leadId, channel, note });
    await logContact(input.leadId, input.channel, input.note, user.id);
  });
}

export async function scheduleFollowUpAction(
  leadId: string,
  followUp: { dueAt: string; channel: FollowUpChannel; note?: string },
): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const input = z
      .object({
        leadId: id,
        dueAt: z.iso
          .datetime({ offset: true, error: "Pick a date and time" })
          .transform((s) => new Date(s))
          .refine((d) => d.getTime() >= Date.now() + 60_000, "Pick a time in the future"),
        channel: z.enum(FollowUpChannel, "Pick a channel"),
        note: optionalNote,
      })
      .parse({ leadId, ...followUp });
    const lead = await db.lead.findUnique({ where: { id: input.leadId }, select: { ownerId: true } });
    if (!lead) throw new LeadNotFoundError(input.leadId);
    const { dueAt, channel, note } = input;
    await scheduleFollowUp(input.leadId, { dueAt, channel, note, ownerId: lead.ownerId ?? user.id }, user.id);
  });
}

export type FieldsPatch = {
  name?: string;
  email?: string | null;
  budget?: string | null;
  configuration?: string | null;
  locality?: string | null;
  projectId?: string | null;
};

const patchSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Keep the name under 120 characters").optional(),
  email: z
    .union([z.literal(""), z.email("Enter a valid email")])
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  budget: clearable(40).transform((v, ctx) => {
    if (v == null) return v;
    const rupees = parseRupees(v);
    if (rupees == null) ctx.addIssue({ code: "custom", message: "Enter a budget like 45L or 1.2Cr" });
    else if (rupees > MAX_RUPEES) ctx.addIssue({ code: "custom", message: "Budget too large" });
    return rupees ?? undefined;
  }),
  configuration: clearable(60),
  locality: clearable(120),
  projectId: clearable(64),
});

export async function updateFieldsAction(leadId: string, patch: FieldsPatch): Promise<ActionResult> {
  const user = await requireUser();
  // Field-level validation comes back with the field it belongs to so the sheet can show it in place.
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input", field: issue ? String(issue.path[0]) : undefined };
  }
  return run(async () => {
    const { budget, ...rest } = parsed.data;
    const leadIdOk = id.parse(leadId);
    if (rest.projectId) {
      const project = await db.project.findUnique({ where: { id: rest.projectId }, select: { id: true } });
      if (!project) throw new ActionError("That project does not exist");
    }
    const clean: LeadFieldPatch = { ...rest, budgetRupees: budget };
    if (Object.values(clean).every((v) => v === undefined)) return; // nothing changed
    await updateLeadFields(leadIdOk, clean, user.id);
  });
}

export async function completeFollowUpAction(followUpId: string): Promise<ActionResult> {
  const user = await requireUser();
  return run(async () => {
    const followUp = await db.followUp.findUnique({ where: { id: id.parse(followUpId) }, select: { ownerId: true } });
    if (!followUp) throw new ActionError("Follow-up not found");
    assertCanCompleteFollowUp(followUp, user);
    await completeFollowUp(followUpId, user.id);
  });
}
