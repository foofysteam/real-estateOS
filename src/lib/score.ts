import type { LeadSource } from "@/generated/prisma/client";

export type ScoreInput = {
  source: LeadSource;
  budgetRupees?: number | null;
  configuration?: string | null;
  locality?: string | null;
  email?: string | null;
  project?: { priceMinRupees: number; priceMaxRupees: number } | null;
};

// Spec §4.2.
const SOURCE_BASE: Record<LeadSource, number> = {
  META_LEAD_AD: 40,
  WEBSITE: 45,
  GOOGLE_ADS: 45,
  PORTAL_99ACRES: 35,
  PORTAL_MAGICBRICKS: 35,
  PORTAL_HOUSING: 35,
  WALK_IN: 60,
  REFERRAL: 65,
  CSV_IMPORT: 20,
};

const isPresent = (value: string | null | undefined): boolean => !!value && value.trim() !== "";

/** Deterministic 0..100 lead score. */
export function computeScore(input: ScoreInput): number {
  const { budgetRupees, project } = input;
  let score = SOURCE_BASE[input.source];
  if (budgetRupees != null && project && budgetRupees >= project.priceMinRupees && budgetRupees <= project.priceMaxRupees) {
    score += 20;
  }
  if (isPresent(input.configuration)) score += 10;
  if (isPresent(input.locality)) score += 10;
  if (isPresent(input.email)) score += 5;
  return Math.min(100, Math.max(0, score));
}
