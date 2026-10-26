"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { assertCanCompleteFollowUp, completeFollowUp } from "@/lib/leads/service";

export async function completeFollowUpAction(followUpId: string): Promise<void> {
  const user = await requireUser();
  const followUp = await db.followUp.findUnique({ where: { id: followUpId }, select: { ownerId: true } });
  if (!followUp) throw new Error("Follow-up not found");
  assertCanCompleteFollowUp(followUp, user);
  await completeFollowUp(followUpId, user.id);
  revalidatePath("/today");
}
