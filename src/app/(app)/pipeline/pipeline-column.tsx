"use client";

import { useDroppable } from "@dnd-kit/core";
import type { LeadStage } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";
import type { PipelineCardItem, PipelineColumn as Column } from "@/lib/leads/queries";
import { formatRupeesShort } from "@/lib/money";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/stages";
import { PipelineCard } from "./pipeline-card";

/** While a card is dragged, every column is a legal or an illegal target; otherwise idle. */
export type DropState = "idle" | "legal" | "illegal";

export function columnDomId(stage: LeadStage): string {
  return `pipeline-col-${stage}`;
}

export function PipelineColumn({
  column,
  dropState,
  now,
  onMoveClick,
}: {
  column: Column;
  dropState: DropState;
  now: number;
  onMoveClick: (lead: PipelineCardItem) => void;
}) {
  const { stage, count, totalBudgetRupees, leads } = column;
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: dropState === "illegal" });
  const headingId = `${columnDomId(stage)}-heading`;
  const hidden = count - leads.length;

  return (
    <section
      id={columnDomId(stage)}
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={cn(
        "flex w-[85vw] max-w-sm shrink-0 snap-center flex-col rounded-lg border border-border bg-surface-2/50 transition-opacity lg:w-72",
        dropState === "illegal" && "opacity-40",
        isOver && "ring-2 ring-accent",
      )}
    >
      <h2
        id={headingId}
        className={cn(
          "flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-semibold",
          STAGE_COLORS[stage].bg,
          STAGE_COLORS[stage].fg,
        )}
      >
        <span className="truncate">{STAGE_LABELS[stage]}</span>
        <span className="tabular-nums opacity-80">{count}</span>
        <span className="ml-auto shrink-0 text-xs font-medium tabular-nums">{formatRupeesShort(totalBudgetRupees)}</span>
      </h2>
      <ul className="flex min-h-24 flex-col gap-2 p-2">
        {leads.map((lead) => (
          <PipelineCard key={lead.id} lead={lead} now={now} onMoveClick={onMoveClick} />
        ))}
        {leads.length === 0 && <li className="py-6 text-center text-xs text-fg-muted">No leads</li>}
      </ul>
      {hidden > 0 && <p className="px-3 pb-3 text-xs text-fg-muted">+{hidden} more</p>}
    </section>
  );
}
