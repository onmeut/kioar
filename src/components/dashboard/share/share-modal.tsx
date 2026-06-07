"use client";

import { useState } from "react";
import {
  ArrowLeftIcon,
  IdCardIcon,
  QrCodeIcon,
  Share2Icon,
  XIcon,
} from "lucide-react";
import { IconBrandInstagram as InstagramIcon } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
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
  ig: "افزودن به اینستاگرام",
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
  const isMobile = useIsMobile();
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

  // The animated body is shared between Sheet (mobile) and Dialog (desktop).
  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
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
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[90dvh] flex-col gap-0 rounded-t-3xl p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">{VIEW_TITLES[view]}</SheetTitle>
          <ShareHeader
            view={view}
            onBack={() => setView("home")}
            onClose={() => handleOpenChange(false)}
          />
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-w-md flex-col gap-0 overflow-hidden p-0"
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

        {body}
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
    <div className="relative flex shrink-0 items-center justify-between px-5 pt-5 pb-4">
      <div className="size-8 shrink-0">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="بازگشت"
            className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
          >
            <ArrowLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
          </button>
        ) : null}
      </div>
      <h2 className="pointer-events-none absolute inset-x-0 text-center text-base font-semibold">
        {VIEW_TITLES[view]}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="بستن"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70"
      >
        <XIcon className="size-4" aria-hidden />
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

      {/* URL chip + copy button */}
      <div className="flex items-center gap-2 rounded-2xl border bg-muted/40 px-4 py-3" dir="ltr">
        <Image
          src="/brand/logo.svg"
          alt="Kioar"
          width={14}
          height={16}
          className="h-4 w-auto shrink-0"
        />
        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium">
          <span className="text-muted-foreground">https://</span>
          <span className="text-foreground">{displayHost}</span>
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-foreground/80"
        >
          {copied ? "کپی شد" : "کپی"}
        </button>
      </div>

      {/* Action row — equal-width grid */}
      <div className="grid grid-cols-5 gap-1">
        <ActionTile
          icon={
            <Image
              src="/brand/logo.svg"
              alt=""
              width={20}
              height={23}
              className="h-[23px] w-auto opacity-90"
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
          onClick={onOpenCard}
        />
        <ActionTile
          icon={<InstagramIcon className="size-5" aria-hidden />}
          label="اینستاگرام"
          onClick={onOpenIg}
        />
        <ActionTile
          icon={<Share2Icon className="size-5" aria-hidden />}
          label="اشتراک‌گذاری"
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
    "tap-target flex w-full flex-col items-center justify-start gap-1.5 rounded-2xl border border-transparent p-2 text-center transition-colors",
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
