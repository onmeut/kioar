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

import { useState } from "react";
import Image from "next/image";
import { TagIcon, XIcon } from "lucide-react";

import { LinkIconBubble } from "@/components/dashboard/link-icon-picker";
import type { IconKey } from "@/lib/link-icons";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsInMockup } from "@/components/dashboard/mockup-portal-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatPriceDisplay } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
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
  externalUrl: string | null;
  badge: string | null;
  sku: string | null;
};

export type PublicProductBlockData = {
  id: string;
  name: string;
  description: string | null;
  preset: string | null;
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
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = block.pillLabel || block.name || "مشاهده";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex w-full items-center justify-center rounded-full bg-foreground/4 px-4 py-4 transition-colors hover:bg-primary/8 active:bg-primary/12",
          className,
        )}
      >
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
      </button>
      <PublicProductModal open={open} onOpenChange={setOpen} block={block} />
    </>
  );
}

export function PublicProductInline({
  block,
  className,
}: {
  block: PublicProductBlockData;
  className?: string;
}) {
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
        className: "max-w-2xl p-0 overflow-hidden flex flex-col max-h-[90dvh]",
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
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {block.description ? (
            <p className="mb-4 text-sm text-foreground">{block.description}</p>
          ) : null}
          <ProductItemsList block={block} />
        </div>
      </Content>
    </Container>
  );
}

/** Sentinel used by the «همه» chip — distinguishes "no filter" from a
 * specific section id (which is a UUID string). */
const ALL_CATEGORIES = "__all__";

function ProductItemsList({ block }: { block: PublicProductBlockData }) {
  const visibleItems = block.items.filter((it) => it.availability !== "hidden");

  // Categories surfaced as chips are only those defined on the block AND
  // referenced by at least one visible item. Order follows the host's
  // configured category order (block.sections is already sorted by
  // sortOrder server-side).
  const sectionsById = new Map(block.sections.map((s) => [s.id, s]));
  const activeSectionIds = new Set(
    visibleItems
      .map((it) => it.sectionId)
      .filter((id): id is string => Boolean(id && sectionsById.has(id))),
  );
  const orderedActiveSections = block.sections.filter((s) =>
    activeSectionIds.has(s.id),
  );

  // Spec: hide the chip row entirely when there's only one (or zero)
  // category in active use — no clutter when categorization isn't
  // meaningful for this block.
  const showChips = orderedActiveSections.length >= 2;

  const [activeChip, setActiveChip] = useState<string>(ALL_CATEGORIES);

  if (visibleItems.length === 0) {
    return (
      <p className="rounded-2xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
        موردی برای نمایش وجود ندارد.
      </p>
    );
  }

  // If the previously-active chip refers to a category that no longer
  // appears in the active set (e.g., the host removed it or hid all its
  // items), fall back to «همه» silently rather than rendering an empty
  // state for a stale selection.
  const effectiveChip =
    activeChip === ALL_CATEGORIES ||
    orderedActiveSections.some((s) => s.id === activeChip)
      ? activeChip
      : ALL_CATEGORIES;

  const filteredItems =
    effectiveChip === ALL_CATEGORIES
      ? visibleItems
      : visibleItems.filter((it) => it.sectionId === effectiveChip);

  return (
    <div className="space-y-4">
      {showChips ? (
        <div
          className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 touch-pan-x"
          role="tablist"
          aria-label="دسته‌بندی محصولات"
        >
          <CategoryChip
            label="همه"
            selected={effectiveChip === ALL_CATEGORIES}
            onSelect={() => setActiveChip(ALL_CATEGORIES)}
          />
          {orderedActiveSections.map((s) => (
            <CategoryChip
              key={s.id}
              label={s.title}
              selected={effectiveChip === s.id}
              onSelect={() => setActiveChip(s.id)}
            />
          ))}
        </div>
      ) : null}

      {filteredItems.length === 0 ? (
        <p className="rounded-2xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
          موردی در این دسته‌بندی نیست.
        </p>
      ) : (
        <ProductLayout
          layout={block.layout}
          block={block}
          items={filteredItems}
        />
      )}
    </div>
  );
}

function CategoryChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-colors",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-foreground/4",
      )}
    >
      {label}
    </button>
  );
}

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
