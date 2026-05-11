"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  IdCardIcon,
  QrCodeIcon,
  Share2Icon,
  XIcon,
} from "lucide-react";
import { IconBrandInstagram as InstagramIcon } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DEFAULT_QR_STYLE, type QrStyle } from "@/lib/qr/types";

import { QrRenderer } from "./qr-renderer";
import { QrCustomizeView } from "./qr-customize-view";
import { DigitalCardView } from "./digital-card-view";
import { IgInstallView } from "./ig-install-view";

type ShareModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full public URL — e.g. `https://kioar.com/<slug>`. */
  publicUrl: string;
  /** Slug only — used by the `/ig/<slug>` deep link. */
  slug: string;
  /** Domain host (e.g. `kioar.com`) for label rendering. */
  displayHost: string;
  /** User's display name (used by share sheet & vCard). */
  displayName: string;
  /** Current page id — used to scope localStorage fallback. */
  pageId: string;
  /** Whether the user's plan unlocks QR colour/style customisation. */
  canCustomizeQr: boolean;
  /** DB-backed QR style (single source of truth). Falls back to localStorage then DEFAULT. */
  savedQrStyle?: QrStyle | null;
  /** Server action that persists the QR style to the DB. */
  saveQrStyleAction?: (
    style: QrStyle,
  ) => Promise<{ status: string; message?: string }>;
};

type ShareView = "home" | "qr" | "card" | "ig";

const VIEW_TITLES: Record<ShareView, string> = {
  home: "اشتراک‌گذاری",
  qr: "کد QR",
  card: "کارت ویزیت دیجیتال",
  ig: "افزودن به بیوی اینستاگرام",
};

const STYLE_STORAGE_PREFIX = "kioar:qr-style:v1:";

/**
 * Single dialog with an in-modal "view" router. We keep all four
 * screens (home / qr / card / ig) inside one `<DialogContent>` so
 * the user perceives one cohesive surface that animates between
 * destinations — instead of stacking nested modals, which feels
 * clumsy on mobile.
 *
 * The QR style state lives at the modal level so that:
 *   - The home view's mini-preview matches whatever the user picks
 *     in the customize view (consistent UX).
 *   - We can hydrate from localStorage once per modal open without
 *     re-loading whenever a child view re-mounts.
 */
export function ShareModal({
  open,
  onOpenChange,
  publicUrl,
  slug,
  displayHost,
  displayName,
  pageId,
  canCustomizeQr,
  savedQrStyle,
  saveQrStyleAction,
}: ShareModalProps) {
  const [view, setView] = useState<ShareView>("home");
  // DB value is the source of truth; fall back to localStorage, then DEFAULT.
  const [qrStyle, setQrStyle] = useState<QrStyle>(
    () => savedQrStyle ?? loadSavedStyle(pageId),
  );

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    // Reset to home whenever the dialog re-opens so the user always
    // lands on the canonical screen, not whatever sub-view they left.
    if (!next) {
      window.setTimeout(() => setView("home"), 200);
    }
  }

  async function handleSaveQrStyle(style: QrStyle) {
    setQrStyle(style);
    // Mirror to localStorage so the style is available on next open even
    // before the server responds (optimistic update).
    try {
      window.localStorage.setItem(
        STYLE_STORAGE_PREFIX + pageId,
        JSON.stringify(style),
      );
    } catch {
      /* localStorage unavailable in private mode — silent ok */
    }
    // Persist to DB if an action was provided.
    if (saveQrStyleAction) {
      await saveQrStyleAction(style);
    }
    toast.success("شخصی‌سازی کیو‌آر‌کد ذخیره شد.");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md gap-0 p-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* Visually-hidden title satisfies aria-labelledby for screen
            readers without competing with our custom header. */}
        <DialogTitle className="sr-only">{VIEW_TITLES[view]}</DialogTitle>

        <ShareHeader
          view={view}
          onBack={() => setView("home")}
          onClose={() => handleOpenChange(false)}
        />

        <div className="max-h-[78vh] overflow-y-auto px-5 pb-5">
          <AnimatePresence mode="wait" initial={false}>
            {view === "home" ? (
              <motion.div
                key="home"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 1] }}
              >
                <HomeView
                  publicUrl={publicUrl}
                  displayHost={displayHost}
                  displayName={displayName}
                  qrStyle={qrStyle}
                  onOpenQr={() => setView("qr")}
                  onOpenCard={() => setView("card")}
                  onOpenIg={() => setView("ig")}
                />
              </motion.div>
            ) : view === "qr" ? (
              <motion.div
                key="qr"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 1] }}
              >
                <QrCustomizeView
                  publicUrl={publicUrl}
                  displayName={displayName}
                  initialStyle={qrStyle}
                  canCustomize={canCustomizeQr}
                  onSave={async (s) => {
                    await handleSaveQrStyle(s);
                    setView("home");
                  }}
                  onCancel={() => setView("home")}
                />
              </motion.div>
            ) : view === "card" ? (
              <motion.div
                key="card"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 1] }}
              >
                <DigitalCardView
                  publicUrl={publicUrl}
                  slug={slug}
                  displayName={displayName}
                  qrStyle={qrStyle}
                />
              </motion.div>
            ) : (
              <motion.div
                key="ig"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 1] }}
              >
                <IgInstallView publicUrl={publicUrl} slug={slug} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function ShareHeader({
  view,
  onBack,
  onClose,
}: {
  view: ShareView;
  onBack: () => void;
  onClose: () => void;
}) {
  const showBack = view !== "home";
  return (
    <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-3">
      <div className="flex items-center gap-2">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="بازگشت"
            className="tap-target inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeftIcon className="size-5 rtl:rotate-180" aria-hidden />
          </button>
        ) : null}
        <h2 className="text-base font-semibold">{VIEW_TITLES[view]}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="بستن"
        className="tap-target inline-flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
      >
        <XIcon className="size-5" aria-hidden />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home view (URL row + QR preview + action grid)
// ---------------------------------------------------------------------------

function HomeView({
  publicUrl,
  displayHost,
  displayName,
  qrStyle,
  onOpenQr,
  onOpenCard,
  onOpenIg,
}: {
  publicUrl: string;
  displayHost: string;
  displayName: string;
  qrStyle: QrStyle;
  onOpenQr: () => void;
  onOpenCard: () => void;
  onOpenIg: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("لینک کپی شد.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("کپی ممکن نشد.");
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: displayName, url: publicUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <div className="space-y-4">
      {/* URL chip — logo + url + کپی button */}
      <div
        dir="ltr"
        className="flex items-center gap-2.5 rounded-full border border-border bg-muted/40 ps-3.5 pe-1.5 py-1.5"
      >
        <Image
          src="/brand/logo.svg"
          alt=""
          width={14}
          height={18}
          className="shrink-0 opacity-75"
        />
        <span className="flex-1 truncate text-sm font-medium text-foreground/80">
          {displayHost}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={copy}
          className="h-8 rounded-full px-4 text-sm"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3.5" aria-hidden />
              <span className="font-medium">کپی شد</span>
            </>
          ) : (
            <span className="font-medium">کپی</span>
          )}
        </Button>
      </div>

      {/* QR card */}
      <button
        type="button"
        onClick={onOpenQr}
        className="group relative block w-full overflow-hidden rounded-3xl border border-border p-5 text-start transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:outline-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
        aria-label="ویرایش کد QR"
      >
        <div className="mx-auto aspect-square w-full max-w-[18rem]">
          <div className="size-full rounded-2xl bg-white p-3 shadow-sm">
            <QrRenderer
              text={publicUrl}
              style={qrStyle}
              className="size-full"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors group-hover:text-foreground">
          <QrCodeIcon className="size-3.5" aria-hidden />
          <span>برای دانلود و شخصی‌سازی، تپ کنید</span>
        </div>
      </button>

      {/* Action row — horizontal scroll, Linktree-style */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
        <ActionTile
          icon={
            <Image
              src="/brand/logo.svg"
              alt=""
              width={20}
              height={26}
              className="opacity-90"
            />
          }
          label="کیوآرِ من"
          href={publicUrl}
        />
        <ActionTile
          icon={<QrCodeIcon className="size-5" aria-hidden />}
          label="کد QR"
          onClick={onOpenQr}
        />
        <ActionTile
          icon={<IdCardIcon className="size-5" aria-hidden />}
          label="کارت ویزیت"
          badge="جدید"
          onClick={onOpenCard}
        />
        <ActionTile
          icon={<InstagramIcon className="size-5" aria-hidden />}
          label="بیوی اینستاگرام"
          onClick={onOpenIg}
        />
        <ActionTile
          icon={<Share2Icon className="size-5" aria-hidden />}
          label="اشتراک سیستمی"
          onClick={nativeShare}
        />
      </div>
    </div>
  );
}

function ActionTile({
  icon,
  label,
  badge,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className="relative inline-flex size-12 items-center justify-center rounded-full bg-muted text-foreground shrink-0">
        {icon}
        {badge ? (
          <span className="absolute -top-1.5 inset-s-1/2 -translate-x-1/2 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-white ring-2 ring-background">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="text-[11px] leading-tight font-medium text-foreground/90 text-center w-full">
        {label}
      </span>
    </>
  );

  const cls = cn(
    "tap-target flex flex-col items-center justify-start gap-1.5 rounded-2xl border border-transparent p-2 text-center transition-colors min-w-[4.5rem]",
    "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:outline-none",
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadSavedStyle(pageId: string): QrStyle {
  if (typeof window === "undefined") return DEFAULT_QR_STYLE;
  try {
    const raw = window.localStorage.getItem(STYLE_STORAGE_PREFIX + pageId);
    if (!raw) return DEFAULT_QR_STYLE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_QR_STYLE, ...parsed };
  } catch {
    return DEFAULT_QR_STYLE;
  }
}
