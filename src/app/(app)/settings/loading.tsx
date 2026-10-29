import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading settings</span>
      <Skeleton className="h-7 w-24" />
      <div className="flex gap-2 border-b border-border pb-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="rounded-lg border border-border bg-surface">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
