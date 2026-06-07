"use client";

import { useState } from "react";
import { QrCodeIcon } from "lucide-react";
import Image from "next/image";

import { ShareModal } from "@/components/dashboard/share/share-modal";
import type { QrStyle } from "@/lib/qr/types";
import { cn } from "@/lib/utils";

type PublicShareBarProps = {
  publicUrl: string;
  slug: string;
  displayName: string;
  /** Current page id — scopes the persisted QR style preference. */
  pageId: string;
  /** Whether the user's plan unlocks QR colour/style customisation. */
  canCustomizeQr: boolean;
  /** DB-backed QR style — single source of truth for all QR renderers. */
  savedQrStyle?: QrStyle | null;
  /** Persists QR style to DB. */
  saveQrStyleAction?: (
    style: QrStyle,
  ) => Promise<{ status: string; message?: string }>;
  /** "{domain}/{slug}" — controls the host shown in the pill. */
  host?: string;
  /** When set, overrides the pill label text and switches to RTL layout. */
  label?: string;
  className?: string;
  /**
   * `pill` (default) renders the host/label pill. `icon` renders a
   * compact circular share button — used inside the mobile dashboard
   * header where we only have room for an affordance.
   */
  variant?: "pill" | "icon";
};

/**
 * Trigger surface for the share modal.
 *
 * The actual modal lives in `ShareModal`; this component only owns
 * the entry-point UI (pill or icon) and the open/close state. Keeps
 * the trigger reusable from any callsite that already has a slug +
 * URL handy.
 */
export function PublicShareBar({
  publicUrl,
  slug,
  displayName,
  pageId,
  canCustomizeQr,
  savedQrStyle,
  saveQrStyleAction,
  host,
  label,
  className,
  variant = "pill",
}: PublicShareBarProps) {
  const [open, setOpen] = useState(false);
  const displayHost = host ?? `kioar.com/${slug}`;

  const modal = (
    <ShareModal
      open={open}
      onOpenChange={setOpen}
      publicUrl={publicUrl}
      slug={slug}
      displayHost={displayHost}
      displayName={displayName}
      pageId={pageId}
      canCustomizeQr={canCustomizeQr}
      savedQrStyle={savedQrStyle}
      saveQrStyleAction={saveQrStyleAction}
    />
  );

  if (variant === "icon") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="اشتراک‌گذاری"
          className={cn(
            "tap-target inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted",
            className,
          )}
        >
          <QrCodeIcon className="size-5" aria-hidden />
        </button>
        {modal}
      </>
    );
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className={cn(
          "flex h-12 w-full max-w-62.5 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background/90 px-5 text-sm backdrop-blur transition-colors hover:bg-muted/60",
          className,
        )}
        dir={label ? "rtl" : "ltr"}
      >
        <Image src="/brand/logo.svg" alt="Kioar" width={14} height={16} className="h-4 w-auto shrink-0" />
        <span
          className="truncate font-semibold text-foreground"
          title={publicUrl}
        >
          {label ?? displayHost}
        </span>
        {!label && (
          <>
            <span className="shrink-0 text-border select-none">|</span>
            <span className="shrink-0 font-semibold text-foreground" dir="rtl">اشتراک‌گذاری</span>
          </>
        )}
      </div>
      {modal}
    </>
  );
}
