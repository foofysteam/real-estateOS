import { hash, verify } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  // @node-rs/argon2 defaults to argon2id.
  return hash(plain);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}
