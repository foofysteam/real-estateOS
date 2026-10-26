import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getMetaAccessToken } from "@/lib/meta/token";
import { MetaNotConfiguredError, type MetaAdsGateway, type ToolMap } from "./gateway";
import { GraphMetaAdsGateway } from "./graph-gateway";
import { McpMetaAdsGateway, createMcpClientFactory } from "./mcp-gateway";

export * from "./gateway";

const toolMapSchema = z
  .object({ listCampaigns: z.string().min(1), getInsights: z.string().min(1), listLeadForms: z.string().min(1) })
  .partial()
  .strict();

let cached: { key: string; gateway: MetaAdsGateway } | undefined;

/** The configured Meta Ads gateway (MCP by default, Graph when META_GATEWAY=graph), memoised per token and mode. */
export async function getMetaGateway(): Promise<MetaAdsGateway> {
  const token = await getMetaAccessToken();
  if (!token) throw new MetaNotConfiguredError();
  const env = getEnv();
  const key = `${env.META_GATEWAY}\u0000${token}`;
  if (cached?.key === key) return cached.gateway;

  const gateway: MetaAdsGateway =
    env.META_GATEWAY === "graph"
      ? new GraphMetaAdsGateway({ token, version: env.META_GRAPH_VERSION })
      : new McpMetaAdsGateway({ connect: createMcpClientFactory(env.META_MCP_URL, token), toolMap: parseToolMap(env.META_MCP_TOOL_MAP) });
  cached = { key, gateway };
  return gateway;
}

function parseToolMap(raw: string | undefined): Partial<ToolMap> | undefined {
  if (!raw) return undefined;
  const result = toolMapSchema.safeParse(JSON.parse(raw));
  if (!result.success) throw new Error("META_MCP_TOOL_MAP must map listCampaigns/getInsights/listLeadForms to tool names");
  return result.data;
}

export function resetMetaGatewayForTests(): void {
  cached = undefined;
}
