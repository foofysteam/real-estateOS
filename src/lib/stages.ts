import type { LeadStage } from "@/generated/prisma/client";

export const STAGE_ORDER: readonly LeadStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT_DONE",
  "NEGOTIATION",
  "BOOKED",
  "LOST",
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  SITE_VISIT_SCHEDULED: "Site visit scheduled",
  SITE_VISIT_DONE: "Site visit done",
  NEGOTIATION: "Negotiation",
  BOOKED: "Booked",
  LOST: "Lost",
};

/** CSS variable stem per stage: Task 9 defines --stage-<stem>-bg / --stage-<stem>-fg. */
export const STAGE_TOKEN_NAMES: Record<LeadStage, string> = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  SITE_VISIT_SCHEDULED: "site-visit-scheduled",
  SITE_VISIT_DONE: "site-visit-done",
  NEGOTIATION: "negotiation",
  BOOKED: "booked",
  LOST: "lost",
};

export type StageColor = { hue: string; bg: string; fg: string };

// hue = Tailwind palette the CSS vars draw from (fg: 500; bg: 100 light / 900 dark).
// Class strings are written out literally so Tailwind's scanner can see them.
export const STAGE_COLORS: Record<LeadStage, StageColor> = {
  NEW: { hue: "slate", bg: "bg-[var(--stage-new-bg)]", fg: "text-[var(--stage-new-fg)]" },
  CONTACTED: { hue: "sky", bg: "bg-[var(--stage-contacted-bg)]", fg: "text-[var(--stage-contacted-fg)]" },
  QUALIFIED: { hue: "indigo", bg: "bg-[var(--stage-qualified-bg)]", fg: "text-[var(--stage-qualified-fg)]" },
  SITE_VISIT_SCHEDULED: {
    hue: "violet",
    bg: "bg-[var(--stage-site-visit-scheduled-bg)]",
    fg: "text-[var(--stage-site-visit-scheduled-fg)]",
  },
  SITE_VISIT_DONE: {
    hue: "purple",
    bg: "bg-[var(--stage-site-visit-done-bg)]",
    fg: "text-[var(--stage-site-visit-done-fg)]",
  },
  NEGOTIATION: { hue: "amber", bg: "bg-[var(--stage-negotiation-bg)]", fg: "text-[var(--stage-negotiation-fg)]" },
  BOOKED: { hue: "emerald", bg: "bg-[var(--stage-booked-bg)]", fg: "text-[var(--stage-booked-fg)]" },
  LOST: { hue: "rose", bg: "bg-[var(--stage-lost-bg)]", fg: "text-[var(--stage-lost-fg)]" },
};

/** BOOKED and LOST end the normal flow (BOOKED may still go to LOST; LOST may reopen to NEW). */
export function isTerminal(stage: LeadStage): boolean {
  return stage === "BOOKED" || stage === "LOST";
}

/**
 * Spec §4.1: any stage may move to LOST; LOST may only reopen to NEW; BOOKED only to LOST;
 * otherwise forward by any number of stages or back by exactly one. Staying put is not a transition.
 */
export function canTransition(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return false;
  if (to === "LOST") return true;
  if (from === "LOST") return to === "NEW";
  if (from === "BOOKED") return false;
  const delta = STAGE_ORDER.indexOf(to) - STAGE_ORDER.indexOf(from);
  return delta > 0 || delta === -1;
}
