import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { IngestKey, LeadSource } from "@/generated/prisma/client";

const KEY_PREFIX = "sk_live_";

function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Mint a bearer key for a lead source. The plaintext is returned once and never stored. */
export async function createIngestKey(name: string, source: LeadSource): Promise<{ id: string; plaintext: string }> {
  const plaintext = KEY_PREFIX + randomBytes(16).toString("hex");
  const key = await db.ingestKey.create({ data: { name, source, keyHash: hashKey(plaintext) } });
  return { id: key.id, plaintext };
}

/** The active key matching this plaintext (bumping its lastUsedAt), or null. */
export async function resolveIngestKey(plaintext: string): Promise<IngestKey | null> {
  const key = await db.ingestKey.findUnique({ where: { keyHash: hashKey(plaintext) } });
  if (!key || !key.isActive) return null;
  return db.ingestKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
}

export async function revokeIngestKey(id: string): Promise<void> {
  await db.ingestKey.update({ where: { id }, data: { isActive: false } });
}
