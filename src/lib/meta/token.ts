import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

/** The page token from the stored MetaConnection, else META_ACCESS_TOKEN, else null. */
export async function getMetaAccessToken(): Promise<string | null> {
  const connection = await db.metaConnection.findUnique({ where: { id: 1 } });
  if (connection?.accessTokenEnc) return decrypt(connection.accessTokenEnc);
  return getEnv().META_ACCESS_TOKEN ?? null;
}
