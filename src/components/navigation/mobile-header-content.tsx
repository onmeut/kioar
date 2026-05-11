"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparklesIcon } from "lucide-react";

import {
  MeHeaderActions,
  MeSettingsButton,
} from "@/components/dashboard/me-header-actions";
import type { QrStyle } from "@/lib/qr/types";
import { PageSwitcher, type PageSwitcherItem } from "./page-switcher";
import { cn } from "@/lib/utils";

interface MobileHeaderContentProps {
  // Page switcher data (shared across all layouts)
  pages: PageSwitcherItem[];
  currentPageId: string;
  // MeHeaderActions data (only shown on /me)
  publicUrl: string;
  slug: string;
  displayName: string;
  host: string;
  /** Forwarded to <PublicShareBar/> for QR style persistence + plan gating. */
  canCustomizeQr: boolean;
  savedQrStyle?: QrStyle | null;
  saveQrStyleAction?: (
    style: QrStyle,
  ) => Promise<{ status: string; message?: string }>;
  // Plan data (used in /more header)
  planKey: "free" | "pro" | "business";
  isOnTrial: boolean;
  trialEndsAt: Date | null | undefined;
  billingHref: string;
}

/**
 * Renders the mobile header content, switching layout depending on route:
 *
 *  `/more` — title on start (right in RTL), plan badge / upgrade CTA + PageSwitcher on end.
 *  everywhere else — MeSettingsButton on start, PageSwitcher absolutely centred, MeHeaderActions on end.
 */
export function MobileHeaderContent({
  pages,
  currentPageId,
  publicUrl,
  slug,
  displayName,
  host,
  canCustomizeQr,
  savedQrStyle,
  saveQrStyleAction,
  planKey,
  isOnTrial,
  trialEndsAt,
  billingHref,
}: MobileHeaderContentProps) {
  const pathname = usePathname() || "";
  const isMore = pathname === "/more";

  if (isMore) {
    const trialActive =
      isOnTrial && trialEndsAt && trialEndsAt.getTime() > Date.now();

    return (
      <div className="flex h-14 items-center gap-2 px-3">
        <h1 className="flex-1 text-xl font-bold">بیشتر</h1>
        <UpgradePill
          planKey={planKey}
          isOnTrial={!!trialActive}
          billingHref={billingHref}
        />
        <PageSwitcher
          pages={pages}
          currentPageId={currentPageId}
          variant="compact"
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-14 items-center px-3">
      <MeSettingsButton />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto">
          <PageSwitcher
            pages={pages}
            currentPageId={currentPageId}
            variant="compact"
          />
        </div>
      </div>
      <div className="ms-auto flex items-center gap-1">
        <MeHeaderActions
          publicUrl={publicUrl}
          slug={slug}
          displayName={displayName}
          host={host}
          pageId={currentPageId}
          canCustomizeQr={canCustomizeQr}
          savedQrStyle={savedQrStyle}
          saveQrStyleAction={saveQrStyleAction}
        />
      </div>
    </div>
  );
}

/**
 * Small inline badge / button that surfaces plan status in the /more
 * header. Logic:
 *   - free (no active trial) → filled CTA pill → /pro
 *   - free + active trial   → "پرو آزمایشی" subtle pill → billing
 *   - pro                   → "پرو" green badge
 *   - business              → "بیزنس" purple badge
 */
function UpgradePill({
  planKey,
  isOnTrial,
  billingHref,
}: {
  planKey: "free" | "pro" | "business";
  isOnTrial: boolean;
  billingHref: string;
}) {
  if (planKey === "free" && !isOnTrial) {
    return (
      <Link
        href={"/pro" as Route}
        aria-label="ارتقا به پرو"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-3",
          "bg-primary text-primary-foreground text-xs font-bold",
          "transition-opacity hover:opacity-90",
        )}
      >
        <SparklesIcon className="size-3.5" aria-hidden />
        ارتقا
      </Link>
    );
  }

  if (planKey === "free" && isOnTrial) {
    return (
      <Link
        href={billingHref as Route}
        aria-label="مدیریت اشتراک آزمایشی"
        className={cn(
          "inline-flex h-8 items-center rounded-full px-3",
          "border border-emerald-300 bg-emerald-50 text-emerald-700",
          "text-xs font-bold transition-colors hover:bg-emerald-100",
        )}
      >
        پرو آزمایشی
      </Link>
    );
  }

  if (planKey === "pro") {
    return (
      <Link
        href={billingHref as Route}
        aria-label="مدیریت اشتراک"
        className={cn(
          "inline-flex h-8 items-center rounded-full px-3",
          "bg-emerald-100 text-emerald-700 text-xs font-bold",
          "transition-colors hover:bg-emerald-200",
        )}
      >
        پرو
      </Link>
    );
  }

  if (planKey === "business") {
    return (
      <span
        className={cn(
          "inline-flex h-8 items-center rounded-full px-3",
          "bg-purple-100 text-purple-700 text-xs font-bold",
        )}
      >
        بیزنس
      </span>
    );
  }

  return null;
}
