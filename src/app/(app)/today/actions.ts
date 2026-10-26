"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ForbiddenError, requireUser } from "@/lib/auth/current-user";
import { completeFollowUp } from "@/lib/leads/service";

export async function completeFollowUpAction(followUpId: string): Promise<void> {
  const user = await requireUser();
  const followUp = await db.followUp.findUnique({ where: { id: followUpId }, select: { ownerId: true } });
  if (!followUp) throw new Error("Follow-up not found");
  // Unowned follow-ups (duplicate-inbound leads) may be completed by anyone; owned ones by their owner or an ADMIN.
  if (followUp.ownerId !== null && followUp.ownerId !== user.id && user.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  await completeFollowUp(followUpId, user.id);
  revalidatePath("/today");
}
