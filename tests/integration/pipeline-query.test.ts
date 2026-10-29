import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import type { LeadStage } from "@/generated/prisma/client";
import { getPipeline } from "@/lib/leads/queries";
import { STAGE_ORDER } from "@/lib/stages";
import { resetDb } from "../helpers/db";

let phoneSeq = 0;
function makeLead(opts: { stage?: LeadStage; budgetRupees?: number | null; score?: number; ownerId?: string | null; projectId?: string | null; name?: string } = {}) {
  phoneSeq += 1;
  return db.lead.create({
    data: {
      name: opts.name ?? "Lead",
      phone: `+9170000${String(10000 + phoneSeq).slice(-5)}`,
      source: "WEBSITE",
      stage: opts.stage ?? "NEW",
      score: opts.score ?? 0,
      budgetRupees: opts.budgetRupees ?? null,
      ownerId: opts.ownerId ?? null,
      projectId: opts.projectId ?? null,
    },
  });
}

describe("getPipeline", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("groups leads by stage with totals and omits LOST by default", async () => {
    await makeLead({ stage: "NEW", budgetRupees: 4000000, score: 10, name: "Low" });
    await makeLead({ stage: "NEW", budgetRupees: 5000000, score: 80, name: "High" });
    await makeLead({ stage: "NEW", budgetRupees: null });
    await makeLead({ stage: "QUALIFIED", budgetRupees: 1000000 });
    await makeLead({ stage: "LOST", budgetRupees: 2000000 });

    const cols = await getPipeline();
    expect(cols.map((c) => c.stage)).toEqual(STAGE_ORDER.filter((s) => s !== "LOST"));
    const fresh = cols.find((c) => c.stage === "NEW");
    expect(fresh?.count).toBe(3);
    expect(fresh?.totalBudgetRupees).toBe(9000000);
    expect(fresh?.leads.map((l) => l.name).slice(0, 2)).toEqual(["High", "Low"]);
    expect(cols.find((c) => c.stage === "CONTACTED")).toMatchObject({ count: 0, totalBudgetRupees: 0, leads: [] });
  });

  it("includes LOST when asked", async () => {
    await makeLead({ stage: "LOST", budgetRupees: 2000000 });
    const cols = await getPipeline({ includeLost: true });
    expect(cols.map((c) => c.stage)).toEqual([...STAGE_ORDER]);
    expect(cols.at(-1)).toMatchObject({ stage: "LOST", count: 1, totalBudgetRupees: 2000000 });
  });

  it("filters by project and owner, with unassigned meaning no owner", async () => {
    const owner = await db.user.create({ data: { email: "a@x.in", name: "Asha Rao", role: "AGENT", passwordHash: "x" } });
    const project = await db.project.create({
      data: { name: "Krishvi", slug: "krishvi", city: "Bengaluru", priceMinRupees: 1, priceMaxRupees: 2 },
    });
    const mine = await makeLead({ ownerId: owner.id, projectId: project.id });
    const loose = await makeLead({ projectId: project.id });
    await makeLead({ ownerId: owner.id });

    const ids = async (f: Parameters<typeof getPipeline>[0]) =>
      (await getPipeline(f)).flatMap((c) => c.leads.map((l) => l.id)).sort();
    expect(await ids({ projectId: project.id })).toEqual([mine.id, loose.id].sort());
    expect(await ids({ projectId: project.id, ownerId: owner.id })).toEqual([mine.id]);
    expect(await ids({ projectId: project.id, ownerId: "unassigned" })).toEqual([loose.id]);

    const card = (await getPipeline({ ownerId: owner.id, projectId: project.id }))[0].leads[0];
    expect(card).toMatchObject({ owner: { name: "Asha Rao" }, project: { name: "Krishvi" } });
  });
});
