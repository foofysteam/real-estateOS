import Link from "next/link";
import { ScoreRing } from "@/components/leads/score-ring";
import { StageBadge } from "@/components/leads/stage-badge";
import type { LeadListItemDTO } from "@/lib/leads/filters";
import { formatRupeesShort } from "@/lib/money";
import { SOURCE_LABELS } from "@/lib/sources";

const TH = "h-10 border-b border-border px-3 text-left text-xs font-medium text-fg-muted";
const TD = "h-11 border-b border-border px-3 text-sm group-last:border-b-0";

/** Desktop list (lg+). The name link stretches over the whole row, so any click opens the lead. */
export function LeadTable({ items }: { items: LeadListItemDTO[] }) {
  return (
    <table className="hidden w-full table-fixed border-separate border-spacing-0 rounded-lg border border-border bg-surface lg:table">
      <thead>
        <tr>
          <th className={`${TH} w-[28%]`}>Name</th>
          <th className={`${TH} w-[16%]`}>Stage</th>
          <th className={`${TH} w-16`}>Score</th>
          <th className={`${TH} w-20 text-right`}>Budget</th>
          <th className={TH}>Project</th>
          <th className={TH}>Owner</th>
          <th className={TH}>Source</th>
        </tr>
      </thead>
      <tbody>
        {items.map((lead) => (
          <tr key={lead.id} className="group relative hover:bg-surface-2">
            <td className={TD}>
              <Link
                href={`/leads/${lead.id}`}
                className="block truncate font-medium text-fg after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent"
              >
                {lead.name}
              </Link>
            </td>
            <td className={TD}>
              <StageBadge stage={lead.stage} />
            </td>
            <td className={TD}>
              <ScoreRing score={lead.score} size={28} />
            </td>
            <td className={`${TD} text-right tabular-nums`}>
              {lead.budgetRupees != null ? formatRupeesShort(lead.budgetRupees) : "—"}
            </td>
            <td className={`${TD} truncate text-fg-muted`}>{lead.project?.name ?? "—"}</td>
            <td className={`${TD} truncate text-fg-muted`}>{lead.owner?.name ?? "Unassigned"}</td>
            <td className={`${TD} truncate text-fg-muted`}>{SOURCE_LABELS[lead.source]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
