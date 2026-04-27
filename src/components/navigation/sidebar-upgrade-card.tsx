import Link from "next/link";
import type { Route } from "next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarUpgradeCardProps {
  /** Current page id — used to deep-link into the page-scoped plan picker. */
  pageId: string;
  /**
   * Plan key of the current page. Drives the entire card:
   *   - `free`     → upsell to Pro
   *   - `pro`      → upsell to Business
   *   - `business` → card hidden (returns null)
   *
   * Trial pages keep their underlying `planKey` (a Pro-trial sees the
   * Business upsell), per product brief — trial doesn’t change the
   * upsell ladder.
   *
   * NOTE: this is a *display* signal only. It must NOT be used to gate
   * any feature anywhere in the codebase — feature gating goes through
   * `pageHasFeature()`.
   */
  planKey: "free" | "pro" | "business";
}

/**
 * Sidebar footer block. Plan-aware upsell:
 *
 *   - Free  → glowing brand-tinted card pushing the Pro plan.
 *   - Pro   → same shell, copy + destination switched to Business
 *             (deep-links into the page-scoped plan picker so the page
 *             id is preserved through checkout).
 *   - Business → null. A Business page has nothing to upsell.
 *
 * Sized to live inside `SidebarFooter` (no horizontal padding of its
 * own; relies on the footer’s `p-3`).
 */
export function SidebarUpgradeCard({
  pageId,
  planKey,
}: SidebarUpgradeCardProps) {
  if (planKey === "business") return null;

  // The two upsell variants share a card shell; only the headline,
  // sub-copy, eyebrow label, and destination differ. Centralising the
  // copy here keeps the JSX one block.
  const variant =
    planKey === "free"
      ? {
          eyebrow: "ارتقا",
          title: "امکانات نامحدود کیوار",
          subtitle: "آمار پیشرفته، بلاک‌های ویژه و حذف برندینگ.",
          // `/pro` is the canonical entry point — it figures out the
          // right page-scoped plan picker route on the server.
          href: "/pro" as Route,
          ariaLabel: "خرید اشتراک پرو",
        }
      : {
          eyebrow: "ارتقا به Business",
          title: "رزرو، فرم و ابزار کسب‌وکار",
          subtitle: "اشتراک‌های متعدد، فرم‌های پیشرفته و رزرو حضوری.",
          // Pro → Business is a per-page change, so we route directly
          // into the page-scoped plan picker rather than `/pro`.
          href: `/dashboard/pages/${pageId}/billing/plans` as Route,
          ariaLabel: "ارتقا به اشتراک Business",
        };

  return (
    <UpgradeCard
      eyebrow={variant.eyebrow}
      title={variant.title}
      subtitle={variant.subtitle}
      href={variant.href}
      ariaLabel={variant.ariaLabel}
    />
  );
}

/**
 * The upgrade card itself. Kept as a private subcomponent so the public
 * API stays a single export, but split out so the JSX stays readable.
 *
 * Visual notes:
 *  - Background uses two stacked layers: a brand-tinted radial glow on
 *    top-end (works in both LTR/RTL because `radial-gradient` honors
 *    logical positioning via percentages) and a subtle linear sheen.
 *  - The decorative sparkle is purely cosmetic (`aria-hidden`) and uses
 *    `currentColor` so it inherits the brand tint.
 *  - Typography is tight on purpose — the sidebar is narrow and we want
 *    the CTA to dominate, not the copy.
 */
function UpgradeCard({
  eyebrow,
  title,
  subtitle,
  href,
  ariaLabel,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  href: Route;
  ariaLabel: string;
}) {
  return (
    <div
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl",
        "border border-primary/15 bg-gradient-to-br from-primary/8 via-background to-background",
        "p-3.5 shadow-[0_1px_0_0_oklch(1_0_0/0.6)_inset,0_8px_24px_-12px_oklch(0_0_0/0.18)]",
        "transition-shadow duration-300 hover:shadow-[0_1px_0_0_oklch(1_0_0/0.6)_inset,0_12px_28px_-10px_color-mix(in_srgb,var(--primary)_35%,transparent)]",
      )}
    >
      {/* Brand-tinted top-end glow. Decorative. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-12 -end-10 size-32 rounded-full",
          "bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--primary)_45%,transparent),transparent_70%)]",
          "opacity-70 blur-xl transition-opacity duration-500 group-hover:opacity-100",
        )}
      />

      {/* Sparkle sits in the start corner so it pairs with the glow on
          the opposite corner — makes the card feel “lit”. */}
      <div className="relative mb-2 flex items-center gap-2 text-primary">
        <SparkleMark />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
          {eyebrow}
        </span>
      </div>

      <div className="relative space-y-1">
        <p className="text-sm font-extrabold leading-tight">{title}</p>
        <p className="text-[11.5px] leading-snug text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <Button
        render={<Link href={href} aria-label={ariaLabel} />}
        size="sm"
        className={cn(
          "relative mt-3 h-9 w-full font-bold",
          "shadow-[0_4px_14px_-4px_color-mix(in_srgb,var(--primary)_60%,transparent)]",
        )}
      >
        خرید اشتراک
      </Button>
    </div>
  );
}

/**
 * Small bespoke sparkle. Inline SVG instead of a lucide icon so we get
 * a slightly thicker, "marketing-grade" stroke without pulling another
 * dependency or fighting lucide's default 2px stroke.
 */
function SparkleMark() {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-lg",
        "bg-primary text-primary-foreground",
        "shadow-[0_2px_8px_-2px_color-mix(in_srgb,var(--primary)_60%,transparent)]",
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 L13.6 9.2 L20 11 L13.6 12.8 L12 19 L10.4 12.8 L4 11 L10.4 9.2 Z" />
      </svg>
    </span>
  );
}
