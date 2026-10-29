import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";

function key(): Buffer {
  return Buffer.from(getEnv().ENCRYPTION_KEY, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, ciphertext, tag].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed encrypted token");
  const [iv, ciphertext, tag] = parts.map((p) => Buffer.from(p, "base64url"));
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
