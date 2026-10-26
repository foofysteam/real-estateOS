import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpMetaAdsGateway } from "@/lib/meta/mcp-gateway";
import { MetaToolUnavailableError } from "@/lib/meta/gateway";

function makeConnect(tools: Record<string, (args: unknown) => unknown>) {
  return async () => {
    const server = new McpServer({ name: "fake-meta", version: "0" });
    for (const [name, fn] of Object.entries(tools)) {
      server.registerTool(name, { inputSchema: {} }, async (args) => ({
        content: [{ type: "text" as const, text: JSON.stringify(fn(args)) }],
      }));
    }
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const client = new Client({ name: "sales-os-test", version: "0" });
    await client.connect(b);
    return client;
  };
}

describe("McpMetaAdsGateway", () => {
  it("lists campaigns through the default tool name and converts daily_budget minor units to rupees", async () => {
    const gw = new McpMetaAdsGateway({
      connect: makeConnect({
        ads_get_campaigns: () => ({
          data: [{ id: "c1", name: "Launch", status: "ACTIVE", objective: "OUTCOME_LEADS", daily_budget: "2000" }],
        }),
      }),
    });
    expect(await gw.listCampaigns("act_1")).toEqual([
      { id: "c1", name: "Launch", status: "ACTIVE", objective: "OUTCOME_LEADS", dailyBudgetRupees: 20 },
    ]);
  });

  it("honours a custom tool map", async () => {
    const gw = new McpMetaAdsGateway({
      connect: makeConnect({
        get_insights_v2: () => ({
          spend: "1500.50",
          impressions: 1000,
          clicks: 50,
          actions: [{ action_type: "lead", value: "10" }],
        }),
      }),
      toolMap: { getInsights: "get_insights_v2" },
    });
    expect(await gw.getInsights("act_1", { since: "2026-10-19", until: "2026-10-26" })).toEqual({
      spendRupees: 1500.5,
      impressions: 1000,
      clicks: 50,
      leads: 10,
      costPerLeadRupees: 150.05,
    });
  });

  it("throws MetaToolUnavailableError listing available tools when a mapped tool is missing", async () => {
    const gw = new McpMetaAdsGateway({ connect: makeConnect({ something_else: () => ({}) }) });
    const err = await gw.listLeadForms("p1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaToolUnavailableError);
    const e = err as MetaToolUnavailableError;
    expect(e.operation).toBe("listLeadForms");
    expect(e.available).toEqual(["something_else"]);
    expect(e.message).toContain("ads_get_lead_forms");
  });

  it("connects and lists tools only once across calls", async () => {
    const connect = vi.fn(
      makeConnect({ ads_get_campaigns: () => ({ data: [] }), ads_get_lead_forms: () => ({ data: [] }) }),
    );
    const gw = new McpMetaAdsGateway({ connect });
    await gw.listCampaigns("a");
    await gw.listLeadForms("p");
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
