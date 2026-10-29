import type { LeadStage } from "@/generated/prisma/enums";
import { ScoreRing } from "@/components/leads/score-ring";
import { StageBadge } from "@/components/leads/stage-badge";

type Props = { name: string; score: number; stage: LeadStage; ownerName: string | null; projectName: string | null };

/** Sticks under the shell's top bar on phones so name, score and stage stay visible while scrolling. */
export function LeadHeader({ name, score, stage, ownerName, projectName }: Props) {
  return (
    <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mt-4 flex items-center gap-3 border-b border-border bg-bg py-3 md:static md:mt-0 md:border-b-0 md:py-0">
      <ScoreRing score={score} size={44} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold text-fg md:text-xl">{name}</h1>
        <p className="flex min-w-0 items-center gap-2 text-sm text-fg-muted">
          <StageBadge stage={stage} className="shrink-0" />
          <span className="truncate">{[ownerName ?? "Unassigned", projectName].filter(Boolean).join(" · ")}</span>
        </p>
      </div>
    </header>
  );
}
