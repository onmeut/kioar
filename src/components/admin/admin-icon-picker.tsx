"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { TABLER_ICONS, tablerKeyOf } from "@/lib/link-icons-tabler";
import { ALL_TABLER_ICON_NAMES } from "@/lib/tabler-icon-names";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = React.ComponentType<any>;
type TablerModule = Record<string, AnyIcon>;

/**
 * Convert "IconFireExtinguisher" → "fire-extinguisher" (for display / search).
 * Handles runs of uppercase (e.g. "IconAB2" → "a-b-2").
 */
function componentToDisplay(componentName: string): string {
  return componentName
    .replace(/^Icon/, "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .replace(/(\d)([a-zA-Z])/g, "$1-$2")
    .toLowerCase();
}

/** How many icons to show in the grid at once (performance guard). */
const PAGE_SIZE = 300;

/** When no query is typed, show the curated list so the picker loads fast. */
const CURATED_NAMES = Object.keys(TABLER_ICONS).map(
  (k) =>
    "Icon" +
    k
      .split("-")
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(""),
);

export type AdminIconPickerValue = {
  iconKey: string;
};

interface AdminIconPickerProps {
  value: string;
  onChange: (iconKey: string) => void;
}

export function AdminIconPicker({ value, onChange }: AdminIconPickerProps) {
  const [query, setQuery] = useState("");
  const [tablerMod, setTablerMod] = useState<TablerModule | null>(null);
  const loadingRef = useRef(false);

  // Lazy-load the entire tabler pack once on mount (admin only)
  useEffect(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    import("@tabler/icons-react")
      .then((m) => setTablerMod(m as unknown as TablerModule))
      .catch(() => {
        /* silently ignore */
      });
  }, []);

  const visibleNames = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "-");
    if (!q) {
      // No search: show curated list (already loaded icons)
      return CURATED_NAMES.slice(0, PAGE_SIZE);
    }
    return ALL_TABLER_ICON_NAMES.filter((n) => {
      const display = componentToDisplay(n);
      return (
        display.includes(q) ||
        display.replace(/-/g, "").includes(q.replace(/-/g, ""))
      );
    }).slice(0, PAGE_SIZE);
  }, [query]);

  function resolveIcon(componentName: string): AnyIcon | null {
    if (tablerMod) {
      const comp = tablerMod[componentName];
      if (comp) return comp;
    }
    // Fallback: try curated map while full pack loads
    const key = componentToDisplay(componentName);
    return (TABLER_ICONS[key] as AnyIcon | undefined) ?? null;
  }

  function componentToKey(componentName: string): string {
    return tablerKeyOf(componentToDisplay(componentName));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-1 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`جست‌وجو در ${ALL_TABLER_ICON_NAMES.length.toLocaleString()} آیکون`}
            className="h-11 ps-9"
            enterKeyHint="search"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {visibleNames.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            آیکونی پیدا نشد
          </div>
        ) : (
          <>
            {!query && !tablerMod && (
              <p className="mb-2 text-center text-xs text-muted-foreground">
                در حال بارگذاری کامل آیکون‌ها…
              </p>
            )}
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {visibleNames.map((componentName) => {
                const iconKey = componentToKey(componentName);
                const selected = value === iconKey;
                const Icon = resolveIcon(componentName);
                const label = componentToDisplay(componentName);
                return (
                  <button
                    key={componentName}
                    type="button"
                    title={label}
                    onClick={() => onChange(iconKey)}
                    className={cn(
                      "tap-target flex aspect-square items-center justify-center rounded-2xl transition-colors hover:bg-muted",
                      selected && "bg-foreground/10 ring-2 ring-foreground/30",
                    )}
                  >
                    {Icon ? (
                      <Icon
                        width={22}
                        height={22}
                        className="text-foreground"
                      />
                    ) : (
                      <span className="size-4 animate-pulse rounded bg-muted" />
                    )}
                  </button>
                );
              })}
            </div>
            {visibleNames.length === PAGE_SIZE && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                بیشتر از {PAGE_SIZE} نتیجه — جست‌وجو را دقیق‌تر کنید
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
