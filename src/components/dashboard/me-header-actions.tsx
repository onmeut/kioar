"use client";

import { EyeIcon, SettingsIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { PublicShareBar } from "@/components/dashboard/public-share-bar";
import type { QrStyle } from "@/lib/qr/types";

interface MeHeaderActionsProps {
  publicUrl: string;
  slug: string;
  displayName: string;
  host: string;
  pageId: string;
  canCustomizeQr: boolean;
  savedQrStyle?: QrStyle | null;
  saveQrStyleAction?: (
    style: QrStyle,
  ) => Promise<{ status: string; message?: string }>;
}

/**
 * Mobile-only header actions that are only meaningful on `/me`:
 *   - "پیش‌نمایش" — opens the preview sheet rendered by
 *     `LinksPageClient`. Communicated via a custom DOM event because
 *     the preview state lives inside that client; bubbling an event
 *     keeps this component dumb and the sheet logic colocated with
 *     the editor it previews.
 *   - Share pill — shows the public URL and opens the system share
 *     dialog / QR card.
 *
 * Hidden on every other route (renders nothing) so the dashboard
 * header on /bookings, /forms etc. stays uncluttered.
 */
export function MeHeaderActions({
  publicUrl,
  slug,
  displayName,
  host,
  pageId,
  canCustomizeQr,
  savedQrStyle,
  saveQrStyleAction,
}: MeHeaderActionsProps) {
  const pathname = usePathname() || "";
  if (!/^\/me(\/|$)/.test(pathname)) return null;

  return (
    <>
      {/* Mobile: eye preview + share icon */}
      <div className="flex items-center gap-1 md:hidden">
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("open-page-preview"))
          }
          aria-label="پیش‌نمایش کارت"
          className="tap-target inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <EyeIcon className="size-5" aria-hidden />
        </button>
        <PublicShareBar
          publicUrl={publicUrl}
          slug={slug}
          displayName={displayName}
          host={host}
          pageId={pageId}
          canCustomizeQr={canCustomizeQr}
          savedQrStyle={savedQrStyle}
          saveQrStyleAction={saveQrStyleAction}
          variant="icon"
        />
      </div>

      {/* Desktop: full share pill, hugs content width */}
      <div className="hidden md:flex">
        <PublicShareBar
          publicUrl={publicUrl}
          slug={slug}
          displayName={displayName}
          host={host}
          pageId={pageId}
          canCustomizeQr={canCustomizeQr}
          savedQrStyle={savedQrStyle}
          saveQrStyleAction={saveQrStyleAction}
          variant="pill"
          className="w-auto max-w-none"
        />
      </div>
    </>
  );
}

/**
 * Mobile-only "page settings" gear button. Rendered on the start side
 * of the dashboard header on `/me`. Dispatches the same DOM event the
 * `LinksPageClient` already listens for to open `PageSettingsSheet`.
 */
export function MeSettingsButton() {
  const pathname = usePathname() || "";
  if (!/^\/me(\/|$)/.test(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("open-page-settings"))
      }
      aria-label="تنظیمات صفحه"
      className="tap-target inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted lg:hidden"
    >
      <SettingsIcon className="size-5" aria-hidden />
    </button>
  );
}
