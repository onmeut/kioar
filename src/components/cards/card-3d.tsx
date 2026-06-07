"use client";

import Image from "next/image";
import { Wifi } from "lucide-react";
import { useCallback, useRef } from "react";

import { cn } from "@/lib/utils";

import { QrRenderer } from "@/components/dashboard/share/qr-renderer";

type Material = "colorful" | "metal";

export function Card3D({
  material,
  color,
  name,
  slug,
  flipped,
  onFlipChange,
}: {
  material: Material;
  color: string;
  name: string;
  slug: string;
  flipped: boolean;
  onFlipChange: (f: boolean) => void;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const accumulated = useRef({ rx: 0, ry: 0 });
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  const cardBgColor = material === "metal" ? "#000" : cardBg(color);
  const previewUrl = slug ? `kioar.com/${slug}` : "kioar.com";

  function triggerSpring() {
    const el = innerRef.current;
    if (!el) return;
    el.classList.add("is-animating");
    if (animTimer.current) clearTimeout(animTimer.current);
    animTimer.current = setTimeout(() => el.classList.remove("is-animating"), 700);
  }

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragMoved.current = false;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // No tilt at all when viewing the back — any ry rotation reveals the front face
    if (flippedRef.current) return;

    if (!isDragging.current) {
      const el = innerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      el.style.setProperty("--ry", `${(px - 0.5) * 40}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 40}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
      return;
    }

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };

    accumulated.current.ry += dx * 0.5;
    accumulated.current.rx -= dy * 0.5;

    const el = innerRef.current;
    if (!el) return;
    el.style.setProperty("--ry", `${accumulated.current.ry}deg`);
    el.style.setProperty("--rx", `${accumulated.current.rx}deg`);
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (isDragging.current) return;
    const el = innerRef.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  }, []);

  const handlePointerUp = useCallback(() => {
    const wasDrag = isDragging.current;
    isDragging.current = false;
    if (!wasDrag) return;

    // Snap back
    accumulated.current = { rx: 0, ry: 0 };
    triggerSpring();
    const el = innerRef.current;
    if (el) {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    }
  }, []);

  const handleClick = useCallback(() => {
    // Only flip on a tap (no significant drag movement).
    if (dragMoved.current) return;
    // Reset tilt so no leftover rotation peeks the opposite face through
    const el = innerRef.current;
    if (el) {
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--rx", "0deg");
    }
    accumulated.current = { rx: 0, ry: 0 };
    triggerSpring();
    onFlipChange(!flipped);
  }, [flipped, onFlipChange]);

  return (
    <div
      className="card3d-stage w-full [aspect-ratio:1.586/1] select-none cursor-grab active:cursor-grabbing"
      data-flipped={flipped ? "" : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="چرخاندن کارت"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlipChange(!flipped);
        }
      }}
      dir="ltr"
    >
      <div
        ref={innerRef}
        className={`card3d-inner ${flipped ? "is-flipped" : ""}`}
      >
        {/* FRONT */}
        <div
          className="card3d-face rounded-[1.25rem] ring-1 ring-black/60"
          style={{ backgroundColor: cardBgColor, boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 8px 40px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.6)" }}
        >
            {/* Metal: top-edge highlight only — a 1px white line simulating light catching the card edge */}
          {material === "metal" ? (
            <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-1 ring-inset ring-white/[0.12]" />
          ) : null}
          <div className="card3d-sheen rounded-[1.25rem]" />
          <div className="relative flex h-full items-center justify-center">
            <Image
              src="/brand/logo.svg"
              alt="kioar"
              width={80}
              height={91}
              className={cn("w-[80px] h-auto", material === "metal" ? "invert opacity-80" : "opacity-90 mix-blend-multiply")}
              priority
            />
          </div>
        </div>

        {/* BACK */}
        <div
          className="card3d-face card3d-face-back rounded-[1.25rem] ring-1 ring-black/60"
          style={{ backgroundColor: cardBgColor, boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 8px 40px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.6)" }}
        >
          {material === "metal" ? (
            <div className="pointer-events-none absolute inset-0 rounded-[1.25rem] ring-1 ring-inset ring-white/[0.12]" />
          ) : null}
          <div className="card3d-sheen rounded-[1.25rem]" />
          <div className="relative flex h-full w-full items-center justify-center p-4">
            {/* QR */}
            <div className="size-[11rem] rounded-2xl bg-white p-2 shadow-lg">
              <QrRenderer text={`https://${previewUrl}`} />
            </div>

            {/* NFC icon */}
            <div
              className="absolute end-6 top-1/2 -translate-y-1/2 opacity-75"
              style={{ color: material === "metal" || color !== "lime" ? "#fff" : "#111" }}
            >
              <Wifi className="size-8 rotate-90" />
            </div>

            {/* Name */}
            {name ? (
              <p
                className="absolute bottom-4 end-6 text-[15px] font-bold tracking-widest uppercase"
                style={{ color: "#000" }}
              >
                {name}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function cardBg(color: string): string {
  const map: Record<string, string> = {
    orange: "#FE774A",
    lime: "#F0FE00",
    cyan: "#03BFFF",
    pink: "#FE4CBB",
    // metal
    black: "#141414",
    silver: "#cfd3d6",
    gold: "#c9a23b",
  };
  return map[color] ?? color;
}

