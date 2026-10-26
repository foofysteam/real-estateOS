import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma, type User } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { normalizePhone } from "@/lib/phone";

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`${email} is already on the team`);
    this.name = "DuplicateEmailError";
  }
}

export class LastAdminError extends Error {
  constructor() {
    super("You can't deactivate the last active admin");
    this.name = "LastAdminError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
  }
}

// URL-safe, without the look-alikes 0 O 1 l I.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_";
const PASSWORD_LENGTH = 12;

/** Rejection sampling keeps every character equally likely. */
export function generateTemporaryPassword(): string {
  const limit = 256 - (256 % PASSWORD_ALPHABET.length);
  let out = "";
  while (out.length < PASSWORD_LENGTH) {
    for (const byte of randomBytes(PASSWORD_LENGTH * 2)) {
      if (byte < limit && out.length < PASSWORD_LENGTH) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
    }
  }
  return out;
}

export const inviteInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email").max(120)),
  name: z.string().trim().min(1, "Enter a name").max(80, "Keep the name under 80 characters"),
  role: z.enum(Role, "Pick a role"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return null;
      const phone = normalizePhone(raw);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
        return z.NEVER;
      }
      return phone;
    }),
});

export type InviteInput = z.input<typeof inviteInputSchema>;

/** Everything about a user except the password hash. */
export type TeamMember = Omit<User, "passwordHash">;

const MEMBER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Record<keyof TeamMember, true>;

/** The plaintext password is returned to show once; only its hash is stored. */
export async function inviteUser(input: InviteInput): Promise<{ user: User; temporaryPassword: string }> {
  const data = inviteInputSchema.parse(input);
  const temporaryPassword = generateTemporaryPassword();
  try {
    const user = await db.user.create({ data: { ...data, passwordHash: await hashPassword(temporaryPassword) } });
    return { user, temporaryPassword };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new DuplicateEmailError(data.email);
    }
    throw err;
  }
}

/** Serializable so two admins can't deactivate each other at the same moment. */
export async function setUserActive(id: string, active: boolean): Promise<void> {
  await db.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
      if (!user) throw new UserNotFoundError();
      if (!active && user.isActive && user.role === "ADMIN") {
        const activeAdmins = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
        if (activeAdmins <= 1) throw new LastAdminError();
      }
      await tx.user.update({ where: { id }, data: { isActive: active } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function resetPassword(id: string): Promise<string> {
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const { count } = await db.user.updateMany({ where: { id }, data: { passwordHash } });
  if (count === 0) throw new UserNotFoundError();
  return temporaryPassword;
}

export function listUsers(): Promise<TeamMember[]> {
  return db.user.findMany({ select: MEMBER_SELECT, orderBy: { name: "asc" } });
}
