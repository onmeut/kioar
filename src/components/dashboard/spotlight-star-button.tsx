"use client";

import { useState } from "react";
import { StarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SpotlightModal,
  type BlockKind,
} from "@/components/dashboard/block-spotlight-modal";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";

export type SpotlightStarButtonProps = {
  blockKind: BlockKind;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
  pinAllowed: boolean;
  animateAllowed: boolean;
  disabled?: boolean;
  onChange: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
};

/**
 * Tiny star-icon button rendered in the action cluster of every block
 * card. Tapping it opens the {@link SpotlightModal}. Star fills when the
 * block is currently spotlighted (pin OR animate).
 */
export function SpotlightStarButton({
  blockKind,
  spotlight,
  animationStyle,
  pinAllowed,
  animateAllowed,
  disabled,
  onChange,
}: SpotlightStarButtonProps) {
  const [open, setOpen] = useState(false);
  const active = spotlight !== "none";

  return (
    <>
      <button
        type="button"
        aria-label="تمرکز"
        title="تمرکز"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground",
          active && "text-amber-500 hover:text-amber-500",
          disabled && "opacity-40",
        )}
      >
        <StarIcon
          className={cn("size-4", active && "fill-current")}
          aria-hidden
        />
      </button>
      <SpotlightModal
        open={open}
        onOpenChange={setOpen}
        blockKind={blockKind}
        initialSpotlight={spotlight}
        initialAnimationStyle={animationStyle}
        pinAllowed={pinAllowed}
        animateAllowed={animateAllowed}
        onSubmit={onChange}
      />
    </>
  );
}
