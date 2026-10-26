// Client-safe: no db import. queries.ts re-exports these for server callers.
import { z } from "zod";
import { LeadSource, LeadStage } from "@/generated/prisma/enums";

export const UNASSIGNED = "unassigned";

/** First value of a repeated param; blank strings count as absent. */
function single(value: unknown): unknown {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Each field falls back on its own, so one bad param never discards the rest.
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(single, schema.optional()).catch(undefined);

export const leadFiltersSchema = z.object({
  q: optional(z.string().max(100)),
  source: optional(z.enum(LeadSource)),
  stage: optional(z.enum(LeadStage)),
  ownerId: optional(z.string().max(64)),
  projectId: optional(z.string().max(64)),
  sort: z.preprocess(single, z.enum(["score", "created"]).default("created")).catch("created"),
});

export type LeadSort = "score" | "created";

export type LeadFilters = {
  q?: string;
  source?: LeadSource;
  stage?: LeadStage;
  /** A user id, or "unassigned" for leads with no owner. */
  ownerId?: string;
  projectId?: string;
  sort?: LeadSort;
};

export const DEFAULT_FILTERS: LeadFilters = { sort: "created" };

type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

export function parseLeadFilters(searchParams: ParamsInput): LeadFilters {
  const raw = searchParams instanceof URLSearchParams ? Object.fromEntries(searchParams) : searchParams;
  const parsed = leadFiltersSchema.parse(raw);
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined)) as LeadFilters;
}

/** URL form of the filters; the default sort is left out to keep links short. */
export function leadFiltersToSearchParams(filters: LeadFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["q", "source", "stage", "ownerId", "projectId"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (filters.sort && filters.sort !== "created") params.set("sort", filters.sort);
  return params;
}

export type LeadListItem = {
  id: string;
  name: string;
  phone: string;
  stage: LeadStage;
  score: number;
  source: LeadSource;
  budgetRupees: number | null;
  createdAt: Date;
  nextFollowUpAt: Date | null;
  project: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
};

/** LeadListItem after a JSON round-trip (or serialised for a client component). */
export type LeadListItemDTO = Omit<LeadListItem, "createdAt" | "nextFollowUpAt"> & {
  createdAt: string;
  nextFollowUpAt: string | null;
};

export type LeadPage<T> = { items: T[]; nextCursor: string | null };

export function toLeadListItemDTO(item: LeadListItem): LeadListItemDTO {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    nextFollowUpAt: item.nextFollowUpAt?.toISOString() ?? null,
  };
}
