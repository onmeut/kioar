"use client";

// Public product block — renders a "محصول" (Products & Services) block on
// a profile. By default the block collapses to a single pill that opens a
// modal listing the items; opt-in via `displayMode === "inline"` renders
// the items directly inline (no modal).
//
// Universal schema, vertical-specific *presentation*. Restaurant menus,
// e-commerce catalogs, service lists, package decks, and portfolios all
// share this surface; the only thing that changes is the layout (list /
// grid / cards) and the cosmetic itemLabel/pillLabel copy.

import { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from "react";
import Image from "next/image";
import { LayoutGridIcon, TagIcon, XIcon } from "lucide-react";

import { LinkIconBubble } from "@/components/dashboard/link-icon-picker";
import type { IconKey } from "@/lib/link-icons";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsInMockup } from "@/components/dashboard/mockup-portal-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatPriceDisplay } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import { SharedMenuContent } from "@/components/public/public-menu-page";
import type {
  ProductBlockCurrency,
  ProductBlockDisplayMode,
  ProductBlockLayout,
  ProductItemAvailability,
  ProductItemPriceType,
} from "@/lib/validations";
import { cn } from "@/lib/utils";

export type PublicProductSection = {
  id: string;
  title: string;
  iconKey: string | null;
};

export type PublicProductItem = {
  id: string;
  sectionId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceType: ProductItemPriceType;
  priceAmount: number;
  priceAmountMax: number | null;
  availability: ProductItemAvailability;
  isFeatured: boolean;
  externalUrl: string | null;
  badge: string | null;
  sku: string | null;
};

export type PublicProductBlockData = {
  id: string;
  name: string;
  description: string | null;
  preset: string | null;
  slug: string | null;
  layout: ProductBlockLayout;
  itemLabel: string | null;
  currency: ProductBlockCurrency;
  showPrices: boolean;
  displayMode: ProductBlockDisplayMode;
  pillLabel: string | null;
  iconKey: IconKey | string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  sortOrder?: number;
  sections: PublicProductSection[];
  items: PublicProductItem[];
};

export function PublicProductPill({
  block,
  className,
}: {
  block: PublicProductBlockData;
  /** @deprecated Kept for callers that still pass profileSlug; no longer used
   *  for navigation. All pills now open the in-place modal. */
  profileSlug?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = block.pillLabel || block.name || "مشاهده";

  const pillClass = cn(
    "relative flex w-full items-center justify-center rounded-full bg-foreground/4 px-4 py-4 transition-colors hover:bg-primary/8 active:bg-primary/12",
    className,
  );
  const inner = (
    <>
      <span className="absolute inset-s-3 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {block.iconKey || block.iconUrl || block.imageUrl ? (
          <LinkIconBubble
            iconKey={(block.iconKey as IconKey | null) ?? "auto"}
            iconUrl={block.iconUrl ?? null}
            imageUrl={block.imageUrl ?? null}
            url=""
            size={36}
            className="rounded-2xl"
          />
        ) : (
          <TagIcon className="size-5" />
        )}
      </span>
      <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
        {label}
      </span>
    </>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pillClass}>
        {inner}
      </button>
      <PublicProductModal open={open} onOpenChange={setOpen} block={block} />
    </>
  );
}

export function PublicProductInline({
  block,
  profileSlug,
  className,
}: {
  block: PublicProductBlockData;
  /** Owner's profile slug — enables the "view full page" link when the block
   * has its own dedicated-page slug. */
  profileSlug?: string;
  className?: string;
}) {
  const fullPageHref =
    profileSlug && block.slug ? `/${profileSlug}/${block.slug}` : null;
  return (
    <section className={cn("w-full", className)}>
      <header className="mb-3 px-1">
        <h3 className="text-base font-bold">{block.name}</h3>
        {block.description ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {block.description}
          </p>
        ) : null}
      </header>
      <ProductItemsList block={block} />
      {fullPageHref ? (
        <a
          href={fullPageHref}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-muted/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          {block.pillLabel || "مشاهده صفحه کامل"}
        </a>
      ) : null}
    </section>
  );
}

function PublicProductModal({
  open,
  onOpenChange,
  block,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: PublicProductBlockData;
}) {
  const isMobile = useIsMobile();
  const inMockup = useIsInMockup();
  const fullscreen = isMobile || inMockup;
  const Container = fullscreen ? Sheet : Dialog;
  const Content = fullscreen ? SheetContent : DialogContent;
  const Title = fullscreen ? SheetTitle : DialogTitle;

  const contentProps = fullscreen
    ? {
        side: "bottom" as const,
        className:
          "inset-0 h-full max-h-none rounded-none border-0 p-0 sm:max-w-none",
      }
    : {
        className: "max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[90dvh]",
      };

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <Content {...contentProps}>
        <div className="grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 border-b border-border bg-background px-4 py-3">
          <div />
          <Title className="text-center text-base font-bold">
            {block.name}
          </Title>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-8 place-items-center justify-self-end rounded-full text-muted-foreground hover:bg-foreground/4"
            aria-label="بستن"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <ProductItemsScroller block={block} />
      </Content>
    </Container>
  );
}

function ProductItemsScroller({ block }: { block: PublicProductBlockData }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {block.description ? (
        <p className="px-4 pt-4 mb-4 text-sm text-foreground">{block.description}</p>
      ) : null}
      {block.preset === "menu" ? (
        <SharedMenuContent block={block} scrollContainerRef={scrollRef} />
      ) : (
        <ProductItemsList block={block} scrollContainerRef={scrollRef} />
      )}
    </div>
  );
}


function ProductItemsList({
  block,
  scrollContainerRef,
}: {
  block: PublicProductBlockData;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const visibleItems = useMemo(
    () => block.items.filter((it) => it.availability !== "hidden"),
    [block.items],
  );

  const orderedActiveSections = useMemo(() => {
    const byId = new Map(block.sections.map((s) => [s.id, s]));
    const activeIds = new Set(
      visibleItems
        .map((it) => it.sectionId)
        .filter((id): id is string => Boolean(id && byId.has(id))),
    );
    return block.sections.filter((s) => activeIds.has(s.id));
  }, [block.sections, visibleItems]);

  const showNav = orderedActiveSections.length >= 2;

  const itemsBySection = useMemo(() => {
    const map = new Map<string, PublicProductItem[]>();
    for (const s of orderedActiveSections) map.set(s.id, []);
    const uncategorized: PublicProductItem[] = [];
    for (const item of visibleItems) {
      if (item.sectionId && map.has(item.sectionId)) {
        map.get(item.sectionId)!.push(item);
      } else {
        uncategorized.push(item);
      }
    }
    map.set("__uncategorized__", uncategorized);
    return map;
  }, [orderedActiveSections, visibleItems]);

  const [activeSection, setActiveSection] = useState<string>(
    orderedActiveSections[0]?.id ?? "",
  );
  const activeSectionRef = useRef(activeSection);
  const [catPanelOpen, setCatPanelOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const isScrollingProgrammatically = useRef(false);

  useEffect(() => {
    if (!showNav) return;
    const container = scrollContainerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingProgrammatically.current) return;
      const navHeight = navRef.current?.offsetHeight ?? 48;
      const containerRect = container.getBoundingClientRect();
      const threshold = containerRect.top + navHeight + 8;

      let found = orderedActiveSections[0]?.id;
      for (const section of orderedActiveSections) {
        const el = sectionRefs.current.get(section.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) found = section.id;
      }
      if (found && found !== activeSectionRef.current) {
        activeSectionRef.current = found;
        setActiveSection(found);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [showNav, scrollContainerRef, orderedActiveSections]);

  useEffect(() => {
    if (!activeSection) return;
    const chip = chipRefs.current.get(activeSection);
    chip?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeSection]);

  const scrollToSection = useCallback(
    (id: string) => {
      const el = sectionRefs.current.get(id);
      const container = scrollContainerRef?.current;
      if (!el || !container) return;

      activeSectionRef.current = id;
      setActiveSection(id);
      setCatPanelOpen(false);
      isScrollingProgrammatically.current = true;

      const navHeight = navRef.current?.offsetHeight ?? 48;
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta = elRect.top - containerRect.top - navHeight - 8;
      container.scrollBy({ top: delta, behavior: "smooth" });

      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 900);
    },
    [scrollContainerRef],
  );

  if (visibleItems.length === 0) {
    return (
      <div className="p-4">
        <p className="rounded-2xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
          موردی برای نمایش وجود ندارد.
        </p>
      </div>
    );
  }

  if (!showNav) {
    return (
      <div className="p-4">
        <ProductLayout layout={block.layout} block={block} items={visibleItems} />
      </div>
    );
  }

  return (
    <div>
      <div
        ref={navRef}
        className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur-sm"
      >
        {/* Category chips row */}
        <div
          className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 py-2.5 touch-pan-x"
          aria-label="دسته‌بندی محصولات"
        >
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
          <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto touch-pan-x" role="tablist">
            {orderedActiveSections.map((s) => (
              <CategoryChip
                key={s.id}
                ref={(el) => {
                  if (el) chipRefs.current.set(s.id, el);
                  else chipRefs.current.delete(s.id);
                }}
                label={s.title}
                selected={activeSection === s.id}
                onSelect={() => scrollToSection(s.id)}
              />
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
              {orderedActiveSections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className="tap-target flex flex-col items-center gap-2 rounded-2xl border border-transparent p-2 text-center transition-colors hover:border-border hover:bg-foreground/4"
                >
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <TagIcon className="size-5" />
                  </span>
                  <span className="line-clamp-2 text-xs font-medium leading-snug">
                    {s.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-8 p-4 pt-4">
        {orderedActiveSections.map((section) => {
          const sectionItems = itemsBySection.get(section.id) ?? [];
          if (sectionItems.length === 0) return null;
          return (
            <section
              key={section.id}
              data-section-id={section.id}
              ref={(el) => {
                if (el) sectionRefs.current.set(section.id, el as HTMLElement);
                else sectionRefs.current.delete(section.id);
              }}
            >
              <h4 className="mb-3 px-1 text-sm font-bold">{section.title}</h4>
              <ProductLayout layout={block.layout} block={block} items={sectionItems} />
            </section>
          );
        })}

        {(itemsBySection.get("__uncategorized__") ?? []).length > 0 && (
          <ProductLayout
            layout={block.layout}
            block={block}
            items={itemsBySection.get("__uncategorized__")!}
          />
        )}
      </div>
    </div>
  );
}

const CategoryChip = forwardRef<
  HTMLButtonElement,
  { label: string; selected: boolean; onSelect: () => void }
>(function CategoryChip({ label, selected, onSelect }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-foreground/4",
      )}
    >
      {label}
    </button>
  );
});

function ProductLayout({
  layout,
  block,
  items,
}: {
  layout: ProductBlockLayout;
  block: PublicProductBlockData;
  items: PublicProductItem[];
}) {
  if (layout === "grid") {
    return (
      <ul className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <ProductItemCard key={it.id} item={it} block={block} variant="grid" />
        ))}
      </ul>
    );
  }
  if (layout === "cards") {
    return (
      <ul className="space-y-3">
        {items.map((it) => (
          <ProductItemCard
            key={it.id}
            item={it}
            block={block}
            variant="cards"
          />
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <ProductItemCard key={it.id} item={it} block={block} variant="list" />
      ))}
    </ul>
  );
}

function ProductItemCard({
  item,
  block,
  variant,
}: {
  item: PublicProductItem;
  block: PublicProductBlockData;
  variant: "list" | "grid" | "cards";
}) {
  const soldOut = item.availability === "sold_out";
  const priceLabel = block.showPrices
    ? formatPriceDisplay(
        {
          priceType: item.priceType,
          priceAmount: item.priceAmount,
          priceAmountMax: item.priceAmountMax,
        },
        block.currency,
      )
    : "";

  const Wrapper: React.ElementType = item.externalUrl ? "a" : "div";
  const wrapperProps = item.externalUrl
    ? {
        href: item.externalUrl,
        target: "_blank" as const,
        rel: "noopener noreferrer",
      }
    : {};

  if (variant === "grid") {
    return (
      <li>
        <Wrapper
          {...wrapperProps}
          className={cn(
            "group block overflow-hidden rounded-2xl border border-border bg-background",
            soldOut && "opacity-60",
          )}
        >
          <div className="relative aspect-square w-full bg-muted">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                loading="lazy"
                sizes="(min-width: 768px) 240px, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">
                <TagIcon className="size-6" />
              </div>
            )}
            {item.badge ? (
              <span className="absolute top-2 inset-e-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                {item.badge}
              </span>
            ) : null}
          </div>
          <div className="p-3">
            <p className="truncate text-sm font-bold">{item.title}</p>
            {priceLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {soldOut ? "ناموجود" : toPersianDigits(priceLabel)}
              </p>
            ) : soldOut ? (
              <p className="mt-1 text-xs text-muted-foreground">ناموجود</p>
            ) : null}
          </div>
        </Wrapper>
      </li>
    );
  }

  if (variant === "cards") {
    return (
      <li>
        <Wrapper
          {...wrapperProps}
          className={cn(
            "block overflow-hidden rounded-2xl border border-border bg-background",
            soldOut && "opacity-60",
          )}
        >
          {item.imageUrl ? (
            <div className="relative aspect-video w-full bg-muted">
              <Image
                src={item.imageUrl}
                alt={item.title}
                fill
                loading="lazy"
                sizes="(min-width: 768px) 480px, 100vw"
                className="object-cover"
              />
              {item.badge ? (
                <span className="absolute top-2 inset-e-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {item.badge}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold">{item.title}</p>
              {priceLabel && !soldOut ? (
                <span className="shrink-0 text-sm font-bold text-primary">
                  {toPersianDigits(priceLabel)}
                </span>
              ) : null}
            </div>
            {item.description ? (
              <p className="text-xs text-muted-foreground">
                {item.description}
              </p>
            ) : null}
            {soldOut ? (
              <p className="text-xs text-muted-foreground">ناموجود</p>
            ) : null}
          </div>
        </Wrapper>
      </li>
    );
  }

  // list (default)
  return (
    <li>
      <Wrapper
        {...wrapperProps}
        className={cn(
          "flex items-center gap-3 rounded-2xl border border-border bg-background p-3",
          soldOut && "opacity-60",
        )}
      >
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              loading="lazy"
              sizes="56px"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <TagIcon className="size-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{item.title}</p>
            {item.badge ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {item.badge}
              </span>
            ) : null}
          </div>
          {item.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-end">
          {priceLabel && !soldOut ? (
            <span className="text-sm font-bold text-primary">
              {toPersianDigits(priceLabel)}
            </span>
          ) : null}
          {soldOut ? (
            <span className="text-xs text-muted-foreground">ناموجود</span>
          ) : null}
        </div>
      </Wrapper>
    </li>
  );
}
