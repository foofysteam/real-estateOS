import { unstable_cache } from "next/cache";
import type { Campaign, DateRange, Insights, LeadForm, MetaAdsGateway } from "./gateway";
import { getMetaGateway } from "./index";

export type AdsOverview = { last7: Insights; last30: Insights; campaigns: Campaign[]; leadForms: LeadForm[] };
export type AdsConnection = { adAccountId: string; pageId: string };

const istYmd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

/** Shift a YYYY-MM-DD date by whole days, in UTC so the host time zone can't drift it. */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The `days`-day range ending on today's IST date, inclusive. */
function lastDays(days: number, now: Date): DateRange {
  const today = istYmd.format(now);
  return { since: addDays(today, -(days - 1)), until: today };
}

/** Spend/leads for the last 7 and 30 IST days plus campaigns and lead forms. Gateway errors propagate unchanged. */
export async function getAdsOverview(gateway: MetaAdsGateway, conn: AdsConnection, now = new Date()): Promise<AdsOverview> {
  const [last7, last30, campaigns, leadForms] = await Promise.all([
    gateway.getInsights(conn.adAccountId, lastDays(7, now)),
    gateway.getInsights(conn.adAccountId, lastDays(30, now)),
    gateway.listCampaigns(conn.adAccountId),
    gateway.listLeadForms(conn.pageId),
  ]);
  return { last7, last30, campaigns, leadForms };
}

/**
 * getAdsOverview cached for 5 minutes per ad account and page. Thrown errors are never cached,
 * so a Meta failure always surfaces fresh. Only the plain ids cross the cache boundary.
 */
export function getCachedAdsOverview(conn: AdsConnection): Promise<AdsOverview> {
  const { adAccountId, pageId } = conn;
  return unstable_cache(
    async () => getAdsOverview(await getMetaGateway(), { adAccountId, pageId }),
    ["ads-overview", adAccountId, pageId],
    { revalidate: 300 },
  )();
}
