import { z } from "zod";
import { LeadSource } from "@/generated/prisma/client";

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
  email: z.email().optional(),
  projectSlug: z.string().optional(),
  budgetRupees: z.number().int().nonnegative().optional(),
  configuration: z.string().optional(),
  locality: z.string().optional(),
  notes: z.string().optional(),
  externalId: z.string().optional(),
  receivedAt: z.coerce.date(),
});
