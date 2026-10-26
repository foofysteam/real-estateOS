"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_FILTERS, leadFiltersToSearchParams, type LeadFilters as Filters, type LeadListItemDTO } from "@/lib/leads/filters";
import { cn } from "@/lib/cn";
import { LeadFilters } from "./lead-filters";
import { LeadList } from "./lead-list";

type Option = { id: string; name: string };

/** The URL is the source of truth: filter changes replace the query string and the server renders page one. */
export function LeadsView({
  filters,
  owners,
  projects,
  initialItems,
  initialCursor,
}: {
  filters: Filters;
  owners: Option[];
  projects: Option[];
  initialItems: LeadListItemDTO[];
  initialCursor: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // Controls show the new choice at once; they settle back to `filters` when the navigation lands.
  const [shown, setShown] = useOptimistic(filters);

  function apply(next: Filters) {
    const qs = leadFiltersToSearchParams(next).toString();
    startTransition(() => {
      setShown(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <>
      <LeadFilters filters={shown} owners={owners} projects={projects} onChange={apply} />
      <div className={cn("transition-opacity", isPending && "opacity-60")} aria-busy={isPending}>
        <LeadList
          key={leadFiltersToSearchParams(filters).toString()}
          initialItems={initialItems}
          initialCursor={initialCursor}
          filters={filters}
          onClearFilters={() => apply(DEFAULT_FILTERS)}
        />
      </div>
    </>
  );
}
