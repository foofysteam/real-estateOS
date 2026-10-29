import { z } from "zod";
import { LeadSource } from "@/generated/prisma/client";
import { MAX_RUPEES } from "@/lib/money";
import { blankAsAbsent } from "@/lib/zod-helpers";

/** Spec §5.1: every inbound source maps into this shape before ingest. */
export type NormalizedLead = {
  source: LeadSource;
  name: string;
  phone: string;
  email?: string;
  projectSlug?: string;
  budgetRupees?: number;
  configuration?: string;
  locality?: string;
  notes?: string;
  externalId?: string;
  receivedAt: Date;
};

export const normalizedLeadSchema: z.ZodType<NormalizedLead> = z.object({
  source: z.enum(LeadSource),
  name: z.string().trim().min(1).max(120),
  phone: z.string().min(1),
  email: blankAsAbsent(z.email()),
  projectSlug: blankAsAbsent(z.string()),
  budgetRupees: z.number().int().nonnegative().max(MAX_RUPEES, "Budget too large").optional(),
  configuration: blankAsAbsent(z.string()),
  locality: blankAsAbsent(z.string()),
  notes: blankAsAbsent(z.string()),
  externalId: blankAsAbsent(z.string()),
  receivedAt: z.coerce.date(),
});
