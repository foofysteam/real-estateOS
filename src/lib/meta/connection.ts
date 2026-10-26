import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getEnv } from "@/lib/env";

export type MetaConnectionInput = { pageId: string; adAccountId: string; accessToken?: string; mcpUrl?: string };

export type MetaEndpointInfo = { webhookUrl: string; verifyToken: string | null; gatewayMode: "mcp" | "graph" };

export type MetaConnectionView = MetaEndpointInfo & {
  pageId: string;
  adAccountId: string;
  hasToken: boolean;
  mcpUrl: string | null;
  leadFormIds: string[];
};

/**
 * Upsert the singleton connection. A blank token keeps the stored one; leadFormIds belongs to the
 * lead-form sync and is only initialised on create.
 */
export async function saveMetaConnection(input: MetaConnectionInput): Promise<void> {
  const token = input.accessToken?.trim();
  const accessTokenEnc = token ? encrypt(token) : undefined;
  const fields = { pageId: input.pageId, adAccountId: input.adAccountId, mcpUrl: input.mcpUrl || null };
  await db.metaConnection.upsert({
    where: { id: 1 },
    create: { id: 1, ...fields, accessTokenEnc: accessTokenEnc ?? "", leadFormIds: [] },
    update: { ...fields, ...(accessTokenEnc ? { accessTokenEnc } : {}) },
  });
}

/** Read-only values Meta needs for webhook setup, derived from the environment. */
export function getMetaEndpointInfo(): MetaEndpointInfo {
  const env = getEnv();
  const base = (env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return {
    webhookUrl: `${base}/api/webhooks/meta`,
    verifyToken: env.META_WEBHOOK_VERIFY_TOKEN ?? null,
    gatewayMode: env.META_GATEWAY,
  };
}

/** The stored connection for display. The token is reduced to `hasToken` and never leaves this module. */
export async function getMetaConnection(): Promise<MetaConnectionView | null> {
  const row = await db.metaConnection.findUnique({ where: { id: 1 } });
  if (!row) return null;
  return {
    pageId: row.pageId,
    adAccountId: row.adAccountId,
    hasToken: row.accessTokenEnc !== "",
    mcpUrl: row.mcpUrl,
    leadFormIds: row.leadFormIds,
    ...getMetaEndpointInfo(),
  };
}
