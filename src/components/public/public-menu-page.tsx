"use client";

// Public "menu" preset page — a restaurant-style menu rendered at
// `kioar.com/{profileSlug}/{blockSlug}`. Same data as any product block, but a
// menu-specific layout: a sticky horizontal section nav that smooth-scrolls to
// each category, and items as a flat list (name right / price right-aligned /
// thumbnail end), with greyed-out unavailable rows and a primary-accented
// featured badge.
//
// SharedMenuContent is also used by the modal in public-product-block.tsx so
// both surfaces render identically.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { LayoutGridIcon, UtensilsCrossedIcon, XIcon } from "lucide-react";
import { resolveIconEntry, type IconKey } from "@/lib/link-icons";
import { useIconNodes } from "@/lib/icons/icon-nodes-context";
import { TABLER_ICONS, tablerNameOf } from "@/lib/link-icons-tabler";
import { TablerNodeIcon } from "@/components/shared/tabler-node-icon";
import { formatPriceDisplay } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type {
  PublicProductBlockData,
  PublicProductItem,
} from "@/components/public/public-product-block";

export type MenuGroup = {
  id: string;
  title: string | null;
  iconKey: string | null;
  items: PublicProductItem[];
};

export function groupItems(block: PublicProductBlockData): MenuGroup[] {
  const visible = block.items.filter((it) => it.availability !== "hidden");
  const bySection = new Map<string, PublicProductItem[]>();
  for (const it of visible) {
    const key = it.sectionId ?? "";
    const list = bySection.get(key);
    if (list) list.push(it);
    else bySection.set(key, [it]);
  }
  const groups: MenuGroup[] = [];
  const ungrouped = bySection.get("");
  if (ungrouped?.length) groups.push({ id: "_", title: null, iconKey: null, items: ungrouped });
  for (const section of block.sections) {
    const items = bySection.get(section.id);
    if (items?.length) groups.push({ id: section.id, title: section.title, iconKey: section.iconKey, items });
  }
  return groups;
}

export function MenuItemRow({
  item,
  currency,
  showPrice,
}: {
  item: PublicProductItem;
  currency: PublicProductBlockData["currency"];
  showPrice: boolean;
}) {
  const soldOut = item.availability === "sold_out";
  const price = showPrice
    ? formatPriceDisplay(
        { priceType: item.priceType, priceAmount: item.priceAmount, priceAmountMax: item.priceAmountMax },
        currency,
      )
    : "";

  return (
    <li className={cn("flex items-start gap-3 py-4", soldOut && "opacity-50")}>
      {item.imageUrl ? (
        <div className="relative size-32 shrink-0 overflow-hidden rounded-xl bg-muted">
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            loading="lazy"
            sizes="128px"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Title row + inline badges */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-base font-semibold leading-snug">{item.title}</p>
          {item.isFeatured && !soldOut ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              پیشنهاد ما
            </span>
          ) : null}
          {item.badge && !soldOut ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {item.badge}
            </span>
          ) : null}
          {soldOut ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              ناموجود
            </span>
          ) : null}
        </div>
        {/* Description */}
        {item.description ? (
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            {item.description}
          </p>
        ) : null}
        {/* Price pinned to bottom */}
        <div className="flex-1" />
        {price ? (
          <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
            {toPersianDigits(price)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Shared menu body used by both the dedicated /slug/menu page and the
 * in-profile modal. Pass `scrollContainerRef` when rendered inside a scroll
 * container (modal); omit it for the full-page version which uses
 * IntersectionObserver on the window.
 */
export function SharedMenuContent({
  block,
  scrollContainerRef,
}: {
  block: PublicProductBlockData;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const nodeMap = useIconNodes();
  const groups = useMemo(() => groupItems(block), [block]);
  const navGroups = groups.filter((g) => g.title !== null);
  const showNav = navGroups.length > 1;
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);
  const [catPanelOpen, setCatPanelOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll-spy: find whichever section's top is the last one that passed the nav bottom.
  // Uses getBoundingClientRect so it works identically for window scroll and modal containers.
  useEffect(() => {
    if (!showNav) return;

    const handleScroll = () => {
      const navHeight = navRef.current?.offsetHeight ?? 48;
      // A section becomes active once its top edge reaches within `threshold` px of the viewport top.
      const threshold = navHeight + 16;
      let found = groups[0]?.id ?? null;
      for (const g of groups) {
        const el = sectionRefs.current.get(g.id);
        if (el && el.getBoundingClientRect().top <= threshold) found = g.id;
      }
      setActiveId(found);
    };

    const target = scrollContainerRef?.current ?? window;
    target.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => target.removeEventListener("scroll", handleScroll);
  }, [showNav, groups, scrollContainerRef]);

  // Keep the active chip scrolled into view in the nav strip.
  useEffect(() => {
    if (!activeId) return;
    chipRefs.current.get(activeId)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  const scrollToGroup = useCallback(
    (id: string) => {
      const el = sectionRefs.current.get(id);
      if (!el) return;

      const panelWasOpen = catPanelOpen;

      flushSync(() => {
        setActiveId(id);
        setCatPanelOpen(false);
      });

      const doScroll = () => {
        if (scrollContainerRef) {
          const container = scrollContainerRef.current;
          if (!container) return;
          const navHeight = navRef.current?.offsetHeight ?? 48;
          const containerTop = container.getBoundingClientRect().top;
          const elTop = el.getBoundingClientRect().top;
          const target = container.scrollTop + (elTop - containerTop) - navHeight - 8;
          container.scrollTo({ top: target, behavior: "smooth" });
        } else {
          const navHeight = navRef.current?.offsetHeight ?? 56;
          const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
          window.scrollTo({ top, behavior: "smooth" });
        }
      };

      if (panelWasOpen) {
        // Panel just collapsed — wait one frame for layout to settle before
        // measuring, otherwise getBoundingClientRect returns stale geometry.
        requestAnimationFrame(doScroll);
      } else {
        doScroll();
      }
    },
    [scrollContainerRef, catPanelOpen],
  );

  if (groups.length === 0 || groups.every((g) => g.items.length === 0)) {
    return (
      <div className="p-4">
        <p className="rounded-2xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
          موردی برای نمایش وجود ندارد.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      {showNav ? (
        <div ref={navRef} className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
          {catPanelOpen ? (
            /* Full-width category panel — replaces the chips bar entirely */
            <div className="border-b border-border/40 px-4 pb-4 pt-2.5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-3">
                <button
                  type="button"
                  onClick={() => setCatPanelOpen(false)}
                  className="justify-self-start shrink-0 inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-3 py-2 text-xs font-bold text-background whitespace-nowrap"
                  aria-label="بستن"
                >
                  <XIcon className="size-3.5 shrink-0" />
                  بستن
                </button>
                <p className="text-sm font-bold">دسته‌بندی‌ها</p>
                <div />
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {navGroups.map((g) => {
                  const tablerName = g.iconKey ? tablerNameOf(g.iconKey) : null;
                  const isNonCurated = tablerName && !(tablerName in TABLER_ICONS);
                  const iconNode = isNonCurated ? (nodeMap[tablerName] ?? null) : null;
                  const iconEntry = !iconNode && g.iconKey ? resolveIconEntry(g.iconKey as IconKey, null) : null;
                  const GroupIcon = iconEntry?.Icon;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => scrollToGroup(g.id)}
                      className="tap-target flex flex-col items-center gap-2 rounded-2xl border border-transparent p-2 text-center transition-colors hover:border-border hover:bg-foreground/4"
                    >
                      <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-white text-foreground">
                        {iconNode ? (
                          <TablerNodeIcon nodes={iconNode} size={28} />
                        ) : GroupIcon ? (
                          <GroupIcon className="size-7" />
                        ) : (
                          <UtensilsCrossedIcon className="size-7" />
                        )}
                      </span>
                      <span className="line-clamp-2 text-xs font-bold leading-snug">
                        {g.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Normal chips bar */
            <div className="no-scrollbar flex items-center gap-2 border-b border-border/40 px-4 py-2.5 touch-pan-x overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  if (scrollContainerRef?.current) {
                    scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
                  }
                  setCatPanelOpen(true);
                }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition-colors whitespace-nowrap hover:bg-foreground/4"
                aria-label="همه دسته‌بندی‌ها"
              >
                <LayoutGridIcon className="size-3.5 shrink-0" />
                دسته‌بندی‌ها
              </button>
              <div
                className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto touch-pan-x"
                role="tablist"
              >
                {navGroups.map((g) => {
                  const tablerName = g.iconKey ? tablerNameOf(g.iconKey) : null;
                  const isNonCurated = tablerName && !(tablerName in TABLER_ICONS);
                  const iconNode = isNonCurated ? (nodeMap[tablerName] ?? null) : null;
                  const iconEntry = !iconNode && g.iconKey ? resolveIconEntry(g.iconKey as IconKey, null) : null;
                  const GroupIcon = iconEntry?.Icon;
                  const hasIcon = iconNode || GroupIcon;
                  return (
                    <button
                      key={g.id}
                      ref={(el) => {
                        if (el) chipRefs.current.set(g.id, el);
                        else chipRefs.current.delete(g.id);
                      }}
                      type="button"
                      role="tab"
                      aria-selected={activeId === g.id}
                      onClick={() => scrollToGroup(g.id)}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 rounded-full border text-xs font-bold transition-colors whitespace-nowrap",
                        hasIcon ? "px-2.5 py-1.5" : "px-3 py-2",
                        activeId === g.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground hover:bg-foreground/4",
                      )}
                    >
                      {iconNode ? (
                        <TablerNodeIcon nodes={iconNode} size={20} className="shrink-0" />
                      ) : GroupIcon ? (
                        <GroupIcon className="size-5 shrink-0" />
                      ) : null}
                      {g.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="px-4">
        {groups.map((group) => (
          <section
            key={group.id}
            data-group-id={group.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(group.id, el);
              else sectionRefs.current.delete(group.id);
            }}
            className="scroll-mt-14 pt-5"
          >
            {group.title ? (
              <h4 className="mb-3 text-sm font-bold">{group.title}</h4>
            ) : null}
            <ul className="divide-y divide-border/70">
              {group.items.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  currency={block.currency}
                  showPrice={block.showPrices}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function PublicMenuPage({ block }: { block: PublicProductBlockData }) {
  return (
    <div className="w-full pb-6">
      {block.description ? (
        <p className="px-4 pt-4 text-sm text-muted-foreground lg:px-8">{block.description}</p>
      ) : null}
      <SharedMenuContent block={block} />
    </div>
  );
}
