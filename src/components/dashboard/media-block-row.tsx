"use client";

import { FileTextIcon, ImagesIcon, PlayCircleIcon } from "lucide-react";

import { BlockCard } from "@/components/dashboard/block-card";
import { SpotlightStarButton } from "@/components/dashboard/spotlight-star-button";
import type { RequiredPlanTier } from "@/lib/block-features";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";

import type { MediaBlockDraft } from "./media-builder-dialog";

export type EditableMediaBlockWithId = MediaBlockDraft & {
  id: string;
  isActive: boolean;
  sortOrder: number;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
};

export type MediaBlockRowProps = {
  block: EditableMediaBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  locked?: boolean;
  lockedPlan?: RequiredPlanTier;
  pinAllowed?: boolean;
  animateAllowed?: boolean;
  onSpotlightChange?: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
};

const MODE_META: Record<
  MediaBlockDraft["mode"],
  { icon: typeof ImagesIcon; fallbackTitle: string }
> = {
  photos: { icon: ImagesIcon, fallbackTitle: "گالری تصاویر" },
  video: { icon: PlayCircleIcon, fallbackTitle: "ویدئو" },
  file: { icon: FileTextIcon, fallbackTitle: "فایل" },
};

export function MediaBlockRow({
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
}: MediaBlockRowProps) {
  const meta = MODE_META[block.mode];
  const ModeIcon = meta.icon;
  // Prefer the file's display name, then the block name, then a mode fallback.
  const fileItem = block.items.find((it) => it.kind === "file");
  const title =
    fileItem?.displayName?.trim() ||
    block.name?.trim() ||
    (block.mode === "photos" && block.items.length > 1
      ? `گالری (${block.items.length} عکس)`
      : meta.fallbackTitle);

  return (
    <BlockCard
      dragProps={dragProps}
      isDragging={isDragging}
      locked={locked}
      lockedPlan={lockedPlan}
      icon={
        <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ModeIcon className="size-5" />
        </span>
      }
      title={title}
      meta={undefined}
      spotlightSlot={
        onSpotlightChange ? (
          <SpotlightStarButton
            blockKind="media"
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
      deleteTitle="حذف بلوک مدیا؟"
      deleteDescription="این بلوک مدیا و فایل‌های آن از صفحه شما حذف می‌شود."
    />
  );
}
