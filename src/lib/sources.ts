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
