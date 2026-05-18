"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { toast } from "sonner";

import {
  CommandPalette,
  type CommandPaletteFeatureFlags,
  type CommandPalettePage,
  useCommandPaletteShortcut,
} from "@/components/navigation/command-palette";
import { cn } from "@/lib/utils";

const HINT_STORAGE_KEY = "kioar_cmdk_hint_dismissed_v1";
const HINT_DELAY_MS = 2500;

export interface CommandPaletteTriggerProps {
  pages: CommandPalettePage[];
  currentPageId: string;
  publicUrl: string;
  features: CommandPaletteFeatureFlags;
}

/**
 * Search-bar-shaped pill that opens the global command palette. Lives
 * inside the dashboard top bar and is the canonical "discoverable
 * affordance" so users learn the ⌘K shortcut exists.
 *
 * Owns the open-state for the palette (single source of truth) and
 * registers the global ⌘K listener so any client component on a
 * dashboard page can toggle it without prop-drilling. A first-run
 * toast nudges the user once, then sets a localStorage flag.
 */
export function CommandPaletteTrigger({
  pages,
  currentPageId,
  publicUrl,
  features,
}: CommandPaletteTriggerProps) {
  const [open, setOpen] = useState(false);
  // null on the server / first render to avoid hydration mismatch on the
  // platform-specific keycap label. Resolved client-side in `useEffect`.
  const [isMac, setIsMac] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const platform =
      // `userAgentData` is the modern API; `platform` is a stable fallback.
      (
        navigator as Navigator & {
          userAgentData?: { platform?: string };
        }
      ).userAgentData?.platform ??
      navigator.platform ??
      "";
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(platform));
  }, []);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  useCommandPaletteShortcut(toggle);

  // First-run hint. We schedule the toast a few seconds after mount so
  // it doesn't compete with route-load chrome. Dismissal is sticky in
  // localStorage; we use a versioned key so we can re-introduce the
  // hint after a major redesign without colliding with old state.
  // Skipped on touch-only devices (no keyboard, no shortcut).
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Hide on coarse-pointer / touch / narrow screens — they have no
    // physical keyboard or visible ⌘K trigger button. The pill is
    // already `hidden md:flex`, so on <768px there's nothing to teach.
    const isTouchOnly =
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ??
      false;
    const isNarrow = window.matchMedia?.("(max-width: 767px)").matches ?? false;
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    if (isTouchOnly || isNarrow || isStandalone) return;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(HINT_STORAGE_KEY) === "1";
    } catch {
      // Private mode / storage disabled — treat as already dismissed so
      // we don't pester the user every page load.
      dismissed = true;
    }
    if (dismissed) return;

    const timeout = window.setTimeout(() => {
      toast("نکته: با ⌘K همه‌جا دسترسی سریع داری", {
        description:
          "میان‌بر صفحه‌کلید جدید کیوآر: جستجو، رفتن به، و اقدامات سریع.",
        duration: 8000,
        action: {
          label: "متوجه شدم",
          onClick: () => {
            try {
              window.localStorage.setItem(HINT_STORAGE_KEY, "1");
            } catch {
              /* noop */
            }
          },
        },
      });
      try {
        window.localStorage.setItem(HINT_STORAGE_KEY, "1");
      } catch {
        /* noop */
      }
    }, HINT_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  const keycapLabel = isMac === null ? "⌘K" : isMac ? "⌘K" : "Ctrl K";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="باز کردن جستجوی سراسری (⌘K)"
        className={cn(
          "group inline-flex h-9 w-full max-w-[280px] items-center gap-2 rounded-full",
          "border border-input bg-muted/10 ps-3 pe-1.5 text-sm",
          "text-muted-foreground transition-colors",
          "hover:bg-muted/70 hover:text-foreground hover:border-ring/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          "cursor-pointer",
        )}
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-start">
          جستجو در کیوآر...
        </span>
        <kbd
          dir="ltr"
          aria-hidden
          className={cn(
            "ms-auto inline-flex h-6 shrink-0 items-center justify-center gap-0.5",
            "rounded-full border border-border/80 bg-background px-2",
            // Explicit system UI stack — bypasses the IranYekan --font-sans
            // variable so the Latin keycap label renders in the OS font.
            "[font-family:system-ui,-apple-system,sans-serif]",
            "text-[10.5px] font-semibold text-muted-foreground",
            "shadow-[0_1px_0_oklch(0_0_0/0.04)]",
          )}
        >
          {keycapLabel}
        </kbd>
      </button>

      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        pages={pages}
        currentPageId={currentPageId}
        publicUrl={publicUrl}
        features={features}
      />
    </>
  );
}
