import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { istDayBounds } from "@/lib/dates";
import { verifyPassword } from "@/lib/auth/password";
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

  it("is deterministic: the same seed produces the same leads", async () => {
    const before = (await db.lead.findMany({ orderBy: { phone: "asc" } })).map((l) => [l.phone, l.name, l.stage, l.source]);
    await seed(db);
    const after = (await db.lead.findMany({ orderBy: { phone: "asc" } })).map((l) => [l.phone, l.name, l.stage, l.source]);
    expect(after).toEqual(before);
  }, 30_000);
});
