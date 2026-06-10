"use client";

import { TypeIcon } from "lucide-react";

import { BlockCard } from "@/components/dashboard/block-card";
import { SpotlightStarButton } from "@/components/dashboard/spotlight-star-button";
import { LinkIconBubble } from "@/components/dashboard/link-icon-picker";
import type { RequiredPlanTier } from "@/lib/block-features";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";

import type { TextBlockDraft } from "./text-block-dialog";

export type EditableTextBlockWithId = TextBlockDraft & {
  id: string;
  isActive: boolean;
  sortOrder: number;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
};

export type TextBlockRowProps = {
  block: EditableTextBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  /** Read-only locked state when the page lacks `link_text_block`. */
  locked?: boolean;
  /** Lowest paid plan that grants `link_text_block` (drives lock chip). */
  lockedPlan?: RequiredPlanTier;
  pinAllowed?: boolean;
  animateAllowed?: boolean;
  onSpotlightChange?: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
};

export function TextBlockRow({
  block,
  onEdit,
  onDelete,
  onToggleActive,
  dragProps,
  isDragging,
  locked = false,
  lockedPlan = "pro",
  pinAllowed = false,
  animateAllowed = false,
  onSpotlightChange,
}: TextBlockRowProps) {
  // The card title prefers the block's own title; falls back to a body
  // snippet so an untitled text block is still identifiable in the list.
  const title =
    block.title?.trim() ||
    (block.body.trim().slice(0, 40) || "متن") +
      (block.body.trim().length > 40 ? "…" : "");
  return (
    <BlockCard
      dragProps={dragProps}
      isDragging={isDragging}
      locked={locked}
      lockedPlan={lockedPlan}
      icon={
        block.iconKey || block.iconUrl ? (
          <LinkIconBubble
            iconKey={block.iconKey}
            iconUrl={block.iconUrl}
            imageUrl={null}
            url=""
            size={40}
            className="rounded-2xl"
          />
        ) : (
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <TypeIcon className="size-5" />
          </span>
        )
      }
      title={title}
      meta={undefined}
      spotlightSlot={
        onSpotlightChange ? (
          <SpotlightStarButton
            blockKind="text"
            spotlight={block.spotlight}
            animationStyle={block.animationStyle}
            pinAllowed={pinAllowed}
            animateAllowed={animateAllowed}
            onChange={onSpotlightChange}
          />
        ) : null
      }
      isActive={block.isActive}
      onToggleActive={onToggleActive}
      onEdit={locked ? () => {} : onEdit}
      onDelete={onDelete}
      deleteTitle="حذف بلوک متن؟"
      deleteDescription="این بلوک متن از صفحه شما حذف می‌شود."
    />
  );
}
