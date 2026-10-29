import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

export type MetaConnectionSettings = { token: string | null; mcpUrl: string | null };

/**
 * One read of the stored MetaConnection: its page token (else META_ACCESS_TOKEN, else null) and its
 * saved MCP URL (null when blank or absent).
 */
export async function getMetaConnectionSettings(): Promise<MetaConnectionSettings> {
  const connection = await db.metaConnection.findUnique({ where: { id: 1 } });
  const token = connection?.accessTokenEnc ? decrypt(connection.accessTokenEnc) : (getEnv().META_ACCESS_TOKEN ?? null);
  return { token, mcpUrl: connection?.mcpUrl?.trim() || null };
}

/** The page token from the stored MetaConnection, else META_ACCESS_TOKEN, else null. */
export async function getMetaAccessToken(): Promise<string | null> {
  return (await getMetaConnectionSettings()).token;
}
