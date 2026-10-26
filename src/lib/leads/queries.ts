import { db } from "@/lib/db";
import type { FollowUp, Lead, LeadStage, Prisma, Project, Role, User } from "@/generated/prisma/client";
import { istDayBounds } from "@/lib/dates";
import { UNASSIGNED, type LeadFilters, type LeadListItem, type LeadPage, type PipelineFilters } from "@/lib/leads/filters";
import { STAGE_ORDER } from "@/lib/stages";

export type FollowUpWithLead = FollowUp & {
  lead: Pick<Lead, "id" | "name" | "phone" | "stage"> & { project: Pick<Project, "id" | "name" | "slug"> | null };
};

export type LeadWithOwner = Lead & {
  owner: Pick<User, "id" | "name"> | null;
  project: Pick<Project, "id" | "name" | "slug"> | null;
};

export type TodayBoard = { overdue: FollowUpWithLead[]; dueToday: FollowUpWithLead[]; newLeads: LeadWithOwner[] };

const NEW_LEADS_LIMIT = 50;

const projectSelect = { select: { id: true, name: true, slug: true } } as const;

const followUpInclude = {
  lead: { select: { id: true, name: true, phone: true, stage: true, project: projectSelect } },
} as const;

export async function getTodayBoard(user: { id: string; role: Role }, now = new Date()): Promise<TodayBoard> {
  const { start, end } = istDayBounds(now);
  const isAdmin = user.role === "ADMIN";

  // Follow-ups auto-complete when a lead is BOOKED or LOST; the stage filter is a defensive backstop.
  const openFollowUps: Prisma.FollowUpWhereInput = {
    completedAt: null,
    lead: { stage: { notIn: ["BOOKED", "LOST"] } },
    ...(isAdmin ? {} : { ownerId: user.id }),
  };

  const [overdue, dueToday, newLeads] = await Promise.all([
    db.followUp.findMany({
      where: { ...openFollowUps, dueAt: { lt: start } },
      include: followUpInclude,
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    }),
    db.followUp.findMany({
      where: { ...openFollowUps, dueAt: { gte: start, lt: end } },
      include: followUpInclude,
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    }),
    db.lead.findMany({
      where: { stage: "NEW", ownerId: isAdmin ? null : user.id },
      include: { owner: { select: { id: true, name: true } }, project: projectSelect },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: NEW_LEADS_LIMIT,
    }),
  ]);

  return { overdue, dueToday, newLeads };
}

export {
  leadFiltersSchema,
  parseLeadFilters,
  parsePipelineFilters,
  type LeadFilters,
  type PipelineFilters,
  type LeadListItem,
  type LeadPage,
} from "@/lib/leads/filters";

const LIST_DEFAULT_LIMIT = 30;
const LIST_MAX_LIMIT = 100;

const leadListSelect = {
  id: true,
  name: true,
  phone: true,
  stage: true,
  score: true,
  source: true,
  budgetRupees: true,
  createdAt: true,
  nextFollowUpAt: true,
  project: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
} as const satisfies Prisma.LeadSelect;

function leadListWhere(filters: LeadFilters): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  if (filters.stage) where.stage = filters.stage;
  if (filters.source) where.source = filters.source;
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.ownerId) where.ownerId = filters.ownerId === UNASSIGNED ? null : filters.ownerId;
  const q = filters.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ];
  }
  return where;
}

/** Cursor = id of the last item on the previous page; ordering always ends on id so pages never overlap. */
export async function listLeads(
  filters: LeadFilters,
  cursor?: string,
  limit = LIST_DEFAULT_LIMIT,
): Promise<LeadPage<LeadListItem>> {
  const take = Math.min(Math.max(1, Math.floor(limit)), LIST_MAX_LIMIT);
  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    filters.sort === "score" ? [{ score: "desc" }, { id: "desc" }] : [{ createdAt: "desc" }, { id: "desc" }];

  // Fetch one extra row to learn whether another page exists.
  const rows = await db.lead.findMany({
    where: leadListWhere(filters),
    select: leadListSelect,
    orderBy,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const items = rows.slice(0, take);
  return { items, nextCursor: rows.length > take ? items[items.length - 1].id : null };
}

const leadDetailInclude = {
  project: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  events: { include: { actor: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
  followUps: {
    where: { completedAt: null },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
  },
} as const satisfies Prisma.LeadInclude;

export type LeadDetail = Prisma.LeadGetPayload<{ include: typeof leadDetailInclude }> & {
  /** Names of users referenced by ASSIGNED events, so the timeline can say "Assigned to <name>". */
  userNames: Record<string, string>;
};

/** Lead with project, owner, events (newest first, with actor) and open follow-ups (soonest first). */
export async function getLeadDetail(id: string): Promise<LeadDetail | null> {
  const lead = await db.lead.findUnique({ where: { id }, include: leadDetailInclude });
  if (!lead) return null;
  const ids = new Set<string>();
  for (const e of lead.events) {
    const to = e.type === "ASSIGNED" ? (e.payload as { to?: unknown } | null)?.to : null;
    if (typeof to === "string") ids.add(to);
  }
  const users = ids.size
    ? await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } })
    : [];
  return { ...lead, userNames: Object.fromEntries(users.map((u) => [u.id, u.name])) };
}

const pipelineCardSelect = {
  id: true,
  name: true,
  score: true,
  budgetRupees: true,
  stage: true,
  nextFollowUpAt: true,
  owner: { select: { name: true } },
  project: { select: { name: true } },
} as const satisfies Prisma.LeadSelect;

export type PipelineCardItem = Prisma.LeadGetPayload<{ select: typeof pipelineCardSelect }>;

export type PipelineColumn = {
  stage: LeadStage;
  /** All matching leads in the stage; `leads` holds at most PIPELINE_COLUMN_LIMIT of them. */
  count: number;
  totalBudgetRupees: number;
  leads: PipelineCardItem[];
};

export const PIPELINE_COLUMN_LIMIT = 100;

/** One column per stage in STAGE_ORDER (LOST only when asked), each with its top-scored leads. */
export async function getPipeline(filters: PipelineFilters = {}): Promise<PipelineColumn[]> {
  const stages = STAGE_ORDER.filter((s) => filters.includeLost || s !== "LOST");
  const where: Prisma.LeadWhereInput = { stage: { in: [...stages] } };
  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.ownerId) where.ownerId = filters.ownerId === UNASSIGNED ? null : filters.ownerId;

  const [groups, ...cards] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], where, _count: { _all: true }, _sum: { budgetRupees: true } }),
    ...stages.map((stage) =>
      db.lead.findMany({
        where: { ...where, stage },
        select: pipelineCardSelect,
        orderBy: [{ score: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: PIPELINE_COLUMN_LIMIT,
      }),
    ),
  ]);

  return stages.map((stage, i) => {
    const group = groups.find((g) => g.stage === stage);
    return {
      stage,
      count: group?._count._all ?? 0,
      totalBudgetRupees: group?._sum.budgetRupees ?? 0,
      leads: cards[i],
    };
  });
}
