import { Card } from "@/components/ui/card";
import type { Insights } from "@/lib/meta/gateway";
import { formatRupees, formatRupeesExact } from "@/lib/money";

const count = new Intl.NumberFormat("en-IN");

const TILES: ReadonlyArray<{ label: string; value: (i: Insights) => string }> = [
  { label: "Spend", value: (i) => formatRupees(Math.round(i.spendRupees)) },
  { label: "Leads", value: (i) => count.format(i.leads) },
  { label: "Cost / lead", value: (i) => (i.costPerLeadRupees != null ? formatRupeesExact(i.costPerLeadRupees) : "—") },
  { label: "Clicks", value: (i) => count.format(i.clicks) },
];

/** Four stat tiles: last 7 days large, last 30 days muted underneath. 2×2 on phones, 4-up from md. */
export function AdsSummary({ last7, last30 }: { last7: Insights; last30: Insights }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TILES.map((tile) => (
        <Card key={tile.label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-xs font-medium text-fg-muted">{tile.label}</dt>
          <dd className="truncate text-lg font-semibold md:text-xl text-fg tabular-nums">
            {tile.value(last7)}
            <span className="sr-only"> in the last 7 days</span>
          </dd>
          <dd className="truncate text-xs text-fg-muted tabular-nums">{tile.value(last30)} · 30 days</dd>
        </Card>
      ))}
    </dl>
  );
}
