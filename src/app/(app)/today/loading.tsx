import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TodayLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6" aria-busy="true">
      <span className="sr-only">Loading today’s follow-ups</span>
      <Skeleton className="h-7 w-24" />
      {[3, 2].map((rows, s) => (
        <div key={s} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Card className="p-0">
            {Array.from({ length: rows }, (_, i) => (
              <div
                key={i}
                className="flex min-h-14 flex-col justify-center gap-2 border-b border-border px-4 py-3 last:border-b-0 lg:min-h-11 lg:flex-row lg:items-center lg:py-1.5"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56 lg:ml-auto" />
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
