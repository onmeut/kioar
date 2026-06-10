"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { motion, useAnimate } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * "ساخته‌شده با کی‌یو‌آر" badge.
 *
 * Buzz animation fires once when the badge enters the viewport (first impression),
 * then repeats every 45 s so it stays visible without feeling spammy.
 *
 * `variant="dark"` flips the chip to a near-black background with the
 * white logo + white text. Used by the public profile page when the
 * user picks a dark theme, where the default chip (sidebar bg +
 * sidebar-foreground text) was rendering near-invisible.
 */
export function KioarBadge({
  variant = "default",
}: {
  variant?: "default" | "dark";
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [scope, animate] = useAnimate();
  const [hasBuzzed, setHasBuzzed] = useState(false);

  const buzz = () => {
    animate(
      scope.current,
      {
        rotate: [0, -8, 8, -6, 6, -3, 3, 0],
        scale: [1, 1.08, 1.08, 1.08, 1.08, 1.04, 1.04, 1],
      },
      { duration: 0.55, ease: "easeInOut" },
    );
  };

  // Fire once on first visibility
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasBuzzed) {
          // Small delay so the page has settled before drawing attention
          const t = setTimeout(() => {
            buzz();
            setHasBuzzed(true);
          }, 800);
          return () => clearTimeout(t);
        }
      },
      { threshold: 0.6 },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBuzzed]);

  // Repeat every 10 s after first buzz
  useEffect(() => {
    if (!hasBuzzed) return;
    const id = setInterval(buzz, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBuzzed]);

  const isDark = variant === "dark";
  const logoSrc = isDark ? "/brand/logo-white.svg" : "/brand/logo.svg";

  return (
    <motion.div ref={scope} style={{ display: "inline-block" }}>
      <Link
        ref={ref}
        href="https://kioar.com?ref=profile"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-70",
          isDark
            ? "border-white/10 bg-[#111111] text-white"
            : "border-border bg-background text-foreground",
        )}
      >
        <Image
          src={logoSrc}
          alt=""
          width={13}
          height={15}
          className="h-[15px] w-auto"
        />
        <span>ساخته شده با کیوآر</span>
        <ArrowLeftIcon className="size-4 shrink-0" aria-hidden />
      </Link>
    </motion.div>
  );
}
