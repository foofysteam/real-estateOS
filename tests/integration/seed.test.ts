import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { istDayBounds } from "@/lib/dates";
import { verifyPassword } from "@/lib/auth/password";
import { computeScore } from "@/lib/score";
import { resolveIngestKey } from "@/lib/ingest-keys";
import { SOURCE_ORDER } from "@/lib/sources";
import { seed } from "../../prisma/seed";

describe("seed", () => {
  let keys: { name: string; plaintext: string }[] = [];

  // Seed twice: the second run must wipe the first, so the counts below also prove idempotency.
  beforeAll(async () => {
    await seed(db);
    keys = (await seed(db)).ingestKeys;
  }, 30_000);

  it("seeds the documented counts", async () => {
    expect(await db.user.count()).toBe(4);
    expect(await db.project.count()).toBe(3);
    expect(await db.lead.count()).toBe(200);
    expect(await db.followUp.count()).toBe(60);
    expect(new Set((await db.lead.findMany()).map((l) => l.stage)).size).toBe(8);
  });

  it("creates the documented logins", async () => {
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@sc.studio" } });
    expect(admin.role).toBe("ADMIN");
    expect(await verifyPassword("admin1234", admin.passwordHash)).toBe(true);
    for (const n of [1, 2, 3]) {
      const agent = await db.user.findUniqueOrThrow({ where: { email: `agent${n}@sc.studio` } });
      expect(agent.role).toBe("AGENT");
      expect(await verifyPassword("agent1234", agent.passwordHash)).toBe(true);
    }
  });

  it("covers every source, assigns 70% of leads, and uses unique +91 mobiles", async () => {
    const leads = await db.lead.findMany();
    expect(new Set(leads.map((l) => l.source))).toEqual(new Set(SOURCE_ORDER));
    expect(leads.filter((l) => l.ownerId !== null)).toHaveLength(140);
    expect(leads.every((l) => /^\+91[6-9]\d{9}$/.test(l.phone))).toBe(true);
    expect(new Set(leads.map((l) => l.phone)).size).toBe(200);
    expect(leads.filter((l) => l.stage === "LOST").every((l) => !!l.lostReason)).toBe(true);
    expect(await db.leadEvent.count({ where: { type: "CREATED" } })).toBe(200);
  });

  it("splits follow-ups into 20 overdue, 20 due today (IST) and 20 future, all on open leads", async () => {
    const { start, end } = istDayBounds(new Date());
    const fus = await db.followUp.findMany({ include: { lead: true } });
    expect(fus.filter((f) => f.dueAt < start)).toHaveLength(20);
    expect(fus.filter((f) => f.dueAt >= start && f.dueAt < end)).toHaveLength(20);
    expect(fus.filter((f) => f.dueAt >= end)).toHaveLength(20);
    expect(fus.every((f) => f.completedAt === null && !["BOOKED", "LOST"].includes(f.lead.stage))).toBe(true);
    expect(fus.every((f) => f.ownerId !== null && f.ownerId === f.lead.ownerId)).toBe(true);
  });

  it("keeps nextFollowUpAt equal to each lead's earliest open follow-up", async () => {
    const leads = await db.lead.findMany({ include: { followUps: true } });
    for (const lead of leads) {
      const earliest = lead.followUps.map((f) => f.dueAt.getTime()).sort((a, b) => a - b)[0] ?? null;
      expect(lead.nextFollowUpAt?.getTime() ?? null).toBe(earliest);
    }
  });

  it("creates two working ingest keys and returns their plaintext without storing it", async () => {
    expect(await db.ingestKey.count()).toBe(2);
    expect(keys).toHaveLength(2);
    const stored = await db.ingestKey.findMany();
    for (const { plaintext } of keys) {
      expect(stored.some((k) => k.keyHash === plaintext)).toBe(false);
      expect(await resolveIngestKey(plaintext)).not.toBeNull();
    }
    expect(new Set(stored.map((k) => k.source))).toEqual(new Set(["WEBSITE", "PORTAL_99ACRES"]));
  });

  it("matches what the lead services would have written", async () => {
    const leads = await db.lead.findMany({ include: { project: true, events: true } });
    const followUpIds = new Set((await db.followUp.findMany({ select: { id: true } })).map((f) => f.id));
    for (const lead of leads) {
      const { source, budgetRupees, configuration, locality, email, project } = lead;
      expect(lead.score).toBe(computeScore({ source, budgetRupees, configuration, locality, email, project }));

      const created = lead.events.filter((e) => e.type === "CREATED");
      expect(created).toHaveLength(1);
      expect(created[0].payload).toEqual({ source: lead.source, score: lead.score });

      if (lead.ownerId) {
        expect(lead.events.some((e) => e.type === "ASSIGNED" && (e.payload as { to?: string }).to === lead.ownerId)).toBe(true);
      }

      const stageEvents = lead.events.filter((e) => e.type === "STAGE_CHANGED");
      if (lead.stage === "NEW") {
        expect(stageEvents).toHaveLength(0);
      } else {
        const payloads = stageEvents.map((e) => e.payload as { to?: string; lostReason?: string });
        const toStage = payloads.filter((p) => p.to === lead.stage);
        expect(toStage).toHaveLength(1);
        expect("lostReason" in toStage[0]).toBe(lead.stage === "LOST");
        if (lead.stage === "LOST") expect(toStage[0].lostReason).toBe(lead.lostReason);
      }

      for (const e of lead.events.filter((ev) => ev.type === "FOLLOW_UP_SCHEDULED")) {
        expect(followUpIds.has((e.payload as { followUpId: string }).followUpId)).toBe(true);
      }
    }
  });

  it("is deterministic: the same seed produces the same rows (time-dependent fields aside)", async () => {
    const snapshot = async () => {
      const leads = await db.lead.findMany({ include: { owner: true, project: true }, orderBy: { phone: "asc" } });
      const followUps = await db.followUp.findMany({ include: { lead: true, owner: true } });
      return {
        leads: leads.map((l) => ({
          phone: l.phone,
          name: l.name,
          email: l.email,
          source: l.source,
          stage: l.stage,
          score: l.score,
          budgetRupees: l.budgetRupees,
          configuration: l.configuration,
          locality: l.locality,
          notes: l.notes,
          lostReason: l.lostReason,
          ownerEmail: l.owner?.email ?? null,
          projectSlug: l.project?.slug ?? null,
        })),
        followUps: followUps
          .map((f) => ({
            leadPhone: f.lead.phone,
            ownerEmail: f.owner?.email ?? null,
            channel: f.channel,
            note: f.note,
            completedAt: f.completedAt,
          }))
          .sort((a, b) => a.leadPhone.localeCompare(b.leadPhone)),
      };
    };
    const before = await snapshot();
    await seed(db);
    expect(await snapshot()).toEqual(before);
  }, 30_000);
});
