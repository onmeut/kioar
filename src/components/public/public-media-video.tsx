"use client";

import { useRef, useState } from "react";
import { Volume2Icon, VolumeXIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Instagram-style inline video for an uploaded media file: muted autoplay loop
 * (so it plays without user gesture on mobile), tap anywhere to toggle sound.
 * The video's own first frame is the de-facto poster; an optional uploaded
 * cover (`posterUrl`) overrides it.
 */
export function PublicMediaVideo({
  src,
  posterUrl,
  className,
}: {
  src: string;
  posterUrl?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound() {
    const el = ref.current;
    if (!el) return;
    const next = !muted;
    el.muted = next;
    // Unmuting may require a play() nudge on some mobile browsers.
    if (!next) void el.play().catch(() => {});
    setMuted(next);
  }

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={muted ? "صدا را روشن کن" : "صدا را خاموش کن"}
      className={cn(
        "relative block w-full overflow-hidden rounded-2xl bg-black",
        className,
      )}
    >
      <video
        ref={ref}
        src={src}
        poster={posterUrl ?? undefined}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
        className="h-auto max-h-[70dvh] w-full object-contain"
      />
      <span className="absolute bottom-2 end-2 inline-flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
        {muted ? (
          <VolumeXIcon className="size-4.5" />
        ) : (
          <Volume2Icon className="size-4.5" />
        )}
      </span>
    </button>
  );
}
