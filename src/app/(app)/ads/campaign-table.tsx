import { EmptyState } from "@/components/ui/empty-state";
import type { Campaign } from "@/lib/meta/gateway";
import { formatRupees } from "@/lib/money";
import { StatusBadge } from "./status-badge";

const TH = "h-10 border-b border-border px-3 text-left text-xs font-medium text-fg-muted";
const TD = "h-11 border-b border-border px-3 text-sm group-last:border-b-0";

/** "OUTCOME_LEADS" → "Leads". */
function objectiveLabel(objective: string): string {
  const words = objective.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "—";
}

function budget(c: Campaign): string {
  return c.dailyBudgetRupees != null ? `${formatRupees(Math.round(c.dailyBudgetRupees))}/day` : "—";
}

/** Campaigns as a table from md up and stacked cards below. */
export function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="campaigns-heading">
      <h2 id="campaigns-heading" className="text-base font-semibold text-fg">
        Campaigns
      </h2>
      {campaigns.length === 0 ? (
        <EmptyState message="No campaigns in this ad account yet." className="rounded-lg border border-border bg-surface" />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface md:hidden">
            {campaigns.map((c) => (
              <li key={c.id} className="flex min-h-14 flex-col justify-center gap-0.5 px-4 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-fg">{c.name}</span>
                  <StatusBadge status={c.status} className="ml-auto shrink-0" />
                </span>
                <span className="flex gap-1.5 text-sm text-fg-muted">
                  <span className="truncate">{objectiveLabel(c.objective)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0 tabular-nums">{budget(c)}</span>
                </span>
              </li>
            ))}
          </ul>
          <table className="hidden w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface md:table">
            <thead>
              <tr>
                <th className={`${TH} w-[40%]`}>Name</th>
                <th className={TH}>Status</th>
                <th className={TH}>Objective</th>
                <th className={`${TH} text-right`}>Daily budget</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="group">
                  <td className={`${TD} truncate font-medium text-fg`}>{c.name}</td>
                  <td className={TD}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className={`${TD} truncate text-fg-muted`}>{objectiveLabel(c.objective)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{budget(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
