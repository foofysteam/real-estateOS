/** Every application table, in one place so the test reset and the seed wipe stay in sync. */
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

/** One statement that empties every table and resets sequences. */
export const TRUNCATE_ALL_SQL = `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(",")} RESTART IDENTITY CASCADE`;
