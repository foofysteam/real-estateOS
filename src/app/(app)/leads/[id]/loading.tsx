import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Loading lead</span>
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 md:h-11" />
        ))}
      </div>
      {[6, 2, 4].map((rows, s) => (
        <div key={s} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Card className="flex flex-col gap-3">
            {Array.from({ length: rows }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
