import Link from "next/link";
import { ScoreRing } from "@/components/leads/score-ring";
import { StageBadge } from "@/components/leads/stage-badge";
import type { LeadListItemDTO } from "@/lib/leads/filters";
import { formatRupeesShort } from "@/lib/money";

/** One lead in the mobile list: 56 px minimum, whole card links to the detail page. */
export function LeadCard({ lead }: { lead: LeadListItemDTO }) {
  const detail = [
    lead.budgetRupees != null ? formatRupeesShort(lead.budgetRupees) : null,
    lead.project?.name,
    lead.owner?.name ?? "Unassigned",
  ].filter(Boolean);

  return (
    <Link href={`/leads/${lead.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-surface-2">
      <ScoreRing score={lead.score} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-fg">{lead.name}</span>
          <StageBadge stage={lead.stage} className="ml-auto shrink-0" />
        </span>
        <span className="flex min-w-0 gap-1.5 text-sm text-fg-muted">
          {detail.map((part, i) => (
            <span key={i} className={i === 0 ? "shrink-0 tabular-nums" : "truncate"}>
              {i > 0 && <span aria-hidden="true">· </span>}
              {part}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}
