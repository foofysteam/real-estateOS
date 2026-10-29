import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { normalizePhone } from "@/lib/phone";
import { computeScore } from "@/lib/score";
import { isTerminal } from "@/lib/stages";
import { recomputeNextFollowUp } from "./service";
import type { NormalizedLead } from "./types";

export class InvalidPhoneError extends Error {
  constructor(raw: string) {
    super(`Invalid phone number: "${raw}"`);
    this.name = "InvalidPhoneError";
  }
}

export type IngestResult = { leadId: string; deduplicated: boolean };

/** Create a lead, or record a duplicate inbound on the existing lead with the same E.164 phone. */
export async function ingestLead(input: NormalizedLead, actorId?: string): Promise<IngestResult> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new InvalidPhoneError(input.phone);
  try {
    return await ingestOnce(input, phone, actorId);
  } catch (err) {
    // A concurrent ingest created the same phone between our lookup and insert: retry as a duplicate.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return ingestOnce(input, phone, actorId);
    }
    throw err;
  }
}

function ingestOnce(input: NormalizedLead, phone: string, actorId?: string): Promise<IngestResult> {
  return db.$transaction(async (tx) => {
    const existing = await tx.lead.findUnique({ where: { phone } });
    if (existing) {
      const payload = { ...input, phone, receivedAt: input.receivedAt.toISOString() } as Prisma.InputJsonObject;
      await tx.leadEvent.create({ data: { leadId: existing.id, actorId, type: "DUPLICATE_INBOUND", payload } });
      if (!isTerminal(existing.stage)) {
        await tx.followUp.create({
          data: {
            leadId: existing.id,
            ownerId: existing.ownerId,
            dueAt: new Date(),
            channel: "CALL",
            note: `Duplicate inbound from ${input.source}`,
          },
        });
        await recomputeNextFollowUp(tx, existing.id);
      }
      return { leadId: existing.id, deduplicated: true };
    }

    const project = input.projectSlug ? await tx.project.findUnique({ where: { slug: input.projectSlug } }) : null;
    const score = computeScore({ ...input, project });
    const lead = await tx.lead.create({
      data: {
        name: input.name,
        phone,
        email: input.email,
        source: input.source,
        score,
        projectId: project?.id,
        budgetRupees: input.budgetRupees,
        configuration: input.configuration,
        locality: input.locality,
        notes: input.notes,
        events: { create: { actorId, type: "CREATED", payload: { source: input.source, score } } },
      },
    });
    return { leadId: lead.id, deduplicated: false };
  });
}
