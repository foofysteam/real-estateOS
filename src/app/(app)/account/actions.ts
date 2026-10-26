"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { changePassword, InvalidPasswordError, MAX_PASSWORD_LENGTH } from "@/lib/auth/password-change";
import type { ActionResult } from "@/lib/use-action";

export type ChangePasswordInput = { currentPassword: string; newPassword: string; confirmPassword: string };

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(MAX_PASSWORD_LENGTH),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

/** Any signed-in user changes their own password; failures name the field they belong to. */
export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid input", field: issue ? String(issue.path[0]) : undefined };
  }
  try {
    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  } catch (err) {
    if (err instanceof InvalidPasswordError) return { ok: false, error: err.message, field: err.field };
    throw err;
  }
  return { ok: true };
}
