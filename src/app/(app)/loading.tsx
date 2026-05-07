import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="section-shell py-8">
      <div className="surface-card space-y-5 p-5 sm:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 rounded-4xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36 rounded-4xl" />
          <Skeleton className="h-36 rounded-4xl" />
        </div>
      </div>
    </div>
  );
}
