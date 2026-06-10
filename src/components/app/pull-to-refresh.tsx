"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const TRIGGER_DISTANCE = 72; // px before refresh fires
const MAX_PULL = 120; // visual cap

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const [pull, setPull] = useState(0);

  // isPending from useTransition is the authoritative "refresh in flight"
  // signal — no fixed timeout needed. refreshingRef mirrors it so touch
  // handlers (which close over the ref, not state) can read it synchronously.
  const refreshingRef = useRef(false);
  useEffect(() => {
    refreshingRef.current = isPending;
    if (!isPending) {
      pullRef.current = 0;
      setPull(0);
    }
  }, [isPending]);

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
      if (refreshingRef.current) return;
      if (getScrollTop() > 0) return;
      startY.current = e.touches[0].clientY;
      pulling.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (refreshingRef.current || startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || getScrollTop() > 0) {
        pulling.current = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pulling.current = true;
      const damped = Math.min(MAX_PULL, delta * 0.5);
      pullRef.current = damped;
      setPull(damped);
    }

    function onTouchEnd() {
      if (!pulling.current) {
        pullRef.current = 0;
        setPull(0);
        startY.current = null;
        return;
      }
      if (pullRef.current >= TRIGGER_DISTANCE) {
        refreshingRef.current = true;
        pullRef.current = TRIGGER_DISTANCE;
        setPull(TRIGGER_DISTANCE);
        // startTransition wraps router.refresh() so isPending tracks the
        // actual completion — spinner stays until RSC data is back, and
        // the guard can't re-fire until isPending flips back to false.
        startTransition(() => router.refresh());
      } else {
        pullRef.current = 0;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshing = isPending;

  return (
    <div ref={wrapRef} className="contents">
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
