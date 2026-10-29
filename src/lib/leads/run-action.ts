import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError } from "@/lib/auth/current-user";
import type { ActionResult } from "@/lib/use-action";
import { InvalidTransitionError, LeadClosedError, LeadNotFoundError, LostReasonRequiredError } from "./service";

/** A readable failure raised by a lead action itself; its message is shown as-is. */
export class LeadActionError extends Error {}

const DOMAIN_ERRORS = [InvalidTransitionError, LostReasonRequiredError, LeadNotFoundError, LeadClosedError, LeadActionError];

/**
 * Shared by the lead-detail and Today actions: validation and domain failures become readable results;
 * anything unexpected still throws. Revalidates every view that shows a lead.
 */
export async function runLeadAction(work: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await work();
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: "You don't have permission to do that" };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Invalid input" };
    if (DOMAIN_ERRORS.some((E) => err instanceof E)) return { ok: false, error: (err as Error).message };
    throw err;
  }
  revalidatePath("/leads/[id]", "page");
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/today");
  return { ok: true };
}
