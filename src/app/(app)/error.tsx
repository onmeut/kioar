"use client";

/**
 * Error boundary for the entire authenticated (app) route group.
 *
 * The most common cause of a crash here is a **stale Server Action ID**:
 * after a new deployment, browsers that still have old cached JavaScript
 * try to call server action IDs that no longer exist on the server.
 * React's action runner throws an unhandled error → this boundary catches it.
 *
 * Recovery strategy: reload the page once to pick up fresh JavaScript.
 * `sessionStorage` prevents an infinite reload loop if the error persists
 * after a fresh load (meaning it is a genuine application bug, not a stale-JS
 * deployment mismatch).
 */
import { useEffect } from "react";

const RELOAD_FLAG = "kioar_recovery_reload";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadyRetried = sessionStorage.getItem(RELOAD_FLAG);
    if (!alreadyRetried) {
      // First time hitting this boundary — reload to get fresh JS bundles.
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    } else {
      // Second hit after reload: a genuine bug. Clear the flag so the user
      // can manually retry later, then show the reset UI below.
      sessionStorage.removeItem(RELOAD_FLAG);
    }
  }, [error]);

  return (
    <div
      dir="rtl"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p className="text-sm text-muted-foreground">مشکلی پیش آمد.</p>
      <button
        onClick={reset}
        className="text-xs underline text-muted-foreground"
      >
        تلاش مجدد
      </button>
    </div>
  );
}
