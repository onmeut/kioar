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
import Image from "next/image";
import { LayoutGridIcon, XIcon } from "lucide-react";

import { LinkIconBubble } from "@/components/dashboard/link-icon-picker";
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
  if (ungrouped?.length) groups.push({ id: "_", title: null, items: ungrouped });
  for (const section of block.sections) {
    const items = bySection.get(section.id);
    if (items?.length) groups.push({ id: section.id, title: section.title, items });
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
  const groups = useMemo(() => groupItems(block), [block]);
  const navGroups = groups.filter((g) => g.title !== null);
  const showNav = navGroups.length > 1;
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);
  const [catPanelOpen, setCatPanelOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const iconBySectionId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const s of block.sections) map.set(s.id, s.iconKey);
    return map;
  }, [block.sections]);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll-spy: modal uses a scroll container ref; page uses IntersectionObserver on window.
  useEffect(() => {
    if (!showNav) return;

    if (scrollContainerRef) {
      const container = scrollContainerRef.current;
      if (!container) return;
      const handleScroll = () => {
        const navHeight = navRef.current?.offsetHeight ?? 48;
        const containerTop = container.getBoundingClientRect().top;
        const threshold = containerTop + navHeight + 8;
        let found = groups[0]?.id ?? null;
        for (const g of groups) {
          const el = sectionRefs.current.get(g.id);
          if (el && el.getBoundingClientRect().top <= threshold) found = g.id;
        }
        setActiveId(found);
      };
      container.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();
      return () => container.removeEventListener("scroll", handleScroll);
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (visible) setActiveId(visible.target.getAttribute("data-group-id"));
        },
        { rootMargin: "-88px 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
      );
      for (const el of sectionRefs.current.values()) observer.observe(el);
      return () => observer.disconnect();
    }
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
      setActiveId(id);
      setCatPanelOpen(false);
      if (scrollContainerRef) {
        const container = scrollContainerRef.current;
        if (!container) return;
        const navHeight = navRef.current?.offsetHeight ?? 48;
        const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top - navHeight - 8;
        container.scrollBy({ top: delta, behavior: "smooth" });
      } else {
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: "smooth" });
      }
    },
    [scrollContainerRef],
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
        <div
          ref={navRef}
          className="sticky top-0 z-10 border-b border-border/40 bg-card/95 backdrop-blur-sm"
        >
          {/* Category chips row */}
          <div className="no-scrollbar flex items-center gap-2 px-4 py-2.5 touch-pan-x overflow-x-auto">
            <button
              type="button"
              onClick={() => setCatPanelOpen((v) => !v)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap",
                catPanelOpen
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-foreground hover:bg-foreground/4",
              )}
              aria-label="همه دسته‌بندی‌ها"
            >
              <LayoutGridIcon className="size-3.5 shrink-0" />
              دسته‌بندی‌ها
            </button>
            <div
              className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto touch-pan-x"
              role="tablist"
            >
              {navGroups.map((g) => (
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
                    "shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap",
                    activeId === g.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-foreground/4",
                  )}
                >
                  {g.title}
                </button>
              ))}
            </div>
          </div>

          {/* Inline categories dropdown panel */}
          {catPanelOpen ? (
            <div className="border-t border-border/40 bg-card px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCatPanelOpen(false)}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-foreground/4"
                  aria-label="بستن"
                >
                  <XIcon className="size-4" />
                </button>
                <p className="flex-1 text-center text-sm font-bold">دسته‌بندی‌ها</p>
                <div className="size-7" />
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {navGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => scrollToGroup(g.id)}
                    className="tap-target flex flex-col items-center gap-2 rounded-2xl border border-transparent p-2 text-center transition-colors hover:border-border hover:bg-foreground/4"
                  >
                    <LinkIconBubble
                      iconKey={iconBySectionId.get(g.id) ?? null}
                      iconUrl={null}
                      imageUrl={null}
                      url=""
                      size={56}
                    />
                    <span className="line-clamp-2 text-xs font-medium leading-snug">
                      {g.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
              <h4 className="mb-3 flex items-center gap-2 text-sm font-bold">
                {iconBySectionId.get(group.id) ? (
                  <LinkIconBubble
                    iconKey={iconBySectionId.get(group.id) ?? null}
                    iconUrl={null}
                    imageUrl={null}
                    url=""
                    size={24}
                  />
                ) : null}
                {group.title}
              </h4>
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
