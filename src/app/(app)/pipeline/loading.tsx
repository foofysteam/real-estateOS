import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading pipeline</span>
      <Skeleton className="h-7 w-28" />
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-32 shrink-0 lg:h-9" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex w-[85vw] max-w-sm shrink-0 flex-col gap-2 rounded-lg border border-border p-2 lg:w-72">
            <Skeleton className="h-8" />
            {[0, 1, 2].map((j) => (
              <Skeleton key={j} className="h-14" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
