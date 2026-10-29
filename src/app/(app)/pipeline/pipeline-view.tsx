"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { changeStageAction } from "@/app/(app)/leads/[id]/actions";
import { cn } from "@/lib/cn";
import { UNASSIGNED, pipelineFiltersToSearchParams, type PipelineFilters } from "@/lib/leads/filters";
import type { PipelineColumn } from "@/lib/leads/queries";
import { PipelineBoard } from "./pipeline-board";

type Option = { id: string; name: string };

// Radix Select forbids "" as an item value, so ALL stands for "no filter".
const ALL = "__all";

/** Filters live in the URL; changing one replaces the query string and the server re-renders the board. */
export function PipelineView({
  filters,
  owners,
  projects,
  columns,
}: {
  filters: PipelineFilters;
  owners: Option[];
  projects: Option[];
  columns: PipelineColumn[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(filters);

  function apply(next: PipelineFilters) {
    const qs = pipelineFiltersToSearchParams(next).toString();
    startTransition(() => {
      setShown(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function select(key: "projectId" | "ownerId", label: string, allLabel: string, options: { value: string; label: string }[]) {
    return (
      <Select value={shown[key] ?? ALL} onValueChange={(v) => apply({ ...shown, [key]: v === ALL ? undefined : v })}>
        <SelectTrigger aria-label={label} className="w-auto! max-w-56 shrink-0 md:min-w-36" />
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        {select("projectId", "Project", "All projects", projects.map((p) => ({ value: p.id, label: p.name })))}
        {select("ownerId", "Owner", "All owners", [
          { value: UNASSIGNED, label: "Unassigned" },
          ...owners.map((o) => ({ value: o.id, label: o.name })),
        ])}
        <button
          type="button"
          aria-pressed={!!shown.includeLost}
          onClick={() => apply({ ...shown, includeLost: !shown.includeLost })}
          className={cn(
            "min-h-11 shrink-0 rounded-full border px-4 text-sm lg:min-h-9",
            shown.includeLost ? "border-accent bg-accent text-white dark:text-bg" : "border-border bg-surface text-fg",
          )}
        >
          Show lost
        </button>
      </div>
      <div className={cn("min-w-0 transition-opacity", isPending && "opacity-60")} aria-busy={isPending}>
        <PipelineBoard columns={columns} onMove={changeStageAction} />
      </div>
    </>
  );
}
