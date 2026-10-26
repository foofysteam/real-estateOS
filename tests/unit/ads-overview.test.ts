import { describe, expect, it, vi } from "vitest";
import { MetaToolUnavailableError, type Insights, type MetaAdsGateway } from "@/lib/meta/gateway";
import { getAdsOverview } from "@/lib/meta/overview";

const conn = { adAccountId: "act_1", pageId: "page_1" };
const insights: Insights = { spendRupees: 1234.5, impressions: 1000, clicks: 50, leads: 5, costPerLeadRupees: 246.9 };

function fakeGateway(overrides: Partial<MetaAdsGateway> = {}) {
  return {
    listCampaigns: vi.fn(async () => [{ id: "c1", name: "Launch", status: "ACTIVE", objective: "LEADS" }]),
    getInsights: vi.fn(async () => insights),
    listLeadForms: vi.fn(async () => [{ id: "f1", name: "Site visit", status: "ACTIVE", leadsCount: 3 }]),
    ...overrides,
  } satisfies MetaAdsGateway;
}

describe("getAdsOverview", () => {
  it("computes 7 and 30 day ranges ending today in IST and calls the gateway with them", async () => {
    const gw = fakeGateway();
    await getAdsOverview(gw, conn, new Date("2026-10-26T06:00:00Z"));
    expect(gw.getInsights).toHaveBeenCalledWith("act_1", { since: "2026-10-20", until: "2026-10-26" });
    expect(gw.getInsights).toHaveBeenCalledWith("act_1", { since: "2026-09-27", until: "2026-10-26" });
  });

  it("uses the IST date when UTC is still on the previous day", async () => {
    const gw = fakeGateway();
    await getAdsOverview(gw, conn, new Date("2026-10-25T20:00:00Z")); // 01:30 IST on 26 Oct
    expect(gw.getInsights).toHaveBeenCalledWith("act_1", { since: "2026-10-20", until: "2026-10-26" });
  });

  it("returns insights, campaigns for the ad account and lead forms for the page", async () => {
    const gw = fakeGateway();
    const overview = await getAdsOverview(gw, conn, new Date("2026-10-26T06:00:00Z"));
    expect(gw.listCampaigns).toHaveBeenCalledWith("act_1");
    expect(gw.listLeadForms).toHaveBeenCalledWith("page_1");
    expect(overview).toEqual({
      last7: insights,
      last30: insights,
      campaigns: [{ id: "c1", name: "Launch", status: "ACTIVE", objective: "LEADS" }],
      leadForms: [{ id: "f1", name: "Site visit", status: "ACTIVE", leadsCount: 3 }],
    });
  });

  it("propagates MetaToolUnavailableError unchanged", async () => {
    const error = new MetaToolUnavailableError("listLeadForms", ["ads_get_insights"]);
    const gw = fakeGateway({ listLeadForms: vi.fn(async () => Promise.reject(error)) });
    await expect(getAdsOverview(gw, conn)).rejects.toBe(error);
  });
});
