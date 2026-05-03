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
  /**
   * Whether the *current* page is on a trial subscription
   * (status === "trialing"). Drives the bar's primary purpose — the
   * countdown to trial expiry. We gate on trial status rather than
   * plan key so the bar disappears the moment the user upgrades,
   * downgrades, or the trial converts/expires (see BILLING.md "do not
   * compare plan keys in product code").
   */
  isOnTrial: boolean;
  /** End-of-trial timestamp from `page_subscriptions.trial_ends_at`. */
  trialEndsAt: Date | null;
}

/**
 * Slim promo strip shown full-width above the authenticated shell.
 * Dark background so the content card below can sit on it with
 * rounded-top corners. Renders only while the current page is on an
 * active trial — the parent layout drops its dark background + rounded
 * container in lockstep when this returns null, so paid pages get a
 * flush, full-bleed surface.
 */
export function ProPromoBar({ isOnTrial, trialEndsAt }: ProPromoBarProps) {
  if (!isOnTrial || !trialEndsAt) return null;
  const days = daysRemaining(trialEndsAt);
  if (days <= 0) return null;

  return (
    <div
      dir="rtl"
      className="flex h-12 items-center justify-center gap-3 bg-zinc-950 px-4 text-xs font-semibold sm:text-sm"
    >
      <span className="text-white">
        {toPersianDigits(days)} روز تا پایان نسخه آزمایشی
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
