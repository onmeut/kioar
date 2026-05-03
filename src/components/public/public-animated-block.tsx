"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Thin client wrapper that plays a one-shot CSS animation on mount and then
 * re-plays it every `intervalSec` seconds while the page is visible.
 *
 * The animation class must be a `-once` variant (e.g. `anim-block-buzz-once`)
 * so the animation runs exactly one iteration and fires `animationend`.
 * This component listens to that event, removes the class, then schedules
 * the next play after `intervalSec` seconds.
 *
 * When `animClass` is null/undefined the component renders children directly
 * with no wrapper element added to the DOM.
 */
export function PublicAnimatedBlock({
  animClass,
  intervalSec = 10,
  children,
}: {
  animClass?: string | null;
  intervalSec?: number;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(!!animClass);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animClass) return;
    setActive(true);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [animClass]);

  if (!animClass) return <>{children}</>;

  const handleAnimationEnd = () => {
    setActive(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setActive(true), intervalSec * 1000);
  };

  return (
    <div
      className={active ? animClass : undefined}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
