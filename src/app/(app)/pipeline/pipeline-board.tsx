"use client";

import { useId, useOptimistic, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { LeadStage } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActionResult } from "@/lib/use-action";
import { useAction } from "@/lib/use-action";
import type { PipelineCardItem, PipelineColumn as Column } from "@/lib/leads/queries";
import { STAGE_LABELS, canTransition } from "@/lib/stages";
import { MoveSheet } from "./move-sheet";
import { CardBody } from "./pipeline-card";
import { PipelineColumn, columnDomId, type DropState } from "./pipeline-column";

type MoveFn = (leadId: string, to: LeadStage, lostReason?: string) => Promise<ActionResult> | void;
type Move = { lead: PipelineCardItem; to: LeadStage };

/** Pull the lead out of its column and put it on top of the target one (if shown). */
function applyMove(columns: Column[], { lead, to }: Move): Column[] {
  const budget = lead.budgetRupees ?? 0;
  return columns.map((col) => {
    if (col.stage === lead.stage) {
      const leads = col.leads.filter((l) => l.id !== lead.id);
      return { ...col, leads, count: col.count - 1, totalBudgetRupees: col.totalBudgetRupees - budget };
    }
    if (col.stage === to) {
      return { ...col, leads: [{ ...lead, stage: to }, ...col.leads], count: col.count + 1, totalBudgetRupees: col.totalBudgetRupees + budget };
    }
    return col;
  });
}

export function PipelineBoard({ columns, onMove, now }: { columns: Column[]; onMove: MoveFn; now?: number }) {
  const [shown, addMove] = useOptimistic(columns, applyMove);
  const { run, error } = useAction();
  const [sheet, setSheet] = useState<{ lead: PipelineCardItem; askLostReason: boolean } | null>(null);
  const [dragging, setDragging] = useState<PipelineCardItem | null>(null);
  const [mountedAt] = useState(() => Date.now());
  const at = now ?? mountedAt;
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function move(lead: PipelineCardItem, to: LeadStage, lostReason?: string) {
    setSheet(null);
    void run(async () => {
      addMove({ lead, to });
      const result = await (lostReason ? onMove(lead.id, to, lostReason) : onMove(lead.id, to));
      return result ?? { ok: true };
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const lead = active.data.current?.lead as PipelineCardItem | undefined;
    const to = over?.id as LeadStage | undefined;
    if (!lead || !to || !canTransition(lead.stage, to)) return;
    if (to === "LOST") setSheet({ lead, askLostReason: true });
    else move(lead, to);
  }

  function dropState(stage: LeadStage): DropState {
    if (!dragging || stage === dragging.stage) return "idle";
    return canTransition(dragging.stage, stage) ? "legal" : "illegal";
  }

  if (shown.every((c) => c.count === 0)) {
    return (
      <EmptyState
        message="No leads yet."
        action={
          <Button asChild>
            <Link href="/leads">Add a lead</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-md bg-tone-danger-bg px-3 py-2 text-sm text-tone-danger-fg">
          {error}
        </p>
      )}
      <nav aria-label="Stages" className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden">
        {shown.map((c) => (
          <button
            key={c.stage}
            type="button"
            className="min-h-11 shrink-0 rounded-full border border-border bg-surface px-4 text-sm text-fg"
            onClick={() =>
              document
                .getElementById(columnDomId(c.stage))
                ?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" })
            }
          >
            {STAGE_LABELS[c.stage]}
          </button>
        ))}
      </nav>
      <DndContext
        id={dndId}
        sensors={sensors}
        onDragStart={({ active }: DragStartEvent) => setDragging((active.data.current?.lead as PipelineCardItem) ?? null)}
        onDragCancel={() => setDragging(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:snap-none lg:px-0">
          {shown.map((c) => (
            <PipelineColumn
              key={c.stage}
              column={c}
              dropState={dropState(c.stage)}
              now={at}
              onMoveClick={(lead) => setSheet({ lead, askLostReason: false })}
            />
          ))}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="flex w-72 rounded-md border border-border bg-surface pr-11 shadow-lg">
              <CardBody lead={dragging} now={at} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <MoveSheet
        lead={sheet?.lead ?? null}
        askLostReason={sheet?.askLostReason}
        onOpenChange={(open) => !open && setSheet(null)}
        onMove={(to, reason) => sheet && move(sheet.lead, to, reason)}
      />
    </div>
  );
}
