/**
 * Demo data: 1 admin, 3 agents, 3 Bengaluru projects, 200 leads, 60 follow-ups and 2 ingest keys.
 *
 * Idempotent (wipes every table first) and deterministic (seeded PRNG); only follow-up due dates
 * move with the clock so the Today screen always has overdue, due-today and upcoming work.
 *
 * Run with `pnpm db:seed`. Imports here must stay free of database side effects: the CLI block
 * loads `.env` before it creates the client.
 */
import { pathToFileURL } from "node:url";
import type {
  FollowUpChannel,
  LeadSource,
  LeadStage,
  Prisma,
  PrismaClient,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { istDayBounds } from "../src/lib/dates";
import { TRUNCATE_ALL_SQL } from "../src/lib/db-tables";
import { generateIngestKey } from "../src/lib/ingest-key-material";
import { computeScore } from "../src/lib/score";

export type SeedResult = { ingestKeys: { name: string; source: LeadSource; plaintext: string }[] };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const LAKH = 100_000;
const CRORE = 100 * LAKH;

/** mulberry32: a tiny, fast, deterministic PRNG returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOURCES: readonly LeadSource[] = [
  "META_LEAD_AD",
  "WEBSITE",
  "GOOGLE_ADS",
  "PORTAL_99ACRES",
  "PORTAL_MAGICBRICKS",
  "PORTAL_HOUSING",
  "WALK_IN",
  "REFERRAL",
  "CSV_IMPORT",
];

/** How many of the 200 leads sit in each stage (sums to 200, every stage present). */
const STAGE_COUNTS: ReadonlyArray<[LeadStage, number]> = [
  ["NEW", 50],
  ["CONTACTED", 40],
  ["QUALIFIED", 30],
  ["SITE_VISIT_SCHEDULED", 20],
  ["SITE_VISIT_DONE", 15],
  ["NEGOTIATION", 15],
  ["BOOKED", 10],
  ["LOST", 20],
];

/** Unassigned leads (60 of 200, so 70 % are assigned): fresh or barely-touched ones. */
const UNASSIGNED: Partial<Record<LeadStage, number>> = { NEW: 40, CONTACTED: 20 };

const PROJECTS = [
  { name: "Aurum Heights", slug: "aurum-heights", locality: "Whitefield", min: 80 * LAKH, max: 1.6 * CRORE },
  { name: "Banyan Grove Villas", slug: "banyan-grove-villas", locality: "Sarjapur Road", min: 1.2 * CRORE, max: 2.5 * CRORE },
  { name: "Nimbus Residency", slug: "nimbus-residency", locality: "Electronic City", min: 45 * LAKH, max: 75 * LAKH },
] as const;

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Karthik", "Sai", "Pranav", "Rahul", "Vikram",
  "Siddharth", "Nikhil", "Manoj", "Suresh", "Ramesh", "Harish", "Deepak", "Anil", "Ravi", "Naveen",
  "Ananya", "Diya", "Priya", "Kavya", "Meera", "Sneha", "Pooja", "Lakshmi", "Divya", "Shreya",
  "Aishwarya", "Neha", "Swathi", "Deepa", "Anjali", "Bhavana", "Nandini", "Rashmi", "Sowmya", "Ishita",
];

const LAST_NAMES = [
  "Sharma", "Reddy", "Iyer", "Rao", "Nair", "Gowda", "Kumar", "Shetty", "Menon", "Patel",
  "Hegde", "Pillai", "Joshi", "Kulkarni", "Naidu", "Desai", "Bhat", "Krishnan", "Murthy", "Agarwal",
];

const LOCALITIES = [
  "Whitefield", "Sarjapur Road", "Electronic City", "HSR Layout", "Koramangala", "Hebbal",
  "Yelahanka", "Bellandur", "Marathahalli", "JP Nagar", "Hennur", "Kanakapura Road",
];

const CONFIGURATIONS = ["1 BHK", "2 BHK", "2.5 BHK", "3 BHK", "3 BHK + study", "4 BHK villa"];

const LOST_REASONS = [
  "Budget too low for the project",
  "Bought elsewhere",
  "Not reachable after 5 attempts",
  "Location does not suit",
  "Postponed purchase by a year",
  "Wants ready-to-move only",
];

const NOTES = [
  "Prefers a call after 6 pm.",
  "Looking for an east-facing unit.",
  "Home loan pre-approved.",
  "Wants to visit with family on the weekend.",
  "Asked for the floor plan on WhatsApp.",
];

/** Wipe every table, then insert the demo data set. Returns the ingest keys' plaintext (shown once). */
export async function seed(db: PrismaClient): Promise<SeedResult> {
  const rand = mulberry32(20261026);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const shuffle = <T>(items: T[]): T[] => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  const now = new Date();
  const { start: todayStart, end: todayEnd } = istDayBounds(now);
  const [adminHash, agentHash] = await Promise.all([hashPassword("admin1234"), hashPassword("agent1234")]);
  const keys = [
    { name: "website", source: "WEBSITE" as const, ...generateIngestKey() },
    { name: "99acres", source: "PORTAL_99ACRES" as const, ...generateIngestKey() },
  ];

  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(TRUNCATE_ALL_SQL);

      const admin = await tx.user.create({
        data: { email: "admin@sc.studio", name: "Asha Rao", role: "ADMIN", passwordHash: adminHash, phone: "+919845000001" },
      });
      const agents = await tx.user.createManyAndReturn({
        data: [
          { email: "agent1@sc.studio", name: "Kiran Shetty", phone: "+919845000011" },
          { email: "agent2@sc.studio", name: "Meghana Iyer", phone: "+919845000012" },
          { email: "agent3@sc.studio", name: "Farhan Khan", phone: "+919845000013" },
        ].map((a) => ({ ...a, role: "AGENT" as const, passwordHash: agentHash })),
      });
      agents.sort((a, b) => a.email.localeCompare(b.email));

      const projects = await tx.project.createManyAndReturn({
        data: PROJECTS.map((p) => ({
          name: p.name,
          slug: p.slug,
          city: "Bengaluru",
          priceMinRupees: p.min,
          priceMaxRupees: p.max,
        })),
      });
      const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

      // Stage per lead: the fixed counts, shuffled. Ownership: the UNASSIGNED quota per stage is left
      // without an owner; everyone else is spread round-robin over the agents.
      const stages = shuffle(STAGE_COUNTS.flatMap(([stage, n]) => Array<LeadStage>(n).fill(stage)));
      const unassignedLeft = { ...UNASSIGNED };
      let nextAgent = 0;

      type Draft = Prisma.LeadCreateManyInput & { stage: LeadStage; createdAt: Date };
      const drafts: Draft[] = stages.map((stage, i) => {
        const source = SOURCES[i % SOURCES.length];
        const first = pick(FIRST_NAMES);
        const last = pick(LAST_NAMES);
        const projectDef = rand() < 0.85 ? pick(PROJECTS) : null;
        const project = projectDef ? projectBySlug.get(projectDef.slug)! : null;

        let budgetRupees: number | null = null;
        const budgetRoll = rand();
        if (projectDef && budgetRoll < 0.7) budgetRupees = between(projectDef.min / 50_000, projectDef.max / 50_000) * 50_000;
        else if (projectDef && budgetRoll < 0.85) budgetRupees = Math.round((projectDef.min * 0.8) / 50_000) * 50_000;
        else if (!projectDef && budgetRoll < 0.5) budgetRupees = between(8, 50) * 5 * LAKH;

        const configuration = rand() < 0.75 ? pick(CONFIGURATIONS) : null;
        const locality = rand() < 0.7 ? (projectDef && rand() < 0.6 ? projectDef.locality : pick(LOCALITIES)) : null;
        const email = rand() < 0.6 ? `${first}.${last}${i + 1}@example.com`.toLowerCase() : null;
        const notes = rand() < 0.3 ? pick(NOTES) : null;

        let ownerId: string | null = null;
        if ((unassignedLeft[stage] ?? 0) > 0) unassignedLeft[stage]! -= 1;
        else ownerId = agents[nextAgent++ % agents.length].id;

        // Fresh leads arrived in the last week; worked leads 8–60 days ago, so their history fits before today.
        const createdAt =
          stage === "NEW" ? new Date(now.getTime() - between(1, 7 * 24) * HOUR) : new Date(now.getTime() - between(8 * 24, 60 * 24) * HOUR);

        return {
          name: `${first} ${last}`,
          // +91 98450 xxxxx-style mobiles; the multiplier keeps them unique across the 200 leads.
          phone: `+919845${String(100_000 + i * 4_391).padStart(6, "0")}`,
          email,
          source,
          stage,
          score: computeScore({ source, budgetRupees, configuration, locality, email, project }),
          projectId: project?.id ?? null,
          ownerId,
          budgetRupees,
          configuration,
          locality,
          notes,
          lostReason: stage === "LOST" ? pick(LOST_REASONS) : null,
          lastContactedAt: stage === "NEW" ? null : new Date(createdAt.getTime() + DAY),
          createdAt,
        };
      });

      // Follow-ups: 60 distinct open, assigned, already-worked leads; 20 overdue, 20 today (IST), 20 upcoming.
      const eligible = shuffle(
        drafts.map((d, i) => i).filter((i) => {
          const d = drafts[i];
          return d.ownerId && d.stage !== "NEW" && d.stage !== "BOOKED" && d.stage !== "LOST";
        }),
      ).slice(0, 60);
      const followUpPlan = eligible.map((leadIndex, n) => {
        const bucket = Math.floor(n / 20); // 0 overdue, 1 today, 2 future
        const timeOfDay = between(9 * 4, 19 * 4) * 15 * 60 * 1000; // 9:00–19:00 IST in 15-minute steps
        const dayStart =
          bucket === 0
            ? todayStart.getTime() - between(1, 5) * DAY
            : bucket === 1
              ? todayStart.getTime()
              : todayEnd.getTime() + between(0, 6) * DAY;
        const stage = drafts[leadIndex].stage;
        const channel: FollowUpChannel = stage === "SITE_VISIT_SCHEDULED" ? "VISIT" : pick(["CALL", "CALL", "WHATSAPP", "EMAIL"] as const);
        return { leadIndex, dueAt: new Date(dayStart + timeOfDay), channel };
      });
      for (const f of followUpPlan) drafts[f.leadIndex].nextFollowUpAt = f.dueAt; // one follow-up per lead

      const leads = await tx.lead.createManyAndReturn({ data: drafts, select: { id: true, phone: true } });
      const idByPhone = new Map(leads.map((l) => [l.phone, l.id]));
      const leadId = (i: number) => idByPhone.get(drafts[i].phone)!;

      const events: Prisma.LeadEventCreateManyInput[] = [];
      drafts.forEach((d, i) => {
        const id = leadId(i);
        const actorId = d.ownerId ?? admin.id;
        events.push({ leadId: id, type: "CREATED", payload: { source: d.source, score: d.score ?? 0 }, createdAt: d.createdAt });
        if (d.ownerId) {
          events.push({
            leadId: id,
            actorId: admin.id,
            type: "ASSIGNED",
            payload: { from: null, to: d.ownerId },
            createdAt: new Date(d.createdAt.getTime() + 10 * 60 * 1000),
          });
        }
        if (d.stage !== "NEW") {
          const payload = d.stage === "LOST" ? { from: "NEW", to: d.stage, lostReason: d.lostReason } : { from: "NEW", to: d.stage };
          events.push({ leadId: id, actorId, type: "STAGE_CHANGED", payload, createdAt: new Date(d.createdAt.getTime() + DAY) });
        }
      });

      const followUps = await tx.followUp.createManyAndReturn({
        data: followUpPlan.map((f) => ({
          leadId: leadId(f.leadIndex),
          ownerId: drafts[f.leadIndex].ownerId!,
          dueAt: f.dueAt,
          channel: f.channel,
          createdAt: new Date(drafts[f.leadIndex].createdAt.getTime() + DAY + HOUR),
        })),
      });
      for (const fu of followUps) {
        events.push({
          leadId: fu.leadId,
          actorId: fu.ownerId,
          type: "FOLLOW_UP_SCHEDULED",
          payload: { followUpId: fu.id, dueAt: fu.dueAt.toISOString(), channel: fu.channel },
          createdAt: fu.createdAt,
        });
      }
      await tx.leadEvent.createMany({ data: events });

      await tx.ingestKey.createMany({
        data: keys.map(({ name, source, keyHash }) => ({ name, source, keyHash })),
      });
    },
    { timeout: 60_000 },
  );

  return { ingestKeys: keys.map(({ name, source, plaintext }) => ({ name, source, plaintext })) };
}

async function main(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  // Imported only now, after .env is loaded: creating the client reads DATABASE_URL.
  const { db } = await import("../src/lib/db");
  try {
    const { ingestKeys } = await seed(db);
    console.log("Seeded 4 users, 3 projects, 200 leads, 60 follow-ups and 2 ingest keys.");
    console.log("Logins: admin@sc.studio / admin1234, agent1@sc.studio … agent3@sc.studio / agent1234");
    console.log("Ingest keys (shown once, only their hashes are stored):");
    for (const k of ingestKeys) console.log(`  ${k.name.padEnd(8)} ${k.source.padEnd(15)} ${k.plaintext}`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
