"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * `beforeinstallprompt` event ported with the prompt() handle. Not in
 * lib.dom yet; this matches the WICG spec.
 */
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * v1 key (binary flag, no expiry) — kept only for migration.
 * If it exists we treat the user as having dismissed within the last week
 * so we don't immediately re-prompt after the deploy that introduced v2.
 */
const STORAGE_KEY_V1 = "kioar:install-prompt-dismissed:v1";

/** v2 key stores the Unix-ms timestamp of the last dismissal. */
const STORAGE_KEY = "kioar:install-prompt:v2";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isWithinCooldown(): boolean {
  try {
    // Migration: old users who dismissed with the v1 key are treated as
    // having dismissed "just now" until they clear storage or it naturally
    // expires when they install the PWA.
    if (window.localStorage.getItem(STORAGE_KEY_V1)) return true;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < ONE_WEEK_MS;
  } catch {
    return false;
  }
}

/**
 * Add-to-Home-Screen prompt.
 *
 * Two flows:
 *  - **Android / Chromium**: capture `beforeinstallprompt`, show a
 *    bottom sheet with a "نصب اپ" CTA that triggers the native prompt.
 *  - **iOS Safari**: no programmatic install API; show an instructional
 *    sheet pointing users at Share → افزودن به صفحه‌اصلی.
 *
 * Shown at most once per week; dismissal timestamp persisted in
 * localStorage. Hidden permanently when the page runs in standalone mode
 * (i.e. the PWA is already installed).
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [iosFlow, setIosFlow] = useState(false);
  // Ensures we schedule at most one show-timer per component lifetime,
  // even if beforeinstallprompt fires multiple times.
  const scheduledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed / running as PWA — never prompt.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS-specific
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (isStandalone) return;

    // Within the 7-day cooldown — skip.
    if (isWithinCooldown()) return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIos && isSafari) {
      if (scheduledRef.current) return;
      scheduledRef.current = true;
      // Delay so we don't fight the page's first paint or other modals.
      const t = window.setTimeout(() => {
        // Re-check at fire time in case the user dismissed from another tab.
        if (isWithinCooldown()) return;
        setIosFlow(true);
        setOpen(true);
      }, 8000);
      return () => {
        window.clearTimeout(t);
        scheduledRef.current = false;
      };
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      // Always update the captured event so we use the freshest reference.
      setBip(e as BIPEvent);
      // Only schedule one timer per session even if the browser re-fires.
      if (scheduledRef.current) return;
      scheduledRef.current = true;
      // Same delay — let the page settle before suggesting install.
      window.setTimeout(() => {
        // Re-check at fire time in case the user dismissed from another tab.
        if (isWithinCooldown()) return;
        setOpen(true);
      }, 4000);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      scheduledRef.current = false;
    };
  }, []);

  function persistDismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  async function handleInstall() {
    if (!bip) return;
    try {
      await bip.prompt();
      await bip.userChoice;
    } finally {
      persistDismiss();
      setBip(null);
      setOpen(false);
    }
  }

  function handleDismiss(o: boolean) {
    if (!o) persistDismiss();
    setOpen(o);
  }

  return (
    <Sheet open={open} onOpenChange={handleDismiss}>
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] border-t-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] px-5 pt-3"
      >
        {/* Drag handle */}
        <div
          aria-hidden
          className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-foreground/15"
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 ring-1 ring-primary/20">
            <span
              aria-hidden
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              K
            </span>
          </div>
          <SheetHeader className="items-center space-y-1.5 p-0">
            <SheetTitle className="text-lg font-bold">
              نصب وب‌اپلیکیشن
            </SheetTitle>
            <SheetDescription className="max-w-sm text-sm leading-6 text-muted-foreground">
              {iosFlow
                ? "برای نصب کیوآر روی آیفون: دکمه‌ی اشتراک‌گذاری مرورگر را بزنید و «افزودن به صفحه‌اصلی» را انتخاب کنید."
                : "دسترسی سریع‌تر به داشبورد، کار آفلاین و اعلان‌ها — درست مثل یک اپ بومی."}
            </SheetDescription>
          </SheetHeader>
        </div>
        <SheetFooter className="mt-6 flex flex-col gap-2 sm:flex-col">
          {iosFlow ? (
            <Button
              type="button"
              className="h-13 w-full text-base font-bold"
              onClick={() => handleDismiss(false)}
            >
              متوجه شدم
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="h-13 w-full text-base font-bold"
                onClick={handleInstall}
              >
                نصب وب‌اپلیکیشن
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full text-sm font-medium text-muted-foreground"
                onClick={() => handleDismiss(false)}
              >
                بعداً
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
