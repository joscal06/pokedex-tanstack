import { GridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <GridSkeleton />
    </div>
  );
}
