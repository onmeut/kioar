"use client";

import { useEffect, useState } from "react";

/**
 * Track which feature intro carousels (or any "show once" UI) have been
 * dismissed by this user/device. Backed by `localStorage` so it survives
 * reloads but stays per-browser. Use the same `key` for any feature you
 * want to gate — e.g. `bookings.intro`, `events.intro`.
 *
 * Returns:
 *  - `seen`: `null` while reading from storage (SSR / first paint),
 *    then a boolean.
 *  - `markSeen()`: persist the dismissal.
 *  - `reset()`: clear the flag (handy for a "show me again" affordance).
 */
export function useFeatureIntroSeen(key: string) {
  const storageKey = `kioar.intro:${key}`;
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setSeen(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // Private mode / quota — assume unseen so we still show the intro.
      setSeen(false);
    }
  }, [storageKey]);

  const markSeen = () => {
    setSeen(true);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore — UI state already updated, that's the important bit.
    }
  };

  const reset = () => {
    setSeen(false);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  return { seen, markSeen, reset };
}
