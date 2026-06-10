"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon, SparklesIcon } from "lucide-react";

import { TablerNodeIcon } from "@/components/shared/tabler-node-icon";
import { Input } from "@/components/ui/input";
import type { IconNode } from "@/lib/icons/icon-node";
import { useIconNodes } from "@/lib/icons/icon-nodes-context";
import {
  ICON_CATEGORY_LABELS,
  ICON_REGISTRY,
  resolveIconEntry,
  type IconCategory,
  type IconKey,
} from "@/lib/link-icons";
import {
  TABLER_ICONS,
  TABLER_ICON_ALIASES,
  TABLER_ICON_GROUPS,
  tablerKeyOf,
  tablerNameOf,
} from "@/lib/link-icons-tabler";
import { cn } from "@/lib/utils";

type RemoteIcon = {
  key: string;
  name: string;
  label: string;
  category: string;
  nodes: IconNode[];
};

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
  /**
   * Show the "auto-detect from URL" button. Defaults to true for links.
   * Pass false in contexts with no URL (e.g. menu category icons).
   */
  showAuto?: boolean;
};

type GridItem = {
  key: IconKey;
  label: string;
  search: string;
  // Icons come from two sources (Lucide-shaped & Tabler-shaped); allow either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
};

type TabGroup = {
  /** Stable tab value. */
  id: string;
  /** Persian tab label. */
  label: string;
  items: GridItem[];
};

const ALL_TAB_ID = "all";

function brandItem(key: IconKey, label: string, Icon: GridItem["Icon"]): GridItem {
  return { key, label, search: `${key} ${label}`.toLowerCase(), Icon };
}

function tablerItem(name: string): GridItem | null {
  const Icon = TABLER_ICONS[name];
  if (!Icon) return null;
  const alias = TABLER_ICON_ALIASES[name] ?? "";
  const label = name.replace(/-/g, " ");
  return { key: tablerKeyOf(name), label, search: `${label} ${alias}`.toLowerCase(), Icon };
}

/**
 * Builds the icon catalog grouped by native metadata:
 * - Brand icons are grouped by their `IconCategory` (ICON_REGISTRY).
 * - Generic Tabler icons are grouped by their catalog sections
 *   (TABLER_ICON_GROUPS).
 * The first tab ("همه") is a flat view of everything, so the picker still
 * works exactly like the old flat grid for users who don't care about tabs.
 * Search always runs across the full catalog regardless of the active tab.
 */
function buildCatalog(): { all: GridItem[]; tabs: TabGroup[] } {
  const all: GridItem[] = [];
  const tabs: TabGroup[] = [];

  // Brand icons grouped by IconCategory, preserving registry order.
  const byCategory = new Map<IconCategory, GridItem[]>();
  for (const entry of Object.values(ICON_REGISTRY)) {
    if (entry.key === "auto") continue;
    const item = brandItem(entry.key, entry.label, entry.Icon);
    all.push(item);
    const list = byCategory.get(entry.category);
    if (list) list.push(item);
    else byCategory.set(entry.category, [item]);
  }
  for (const [category, items] of byCategory) {
    tabs.push({ id: `brand:${category}`, label: ICON_CATEGORY_LABELS[category], items });
  }

  // Generic Tabler icons grouped by their catalog sections.
  for (const group of TABLER_ICON_GROUPS) {
    const items: GridItem[] = [];
    for (const name of group.keys) {
      const item = tablerItem(name);
      if (item) {
        items.push(item);
        all.push(item);
      }
    }
    if (items.length) tabs.push({ id: `tabler:${group.id}`, label: group.label, items });
  }

  return { all, tabs };
}

const CATALOG = buildCatalog();

export function LinkIconPicker({
  url,
  value,
  onChange,
  onRefetch,
  showAuto = true,
}: Props) {
  void url;
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB_ID);
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [remote, setRemote] = useState<RemoteIcon[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Instant local matches across the curated set.
  const localItems = useMemo(() => {
    if (searching) return CATALOG.all.filter((it) => it.search.includes(q));
    if (activeTab === ALL_TAB_ID) return CATALOG.all;
    return CATALOG.tabs.find((t) => t.id === activeTab)?.items ?? CATALOG.all;
  }, [searching, q, activeTab]);

  // Debounced full-catalog search (5039 icons) when the user types. Results
  // arrive as raw SVG nodes and are deduped against the curated matches.
  useEffect(() => {
    if (!searching || q.length < 2) {
      setRemote([]);
      setRemoteLoading(false);
      return;
    }
    let cancelled = false;
    setRemoteLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/icons/search?q=${encodeURIComponent(q)}`,
          { headers: { accept: "application/json" } },
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { icons?: RemoteIcon[] };
        if (!cancelled) setRemote(data.icons ?? []);
      } catch {
        if (!cancelled) setRemote([]);
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searching, q]);

  // Curated matches first (rendered via static components), then full-catalog
  // matches not already shown (rendered via inline SVG nodes).
  const remoteExtra = useMemo(() => {
    if (!searching) return [] as RemoteIcon[];
    const seen = new Set(localItems.map((it) => it.key));
    return remote.filter((r) => !seen.has(r.key));
  }, [searching, remote, localItems]);

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

      {showAuto ? (
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
      ) : null}

      {/* Category tabs — hidden while searching (search spans all icons). */}
      {!searching ? (
        <div
          ref={tabStripRef}
          className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-2 touch-pan-x"
          role="tablist"
        >
          {[{ id: ALL_TAB_ID, label: "همه" }, ...CATALOG.tabs].map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                activeTab === t.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {localItems.length === 0 && remoteExtra.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {remoteLoading ? "در حال جست‌وجو…" : "آیکونی پیدا نشد"}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {localItems.map((entry) => {
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
              {remoteExtra.map((entry) => {
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
                    <TablerNodeIcon
                      nodes={entry.nodes}
                      size={22}
                      className="text-foreground"
                    />
                  </button>
                );
              })}
            </div>
            {remoteLoading ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                در حال جست‌وجوی همه آیکون‌ها…
              </p>
            ) : null}
          </>
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
  return (
    <BubbleIcon iconKey={iconKey} url={url} size={size} className={className} />
  );
}

/**
 * Inner renderer for the icon-key case. Split out so it can read the icon-nodes
 * context: a `t:` key outside the curated bundle that the page embedded nodes
 * for is rendered inline; everything else resolves to a curated component (or
 * the auto/placeholder fallback).
 */
function BubbleIcon({
  iconKey,
  url,
  size,
  className,
}: {
  iconKey: IconKey | null;
  url: string;
  size: number;
  className?: string;
}) {
  const nodeMap = useIconNodes();
  const tablerName =
    iconKey && iconKey !== "auto" && !(iconKey in ICON_REGISTRY)
      ? tablerNameOf(iconKey)
      : null;
  const embedded = tablerName ? nodeMap[tablerName] : undefined;

  if (embedded && !(tablerName! in TABLER_ICONS)) {
    // Non-curated icon the page provided nodes for — render inline.
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-2xl bg-foreground text-white",
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <TablerNodeIcon
          nodes={embedded}
          size={Math.round(size * 0.55)}
        />
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
