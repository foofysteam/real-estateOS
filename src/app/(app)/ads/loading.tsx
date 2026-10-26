import { Skeleton } from "@/components/ui/skeleton";

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-6 w-32" />
      <div className="rounded-lg border border-border bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0 md:min-h-11">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Loading ads</span>
      <Skeleton className="h-7 w-16" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={4} />
      <TableSkeleton rows={3} />
    </div>
  );
}
