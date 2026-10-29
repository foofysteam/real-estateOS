import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading leads</span>
      <Skeleton className="h-7 w-24" />
      <div className="flex flex-col gap-2 md:flex-row">
        <Skeleton className="h-11 md:w-64 lg:h-9" />
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-28 shrink-0 lg:h-9 lg:w-36" />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0 lg:min-h-11">
            <Skeleton className="size-8 rounded-full lg:size-7" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
