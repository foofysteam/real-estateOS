"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadFilters, LeadListItemDTO } from "@/lib/leads/filters";
import { LeadCard } from "./lead-card";
import { LeadTable } from "./lead-table";
import { useInfiniteLeads } from "./use-infinite-leads";

export function LeadList({
  initialItems,
  initialCursor,
  filters,
  onClearFilters,
}: {
  initialItems: LeadListItemDTO[];
  initialCursor: string | null;
  filters: LeadFilters;
  onClearFilters: () => void;
}) {
  const { items, loadMore, hasMore, isLoading, error, sentinelRef } = useInfiniteLeads(filters, {
    items: initialItems,
    nextCursor: initialCursor,
  });

  if (items.length === 0) {
    return (
      <EmptyState
        message="No leads match."
        action={
          <Button variant="secondary" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface lg:hidden">
        {items.map((lead) => (
          <li key={lead.id}>
            <LeadCard lead={lead} />
          </li>
        ))}
      </ul>
      <LeadTable items={items} />

      {isLoading && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-14 lg:h-11" />
          <Skeleton className="h-14 lg:h-11" />
        </div>
      )}
      {hasMore && (
        <>
          <div ref={sentinelRef} aria-hidden="true" className="h-px" />
          <Button variant="secondary" className="self-center" disabled={isLoading} onClick={() => void loadMore()}>
            {error ? "Couldn’t load. Try again" : "Load more"}
          </Button>
        </>
      )}
      <p role="status" className="sr-only">
        {isLoading ? "Loading more leads" : `${items.length} leads shown`}
      </p>
    </div>
  );
}
