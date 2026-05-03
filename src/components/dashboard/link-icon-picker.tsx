"use client";

import { useMemo, useState } from "react";
import { SearchIcon, SparklesIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  ICON_REGISTRY,
  resolveIconEntry,
  type IconKey,
} from "@/lib/link-icons";
import {
  TABLER_ICONS,
  TABLER_ICON_ALIASES,
  tablerKeyOf,
} from "@/lib/link-icons-tabler";
import { cn } from "@/lib/utils";

export type LinkIconPickerValue = {
  iconKey: IconKey | null;
  /** Legacy — uploads are no longer supported but DB may still hold a value. */
  iconUrl: string | null;
  /** Auto-fetched website cover. Picker can clear / restore this. */
  imageUrl: string | null;
};

type Props = {
  url: string;
  value: LinkIconPickerValue;
  onChange: (next: LinkIconPickerValue) => void;
  /**
   * Called when the user picks "auto" — gives the host a chance to
   * re-fetch website metadata so the cover image reappears.
   */
  onRefetch?: () => void;
};

type GridItem = {
  key: IconKey;
  label: string;
  search: string;
  // Icons come from two sources (Lucide-shaped & Tabler-shaped); allow either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
};

/**
 * Builds a single flat grid: brand icons first, then generic Tabler icons.
 * No categories, no labels, no upload — Notion/Linktree style.
 *
 * All items are rendered raw (just stroke), so brand icons sit visually
 * alongside generic icons in the picker.
 */
function buildItems(): GridItem[] {
  const items: GridItem[] = [];
  for (const entry of Object.values(ICON_REGISTRY)) {
    if (entry.key === "auto") continue;
    items.push({
      key: entry.key,
      label: entry.label,
      search: `${entry.key} ${entry.label}`.toLowerCase(),
      Icon: entry.Icon,
    });
  }
  for (const [name, Icon] of Object.entries(TABLER_ICONS)) {
    const alias = TABLER_ICON_ALIASES[name] ?? "";
    items.push({
      key: tablerKeyOf(name),
      label: name.replace(/-/g, " "),
      search: `${name.replace(/-/g, " ")} ${alias}`.toLowerCase(),
      Icon,
    });
  }
  return items;
}

const ALL_ITEMS = buildItems();

export function LinkIconPicker({ url, value, onChange, onRefetch }: Props) {
  void url;
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_ITEMS;
    return ALL_ITEMS.filter((it) => it.search.includes(q));
  }, [query]);

  const isAuto = !value.iconUrl && (value.iconKey === "auto" || !value.iconKey);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-1 pb-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجو در آیکون‌ها"
            className="h-11 ps-9"
            enterKeyHint="search"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="px-1 pb-3">
        <button
          type="button"
          onClick={() => {
            onChange({ iconKey: "auto", iconUrl: null, imageUrl: null });
            onRefetch?.();
          }}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-bold transition-colors",
            isAuto
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:bg-muted",
          )}
        >
          <SparklesIcon className="size-4" />
          انتخاب خودکار با توجه به لینک
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            آیکونی پیدا نشد
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {items.map((entry) => {
              const selected = !value.iconUrl && value.iconKey === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  title={entry.label}
                  onClick={() =>
                    onChange({
                      iconKey: entry.key,
                      iconUrl: null,
                      imageUrl: null,
                    })
                  }
                  className={cn(
                    "tap-target flex aspect-square items-center justify-center rounded-2xl transition-colors hover:bg-muted",
                    selected && "bg-foreground/10 ring-2 ring-foreground/30",
                  )}
                >
                  <entry.Icon
                    width={22}
                    height={22}
                    className="text-foreground"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small icon bubble used across editor & public card. */
export function LinkIconBubble({
  iconKey,
  iconUrl,
  imageUrl,
  url,
  size = 36,
  className,
}: {
  iconKey: IconKey | null;
  iconUrl: string | null;
  imageUrl: string | null;
  url: string;
  size?: number;
  className?: string;
}) {
  if (iconUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-2xl bg-muted",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  if (imageUrl) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 overflow-hidden rounded-2xl bg-muted",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="size-full object-cover" />
      </span>
    );
  }
  const entry = resolveIconEntry(iconKey, url);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: entry.color }}
      aria-hidden
    >
      <entry.Icon
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
      />
    </span>
  );
}
