"use client";

import { useEffect, useState } from "react";

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

const STORAGE_KEY = "kioar:install-prompt-dismissed:v1";

/**
 * Add-to-Home-Screen prompt.
 *
 * Two flows:
 *  - **Android / Chromium**: capture `beforeinstallprompt`, show a
 *    bottom sheet with a "نصب اپ" CTA that triggers the native prompt.
 *  - **iOS Safari**: no programmatic install API; show an instructional
 *    sheet pointing users at Share → افزودن به صفحه‌اصلی.
 *
 * Shown once per user; dismissal persisted in localStorage. Hidden when
 * the page is already running standalone.
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [iosFlow, setIosFlow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed / running as PWA — never prompt.
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS-specific
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (isStandalone) return;

    // Sticky dismissal.
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // storage may be blocked (private mode, etc.) — fall through and
      // just don't persist; we still gate by event/UA.
    }

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

    if (isIos && isSafari) {
      // Delay so we don't fight the page's first paint or other modals.
      const t = window.setTimeout(() => {
        setIosFlow(true);
        setOpen(true);
      }, 8000);
      return () => window.clearTimeout(t);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
      // Same delay — let the page settle before suggesting install.
      window.setTimeout(() => setOpen(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function persistDismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
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
