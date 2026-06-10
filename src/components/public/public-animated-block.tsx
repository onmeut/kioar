"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Plays a one-shot CSS animation on mount, then re-plays it every
 * `intervalSec` seconds while the page is visible.
 *
 * Blocks are staggered by `index` (0-based) so sibling animations don't
 * fire simultaneously, which would otherwise cause a burst of layer
 * promotions and GC pressure on pages with multiple animated blocks.
 * Each subsequent block is offset by 2 seconds from the previous one.
 *
 * The animation class must be a `-once` variant (e.g. `anim-block-buzz-once`)
 * so the animation runs exactly one iteration and fires `animationend`.
 * After `animationend` the class is removed, then re-added after `intervalSec`
 * seconds.
 *
 * When `animClass` is null/undefined the component renders children with no
 * extra wrapper element in the DOM.
 */
export function PublicAnimatedBlock({
  animClass,
  intervalSec = 10,
  index = 0,
  children,
}: {
  animClass?: string | null;
  intervalSec?: number;
  index?: number;
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

  // Stagger: each block index delays the first play by 2s so concurrent
  // animations don't burst at the same time.
  const staggerDelay = index * 2;

  return (
    <div
      className={active ? animClass : undefined}
      style={active && staggerDelay > 0 ? { animationDelay: `${staggerDelay}s` } : undefined}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
