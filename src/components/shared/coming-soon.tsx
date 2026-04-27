import type { LucideIcon } from "lucide-react";

/**
 * Shared "to be activated soon" stub used by sidebar entries that point
 * at routes whose real implementations land in a later phase. Centralised
 * so the visual treatment doesn't drift across stubs and so swapping it
 * for a real page later is a single-file change per surface.
 *
 * Mirrors the `surface-card` typography of the rest of the dashboard.
 */
export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
      <div className="surface-card flex flex-col items-center justify-center gap-4 p-8 text-center sm:p-12">
        <div className="flex size-16 items-center justify-center rounded-4xl bg-primary/10 text-primary">
          <Icon className="size-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
            به‌زودی
          </span>
        </div>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
