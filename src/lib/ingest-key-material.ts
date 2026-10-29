import { createHash, randomBytes } from "node:crypto";

const KEY_PREFIX = "sk_live_";

/** The stored form of a bearer key: its SHA-256 hex digest. */
export function hashIngestKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** A fresh random bearer key and the hash that is stored for it. No database access, so the seed can use it. */
export function generateIngestKey(): { plaintext: string; keyHash: string } {
  const plaintext = KEY_PREFIX + randomBytes(16).toString("hex");
  return { plaintext, keyHash: hashIngestKey(plaintext) };
}
