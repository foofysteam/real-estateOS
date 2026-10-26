"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { LeadActionError, runLeadAction } from "@/lib/leads/run-action";
import { assertCanCompleteFollowUp, completeFollowUp } from "@/lib/leads/service";
import type { ActionResult } from "@/lib/use-action";

export async function completeFollowUpAction(followUpId: string): Promise<ActionResult> {
  const user = await requireUser();
  return runLeadAction(async () => {
    const id = z.string().min(1).max(64).parse(followUpId);
    const followUp = await db.followUp.findUnique({ where: { id }, select: { ownerId: true } });
    if (!followUp) throw new LeadActionError("Follow-up not found");
    assertCanCompleteFollowUp(followUp, user);
    await completeFollowUp(id, user.id);
  });
}
