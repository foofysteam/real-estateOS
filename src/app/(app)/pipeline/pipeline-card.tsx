"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { ScoreRing } from "@/components/leads/score-ring";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { PipelineCardItem } from "@/lib/leads/queries";
import { formatRupeesShort } from "@/lib/money";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Card body; shared by the in-column card and the drag overlay. */
export function CardBody({ lead, now }: { lead: PipelineCardItem; now: number }) {
  const overdue = lead.nextFollowUpAt != null && new Date(lead.nextFollowUpAt).getTime() < now;
  return (
    <Link href={`/leads/${lead.id}`} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-3">
      <ScoreRing score={lead.score} size={28} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-fg">{lead.name}</span>
          {overdue && (
            <span className="size-2 shrink-0 rounded-full bg-danger" role="img" aria-label="Follow-up overdue" />
          )}
        </span>
        <span className="flex min-w-0 gap-1.5 text-xs text-fg-muted">
          {lead.budgetRupees != null && <span className="shrink-0 tabular-nums">{formatRupeesShort(lead.budgetRupees)}</span>}
          {lead.project && <span className="truncate">{lead.project.name}</span>}
        </span>
      </span>
      <span
        className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg-muted"
        title={lead.owner?.name ?? "Unassigned"}
        aria-label={lead.owner ? `Owner ${lead.owner.name}` : "Unassigned"}
      >
        {lead.owner ? initials(lead.owner.name) : "–"}
      </span>
    </Link>
  );
}

export function PipelineCard({
  lead,
  now,
  onMoveClick,
}: {
  lead: PipelineCardItem;
  now: number;
  onMoveClick: (lead: PipelineCardItem) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "flex items-center rounded-md border border-border bg-surface hover:bg-surface-2",
        isDragging && "opacity-40",
      )}
    >
      <CardBody lead={lead} now={now} />
      <Button variant="ghost" size="sm" className="mr-1 shrink-0 lg:hidden" aria-label={`Move ${lead.name}`} onClick={() => onMoveClick(lead)}>
        Move
      </Button>
      {/* A separate grip keeps link taps and drags from fighting; desktop only. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag ${lead.name}`}
        className="hidden size-11 shrink-0 cursor-grab touch-none place-items-center rounded-md text-fg-muted hover:text-fg active:cursor-grabbing lg:grid"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
    </li>
  );
}
