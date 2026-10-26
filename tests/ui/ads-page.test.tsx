import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MetaToolUnavailableError, type MetaAdsGateway } from "@/lib/meta/gateway";

// unstable_cache throws "Invariant: incrementalCache missing" outside the Next runtime, so it is an identity here:
// this covers the page's error branch with a real gateway error class, but not the cache boundary itself.
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: vi.fn(async () => ({ id: "u1", email: "a@x.in", name: "Admin", role: "ADMIN" })),
}));
vi.mock("@/lib/db", () => ({
  db: { metaConnection: { findUnique: vi.fn(async () => ({ adAccountId: "act_page_test", pageId: "page_test" })) } },
}));
vi.mock("@/lib/meta", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meta")>();
  const gateway: MetaAdsGateway = {
    listCampaigns: async () => Promise.reject(new actual.MetaToolUnavailableError("listCampaigns", ["ads_get_insights"])),
    getInsights: async () => ({ spendRupees: 0, impressions: 0, clicks: 0, leads: 0 }),
    listLeadForms: async () => [],
  };
  return { ...actual, getMetaGateway: vi.fn(async () => gateway) };
});

const { default: AdsPage } = await import("@/app/(app)/ads/page");

afterEach(cleanup);

describe("AdsPage", () => {
  it("renders the tool-unavailable panel when a gateway call fails", async () => {
    render(await AdsPage());
    expect(screen.getByRole("heading", { name: "Meta MCP tool unavailable" })).toBeInTheDocument();
    expect(screen.getByText("ads_get_insights")).toBeInTheDocument();
    expect(screen.getByText(new MetaToolUnavailableError("listCampaigns", ["ads_get_insights"]).message)).toBeInTheDocument();
  });
});
