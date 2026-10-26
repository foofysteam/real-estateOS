"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { completeFollowUp } from "@/lib/leads/service";

export async function completeFollowUpAction(followUpId: string): Promise<void> {
  const user = await requireUser();
  await completeFollowUp(followUpId, user.id);
  revalidatePath("/today");
}
