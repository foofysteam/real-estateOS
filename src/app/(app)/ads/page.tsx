import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { MetaNotConfiguredError } from "@/lib/meta/gateway";
import { getCachedAdsOverview, type AdsOverview } from "@/lib/meta/overview";
import { AdsSummary } from "./ads-summary";
import { CampaignTable } from "./campaign-table";
import { ErrorPanel } from "./error-panel";
import { LeadFormsTable } from "./lead-forms-table";

export const metadata: Metadata = { title: "Ads · Sales OS" };

/** Never 500s on a Meta failure: every error becomes an ErrorPanel. */
async function loadOverview(): Promise<{ overview: AdsOverview } | { error: unknown }> {
  const conn = await db.metaConnection.findUnique({ where: { id: 1 }, select: { adAccountId: true, pageId: true } });
  if (!conn) return { error: new MetaNotConfiguredError() };
  try {
    return { overview: await getCachedAdsOverview(conn) };
  } catch (error) {
    return { error };
  }
}

export default async function AdsPage() {
  await requireUser();
  const result = await loadOverview();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <h1 className="text-xl font-semibold text-fg">Ads</h1>
      {"error" in result ? (
        <ErrorPanel error={result.error} />
      ) : (
        <>
          <AdsSummary last7={result.overview.last7} last30={result.overview.last30} />
          <CampaignTable campaigns={result.overview.campaigns} />
          <LeadFormsTable forms={result.overview.leadForms} />
        </>
      )}
    </div>
  );
}
