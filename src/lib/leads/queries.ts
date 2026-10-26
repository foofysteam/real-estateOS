import { db } from "@/lib/db";
import type { FollowUp, Lead, Prisma, Project, Role, User } from "@/generated/prisma/client";
import { istDayBounds } from "@/lib/dates";
import { UNASSIGNED, type LeadFilters, type LeadListItem, type LeadPage } from "@/lib/leads/filters";

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
  type LeadFilters,
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
