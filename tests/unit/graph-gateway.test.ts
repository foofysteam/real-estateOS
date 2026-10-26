import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphMetaAdsGateway } from "@/lib/meta/graph-gateway";
import { MetaNotConfiguredError } from "@/lib/meta/gateway";

vi.mock("@/lib/meta/token", () => ({ getMetaAccessToken: vi.fn(async () => null) }));

type FetchArgs = [string, { headers: Record<string, string> }];

function jsonFetch(body: unknown) {
  return vi.fn<(...args: FetchArgs) => Promise<Response>>(async () => new Response(JSON.stringify(body)));
}

describe("GraphMetaAdsGateway", () => {
  it("builds the campaigns URL with act_ prefix and bearer header", async () => {
    const f = jsonFetch({ data: [] });
    await new GraphMetaAdsGateway({ token: "t", version: "v24.0", fetchImpl: f as unknown as typeof fetch }).listCampaigns("123");
    expect(f.mock.calls[0][0]).toContain("/v24.0/act_123/campaigns?");
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer t");
  });

  it("does not double an existing act_ prefix", async () => {
    const f = jsonFetch({ data: [] });
    await new GraphMetaAdsGateway({ token: "t", version: "v24.0", fetchImpl: f as unknown as typeof fetch }).listCampaigns("act_123");
    expect(f.mock.calls[0][0]).toContain("/v24.0/act_123/campaigns?");
    expect(f.mock.calls[0][0]).not.toContain("act_act_");
  });

  it("sums lead actions into leads and computes costPerLeadRupees", async () => {
    const f = jsonFetch({
      data: [
        {
          spend: "1500.50",
          impressions: "1000",
          clicks: "50",
          actions: [
            { action_type: "lead", value: "6" },
            { action_type: "link_click", value: "40" },
            { action_type: "lead", value: "4" },
          ],
        },
      ],
    });
    const r = await new GraphMetaAdsGateway({ token: "t", version: "v24.0", fetchImpl: f as unknown as typeof fetch }).getInsights("123", {
      since: "2026-10-19",
      until: "2026-10-26",
    });
    const url = f.mock.calls[0][0];
    expect(url).toContain("/act_123/insights?");
    expect(url).toContain("time_range=" + encodeURIComponent(JSON.stringify({ since: "2026-10-19", until: "2026-10-26" })));
    expect(r.spendRupees).toBe(1500.5);
    expect(r.impressions).toBe(1000);
    expect(r.clicks).toBe(50);
    expect(r.leads).toBe(10);
    expect(r.costPerLeadRupees).toBe(150.05);
  });

  it("throws on a non-2xx response without leaking the token", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 400 }));
    const err = await new GraphMetaAdsGateway({ token: "secret-token", version: "v24.0", fetchImpl: f as unknown as typeof fetch })
      .listLeadForms("p1")
      .catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Graph API 400");
    expect((err as Error).message).not.toContain("secret-token");
  });
});

describe("getMetaGateway", () => {
  beforeEach(async () => {
    const { resetMetaGatewayForTests } = await import("@/lib/meta");
    resetMetaGatewayForTests();
  });

  it("getMetaGateway throws MetaNotConfiguredError without a token", async () => {
    const { getMetaGateway } = await import("@/lib/meta");
    await expect(getMetaGateway()).rejects.toBeInstanceOf(MetaNotConfiguredError);
  });
});
