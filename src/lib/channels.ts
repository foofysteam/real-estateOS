import { FollowUpChannel } from "@/generated/prisma/enums";

export const CHANNEL_ORDER = Object.values(FollowUpChannel) as readonly FollowUpChannel[];

export const CHANNEL_LABELS: Record<FollowUpChannel, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  VISIT: "Site visit",
  EMAIL: "Email",
};
