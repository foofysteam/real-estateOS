import type { LeadStage } from "@/generated/prisma/client";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/stages";
import { cn } from "@/lib/cn";

export function StageBadge({ stage, className }: { stage: LeadStage; className?: string }) {
  const { bg, fg } = STAGE_COLORS[stage];
  return (
    <span
      data-stage={stage}
      className={cn("inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap", bg, fg, className)}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
