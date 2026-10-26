"use client";

import { useState, type ReactNode } from "react";
import { ArrowRightLeft, CalendarPlus, MessageCircle, NotebookPen, Phone, UserRound } from "lucide-react";
import type { LeadStage } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { toTelLink, toWaLink } from "@/lib/phone";
import { assignLeadAction, changeStageAction, logContactAction, scheduleFollowUpAction } from "./actions";
import { AssignDialog, type Owner } from "./assign-dialog";
import { FollowUpDialog } from "./follow-up-dialog";
import { LogContactDialog } from "./log-contact-dialog";
import { StageDialog } from "./stage-dialog";
import { useAction } from "./use-action";

type SheetName = "contact" | "followUp" | "stage" | "assign";

type Props = { lead: { id: string; phone: string; stage: LeadStage; ownerId: string | null }; owners: Owner[] };

// `!` beats the Button's base size classes (cn has no tailwind-merge).
const tile =
  "min-h-14! flex-col gap-1! px-2! py-2 text-center text-xs! leading-tight whitespace-normal! " +
  "md:min-h-11! md:flex-row md:gap-2! md:text-sm!";

/** Six thumb-sized actions (2×3 on phones, one row from md) and the sheets they open. */
export function QuickActions({ lead, owners }: Props) {
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const { pending, error, run, clearError } = useAction();
  const close = () => setSheet(null);
  const sheetProps = (name: SheetName) => ({
    open: sheet === name,
    onOpenChange: (open: boolean) => {
      clearError();
      setSheet(open ? name : null);
    },
    pending,
    error,
  });

  const opener = (name: SheetName, icon: ReactNode, label: string) => (
    <Button variant="secondary" className={tile} onClick={() => sheetProps(name).onOpenChange(true)}>
      {icon}
      {label}
    </Button>
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        <Button asChild variant="secondary" className={tile}>
          <a href={toTelLink(lead.phone)}>
            <Phone aria-hidden="true" />
            Call
          </a>
        </Button>
        <Button asChild variant="secondary" className={tile}>
          <a href={toWaLink(lead.phone)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" />
            WhatsApp
          </a>
        </Button>
        {opener("contact", <NotebookPen aria-hidden="true" />, "Log contact")}
        {opener("followUp", <CalendarPlus aria-hidden="true" />, "Schedule follow-up")}
        {opener("stage", <ArrowRightLeft aria-hidden="true" />, "Change stage")}
        {opener("assign", <UserRound aria-hidden="true" />, "Assign")}
      </div>

      <LogContactDialog
        {...sheetProps("contact")}
        onSubmit={(channel, note) => run(() => logContactAction(lead.id, channel, note), close)}
      />
      <FollowUpDialog
        {...sheetProps("followUp")}
        onSubmit={(input) => run(() => scheduleFollowUpAction(lead.id, input), close)}
      />
      <StageDialog
        {...sheetProps("stage")}
        current={lead.stage}
        onSubmit={(to, reason) => run(() => changeStageAction(lead.id, to, reason), close)}
      />
      <AssignDialog
        {...sheetProps("assign")}
        owners={owners}
        currentOwnerId={lead.ownerId}
        onSubmit={(ownerId) => run(() => assignLeadAction(lead.id, ownerId), close)}
      />
    </>
  );
}
