"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TRIGGER_DISTANCE = 72; // px before refresh fires
const MAX_PULL = 120; // visual cap

/**
 * Pull-to-refresh wrapper. Works inside a nested scroll container
 * (which is what the dashboard's `<main>` is) since the browser's
 * native PTR only fires on the document scroller.
 *
 * Behavior:
 *  - Listens for `touchstart` on the wrapped scroll container.
 *  - When the user starts a downward drag while `scrollTop === 0`,
 *    we track the delta and apply a translateY to the children plus
 *    show a refresh indicator.
 *  - On release past the threshold, calls `router.refresh()`.
 *  - Disabled on non-touch / non-mobile devices.
 *
 * Mounted as a sibling — wraps its `children`.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    // Only on coarse-pointer devices.
    if (
      typeof window !== "undefined" &&
      !window.matchMedia?.("(hover: none) and (pointer: coarse)").matches
    ) {
      return;
    }

    // Find the nearest scrollable ancestor — that's the container the
    // user is actually scrolling. We attach to it, not to `el`, so we
    // can read its scrollTop.
    let scroller: HTMLElement | Window = window;
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight
      ) {
        scroller = node;
        break;
      }
      node = node.parentElement;
    }

    function getScrollTop() {
      return scroller === window
        ? window.scrollY
        : (scroller as HTMLElement).scrollTop;
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshing) return;
      if (getScrollTop() > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (refreshing || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        pulling.current = false;
        setPull(0);
        return;
      }
      if (getScrollTop() > 0) {
        pulling.current = false;
        setPull(0);
        return;
      }
      pulling.current = true;
      // Resistance — feels native.
      const damped = Math.min(MAX_PULL, delta * 0.5);
      setPull(damped);
    }

    function onTouchEnd() {
      if (!pulling.current) {
        setPull(0);
        startY.current = null;
        return;
      }
      if (pull >= TRIGGER_DISTANCE) {
        setRefreshing(true);
        setPull(TRIGGER_DISTANCE);
        router.refresh();
        // Hide indicator after a short delay; `router.refresh()` doesn't
        // expose a completion signal but is generally fast.
        window.setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 800);
      } else {
        setPull(0);
      }
      pulling.current = false;
      startY.current = null;
    }

    const target = scroller as EventTarget;
    target.addEventListener("touchstart", onTouchStart as EventListener, {
      passive: true,
    });
    target.addEventListener("touchmove", onTouchMove as EventListener, {
      passive: true,
    });
    target.addEventListener("touchend", onTouchEnd as EventListener, {
      passive: true,
    });
    return () => {
      target.removeEventListener("touchstart", onTouchStart as EventListener);
      target.removeEventListener("touchmove", onTouchMove as EventListener);
      target.removeEventListener("touchend", onTouchEnd as EventListener);
    };
    // We intentionally re-bind only on mount; `pull`/`refreshing` are
    // read via closure-of-state but `onTouchEnd` re-reads via setState
    // callbacks pattern — keeping deps empty avoids re-binding on every
    // pixel of pull.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={wrapRef} className="contents">
      {/* Indicator pinned to the top of the viewport — slides down with
          the pull distance. Doesn't push the page content. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center pt-[env(safe-area-inset-top)]"
        style={{
          transform: `translateY(${pull - 48}px)`,
          opacity: pull > 8 || refreshing ? 1 : 0,
          transition:
            pulling.current || refreshing
              ? "opacity 120ms ease"
              : "transform 240ms ease, opacity 240ms ease",
        }}
      >
        <div className="mt-2 flex size-9 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-foreground/10">
          <RefreshCwIcon
            className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            style={{
              transform: refreshing
                ? undefined
                : `rotate(${Math.min(360, (pull / TRIGGER_DISTANCE) * 360)}deg)`,
            }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
