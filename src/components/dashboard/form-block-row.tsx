"use client";

import { FormInputIcon, SendIcon } from "lucide-react";

import { BlockCard } from "@/components/dashboard/block-card";
import { SpotlightStarButton } from "@/components/dashboard/spotlight-star-button";
import { toPersianDigits } from "@/lib/persian";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";

import type { FormBlockDraft } from "./form-builder-dialog";

export type EditableFormBlockWithId = FormBlockDraft & {
  id: string;
  isActive: boolean;
  sortOrder: number;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
  submissionsCount?: number;
};

export type FormBlockRowProps = {
  block: EditableFormBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  submissionsCount?: number;
  /** Drag handle props from `useSortable`. */
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  /** True while this row is the dragged item. */
  isDragging?: boolean;
  /** Phase 5: render in a read-only locked state when the page lacks the
   * `business_lead_capture_form` entitlement. */
  locked?: boolean;
  /** Phase 6 — Spotlight gating. */
  pinAllowed?: boolean;
  animateAllowed?: boolean;
  onSpotlightChange?: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
};

/**
 * Form block row, rendered inside the unified blocks list using the
 * shared {@link BlockCard} shell. Meta shows field count and total
 * submissions inline next to the title.
 */
export function FormBlockRow({
  block,
  onEdit,
  onDelete,
  onToggleActive,
  submissionsCount = 0,
  dragProps,
  isDragging,
  locked = false,
  pinAllowed = false,
  animateAllowed = false,
  onSpotlightChange,
}: FormBlockRowProps) {
  return (
    <BlockCard
      dragProps={dragProps}
      isDragging={isDragging}
      locked={locked}
      lockedPlan="business"
      icon={
        <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <FormInputIcon className="size-5" />
        </span>
      }
      title={block.name || "فرم"}
      meta={undefined}
      trailing={
        <span
          className="inline-flex items-center gap-1 rounded-xl bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground"
          title="تعداد ارسال"
        >
          <SendIcon className="size-3" />
          <span className="mt-0.5">{toPersianDigits(submissionsCount)}</span>
        </span>
      }
      spotlightSlot={
        onSpotlightChange ? (
          <SpotlightStarButton
            blockKind="form"
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
      deleteTitle="حذف فرم؟"
      deleteDescription="با حذف فرم، تمام ارسال‌های مربوطه نیز حذف می‌شود."
    />
  );
}
