import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export type PasswordField = "currentPassword" | "newPassword";

/** A readable reason the change was refused, tied to the field it is about. */
export class InvalidPasswordError extends Error {
  constructor(
    message: string,
    readonly field: PasswordField,
  ) {
    super(message);
    this.name = "InvalidPasswordError";
  }
}

/** Self-service change: the current password must verify; the new one must be 8+ characters and different. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new InvalidPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters`, "newPassword");
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    throw new InvalidPasswordError(`Use at most ${MAX_PASSWORD_LENGTH} characters`, "newPassword");
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true, isActive: true } });
  if (!user || !user.isActive || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new InvalidPasswordError("Current password is incorrect", "currentPassword");
  }
  if (newPassword === currentPassword) {
    throw new InvalidPasswordError("Choose a password you aren't using now", "newPassword");
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
}
