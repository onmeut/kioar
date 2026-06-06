"use client";

import * as React from "react";

import { GiftIcon } from "lucide-react";
import { toast } from "sonner";

/**
 * Pops a one-time celebration toast the first time the user opens the
 * dashboard after a new conversion `rewarded_at`. Stored as an ISO
 * string in localStorage so we don't ship a migration just for this.
 *
 * Renders nothing visible. Mounted on the dashboard referral page; it
 * could later be lifted into the dashboard layout to fire from any
 * page, but per-page is sufficient and avoids unnecessary work elsewhere.
 */
const STORAGE_KEY = "kioar:lastReferralToastAt";

export function ReferralRewardToaster({
  latestRewardedAt,
  monthsAvailable,
}: {
  latestRewardedAt: string | null;
  monthsAvailable: number;
}) {
  React.useEffect(() => {
    if (!latestRewardedAt || monthsAvailable < 1) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (stored && stored >= latestRewardedAt) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, latestRewardedAt);
    } catch {
      /* private mode — best effort */
    }
    // Defer one tick so the page paints first.
    const id = window.setTimeout(() => {
      toast.success("یک نفر دیگه با لینک تو پرو شد 🎉", {
        description:
          "۳ ماه پرو رایگان به اعتبار شما اضافه شد. آماده‌ی استفاده.",
        icon: <GiftIcon className="size-4" />,
        duration: 6000,
      });
    }, 250);
    return () => window.clearTimeout(id);
  }, [latestRewardedAt, monthsAvailable]);

  return null;
}
