import Link from "next/link";
import { ZapIcon } from "lucide-react";

import { toPersianDigits } from "@/lib/persian";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns whole days remaining until `trialEndsAt`, rounded up so a
 * trial ending in 3 hours still reads as "1 day". Zero when expired.
 */
function daysRemaining(trialEndsAt: Date): number {
  const ms = trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_DAY);
}

export interface ProPromoBarProps {
  isOnTrial: boolean;
  /** End-of-trial timestamp from `page_subscriptions.trial_ends_at`. */
  trialEndsAt: Date | null;
  /**
   * Current plan key for the page. Used to keep showing the upgrade CTA
   * after the trial expires and the page reverts to Free.
   */
  planKey: "free" | "pro" | "business";
}

/**
 * Slim promo strip shown full-width above the authenticated shell.
 * Dark background so the content card below sits on it with rounded-top
 * corners. Visible for two states:
 *   1. Active trial  — countdown "X روز تا پایان نسخه آزمایشی"
 *   2. Free plan     — upgrade CTA (also covers post-trial fallback)
 * Paid pages receive a flush, full-bleed surface with no bar.
 */
export function ProPromoBar({
  isOnTrial,
  trialEndsAt,
  planKey,
}: ProPromoBarProps) {
  const isActiveTrial =
    isOnTrial && trialEndsAt && daysRemaining(trialEndsAt) > 0;

  if (!isActiveTrial && planKey !== "free") return null;

  return (
    <div
      dir="rtl"
      data-promo-bar=""
      className="relative z-30 flex h-12 shrink-0 items-center justify-center gap-3 bg-zinc-950 px-4 text-xs font-semibold sm:text-sm"
    >
      <span className="text-white">
        {isActiveTrial && trialEndsAt
          ? `${toPersianDigits(daysRemaining(trialEndsAt))} روز تا پایان نسخه آزمایشی`
          : "دسترسی به تمام امکاناتِ ویژه"}
      </span>
      <Link
        href={"/pro" as const}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-80 sm:text-xs"
      >
        <ZapIcon className="size-3 fill-white" aria-hidden />
        خرید اشتراک
      </Link>
    </div>
  );
}
