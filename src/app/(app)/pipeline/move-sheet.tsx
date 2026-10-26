"use client";

import { useState, type FormEvent } from "react";
import type { LeadStage } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { PipelineCardItem } from "@/lib/leads/queries";
import { STAGE_LABELS, STAGE_ORDER, canTransition } from "@/lib/stages";
import { Field } from "@/components/ui/field";

type Props = {
  lead: PipelineCardItem | null;
  /** Open straight on the LOST reason step (a desktop drop onto the Lost column). */
  askLostReason?: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (to: LeadStage, lostReason?: string) => void;
};

export function MoveSheet({ lead, askLostReason = false, onOpenChange, onMove }: Props) {
  return (
    <Sheet open={lead != null} onOpenChange={onOpenChange}>
      {lead && (
        <SheetContent title={`Move ${lead.name}`} description={`Currently ${STAGE_LABELS[lead.stage]}`}>
          <MoveForm key={lead.id} current={lead.stage} askLostReason={askLostReason} onMove={onMove} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function MoveForm({ current, askLostReason, onMove }: { current: LeadStage; askLostReason: boolean; onMove: Props["onMove"] }) {
  const [losing, setLosing] = useState(askLostReason);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();

  function submitLost(e: FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return setReasonError("Add a reason for losing this lead");
    onMove("LOST", trimmed);
  }

  if (losing) {
    return (
      <form noValidate onSubmit={submitLost} className="flex flex-col gap-4">
        <Field id="move-lost-reason" label="Reason" error={reasonError}>
          <Input
            id="move-lost-reason"
            value={reason}
            maxLength={200}
            autoFocus
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? "move-lost-reason-error" : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(undefined);
            }}
          />
        </Field>
        <Button type="submit" variant="danger">
          Mark as lost
        </Button>
      </form>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {STAGE_ORDER.filter((s) => canTransition(current, s)).map((stage) => (
        <li key={stage}>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => (stage === "LOST" ? setLosing(true) : onMove(stage))}
          >
            {STAGE_LABELS[stage]}
          </Button>
        </li>
      ))}
    </ul>
  );
}
