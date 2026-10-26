import { db } from "@/lib/db";
import type { FollowUp, Lead, Prisma, Project, Role, User } from "@/generated/prisma/client";
import { istDayBounds } from "@/lib/dates";

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
