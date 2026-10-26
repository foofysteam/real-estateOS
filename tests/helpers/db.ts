import { db } from "@/lib/db";

export const TABLES = [
  "Project",
  "User",
  "Lead",
  "LeadEvent",
  "FollowUp",
  "IngestKey",
  "WebhookEvent",
  "MetaConnection",
] as const;

export async function resetDb(): Promise<void> {
  const tables = TABLES.map((t) => `"${t}"`).join(",");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}
