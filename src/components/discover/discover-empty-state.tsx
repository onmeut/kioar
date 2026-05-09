import { SearchIcon } from "lucide-react";

/**
 * Shown on `/discover` when the active category filter has no matching
 * pages. Mirrors the empty-state visual language used across the app
 * (dashboard, requests, etc.) — muted icon bubble + Persian copy.
 */
export function DiscoverEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-8 py-16 text-center shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <SearchIcon className="size-6" />
      </div>
      <div>
        <p className="text-base font-bold text-foreground">
          صفحه‌ای در این دسته‌بندی پیدا نشد
        </p>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          دسته‌بندی دیگری را امتحان کن یا «همه» را انتخاب کن.
        </p>
      </div>
    </div>
  );
}
