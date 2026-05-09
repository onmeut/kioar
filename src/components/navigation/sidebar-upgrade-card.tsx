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
 * Sidebar footer block. Plan-aware:
 *
 *   - Free      → glowing brand-tinted upsell card → `/pro`.
 *   - Pro       → soft "مدیریت اشتراک" card → page-scoped billing.
 *                 Replaces the dedicated nav item; this is now the
 *                 only billing entry from the sidebar for Pro pages.
 *   - Business  → null. Business owners reach billing from the
 *                 admin/settings surfaces; the sidebar stays clean.
 *
 * Sized to live inside `SidebarFooter` (no horizontal padding of its
 * own; relies on the footer’s `p-3`).
 */
export function SidebarUpgradeCard({
  pageId,
  planKey,
}: SidebarUpgradeCardProps) {
  if (planKey === "business") return null;

  if (planKey === "pro") {
    return (
      <ManageSubscriptionCard
        href={`/dashboard/pages/${pageId}/billing` as Route}
      />
    );
  }

  return (
    <UpgradeCard
      eyebrow="ارتقا"
      title="امکانات نامحدود کیوآر"
      subtitle="آمار پیشرفته، بلاک‌های ویژه و حذف برندینگ."
      href={"/pro" as Route}
      ariaLabel="خرید اشتراک پرو"
    />
  );
}

/**
 * The Pro variant. Soft, status-y card — not pushing anything, just
 * surfacing the billing surface. Whole card is the link to keep the
 * tap target generous on mobile.
 */
function ManageSubscriptionCard({ href }: { href: Route }) {
  return (
    <Link
      href={href}
      aria-label="مدیریت اشتراک"
      className={cn(
        "group relative block overflow-hidden rounded-2xl",
        "border border-border/70 bg-muted/40 p-3 pr-4",
        "transition-colors hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">مدیریت اشتراک</p>
        </div>
        <span
          aria-hidden
          className="text-muted-foreground transition-transform group-hover:-translate-x-0.5"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </span>
      </div>
    </Link>
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
      className={cn("rounded-2xl", "border border-border bg-muted/40", "p-3.5")}
    >
      {/* Sparkle + eyebrow */}
      <div className="mb-2 flex items-center gap-2 text-primary">
        <SparkleMark />
        <span className="text-[11px] font-bold uppercase">
          {eyebrow}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-extrabold leading-tight">{title}</p>
        <p className="text-[11.5px] leading-snug text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <Button
        render={<Link href={href} aria-label={ariaLabel} />}
        size="sm"
        className="relative mt-3 h-9 w-full font-bold"
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
