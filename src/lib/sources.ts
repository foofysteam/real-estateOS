import { LeadSource } from "@/generated/prisma/enums";

export const SOURCE_ORDER = Object.values(LeadSource) as readonly LeadSource[];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  META_LEAD_AD: "Meta lead ad",
  WEBSITE: "Website",
  GOOGLE_ADS: "Google Ads",
  PORTAL_99ACRES: "99acres",
  PORTAL_MAGICBRICKS: "MagicBricks",
  PORTAL_HOUSING: "Housing.com",
  WALK_IN: "Walk-in",
  REFERRAL: "Referral",
  CSV_IMPORT: "CSV import",
};

/** Sources an ingest key can be minted for (Meta arrives by webhook, CSV by upload). */
export const INGEST_KEY_SOURCES = [
  "WEBSITE",
  "GOOGLE_ADS",
  "PORTAL_99ACRES",
  "PORTAL_MAGICBRICKS",
  "PORTAL_HOUSING",
  "WALK_IN",
  "REFERRAL",
] as const satisfies readonly LeadSource[];

/** Sources a CSV upload can be tagged with. */
export const CSV_IMPORT_SOURCES = [
  "CSV_IMPORT",
  "PORTAL_99ACRES",
  "PORTAL_MAGICBRICKS",
  "PORTAL_HOUSING",
  "WALK_IN",
  "REFERRAL",
] as const satisfies readonly LeadSource[];
