"use client";

import { useState } from "react";
import { CalendarIcon, CalendarCheckIcon } from "lucide-react";

import { BlockCard } from "@/components/dashboard/block-card";
import { BookingFlowDialog } from "@/components/dashboard/booking-flow-dialog";
import { SpotlightStarButton } from "@/components/dashboard/spotlight-star-button";
import type {
  EditableBookingBlockWithId,
  ProviderConnection,
} from "@/components/dashboard/booking.types";
import type { RequiredPlanTier } from "@/lib/block-features";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";
import { toPersianDigits } from "@/lib/persian";

export type BookingBlockRowProps = {
  block: EditableBookingBlockWithId;
  providerConnections: ProviderConnection[];
  onUpdate: (next: EditableBookingBlockWithId) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onToggleActive: (isActive: boolean) => Promise<void> | void;
  /** Drag handle props from `useSortable` (attributes + listeners). */
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  /** True while this row is the dragged item. */
  isDragging?: boolean;
  /** Phase 5: render in a read-only locked state when the page lacks the
   * `business_bookings` entitlement. The owner still sees their config. */
  locked?: boolean;
  /** Lowest paid plan that currently grants the booking feature, sourced
   * from the live `plan_features` matrix. Drives lock chip colour. */
  lockedPlan?: RequiredPlanTier;
  /** Phase 6 — Spotlight gating. */
  pinAllowed?: boolean;
  animateAllowed?: boolean;
  onSpotlightChange?: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
};

/**
 * Booking block row, rendered inside the unified blocks list. Uses the
 * shared {@link BlockCard} shell so its sizing, drag handle and action
 * cluster match links and forms exactly. Inline meta shows the first
 * booking type's duration and price (further types are summarised as
 * "+N").
 */
export function BookingBlockRow({
  block,
  providerConnections,
  onUpdate,
  onDelete,
  onToggleActive,
  dragProps,
  isDragging,
  locked = false,
  lockedPlan = "business",
  pinAllowed = false,
  animateAllowed = false,
  onSpotlightChange,
}: BookingBlockRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <>
      <BlockCard
        dragProps={dragProps}
        isDragging={isDragging}
        locked={locked}
        lockedPlan={lockedPlan}
        icon={
          <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarIcon className="size-5" />
          </span>
        }
        title={block.name || "هماهنگ"}
        meta={undefined}
        trailing={
          <span
            className="inline-flex items-center gap-1 rounded-xl bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground"
            title="تعداد رزرو"
          >
            <CalendarCheckIcon className="size-3" />
            <span className="mt-0.5">
              {toPersianDigits(block.bookingsCount ?? 0)}
            </span>
          </span>
        }
        spotlightSlot={
          onSpotlightChange ? (
            <SpotlightStarButton
              blockKind="booking"
              spotlight={block.spotlight}
              animationStyle={block.animationStyle}
              pinAllowed={pinAllowed}
              animateAllowed={animateAllowed}
              onChange={onSpotlightChange}
            />
          ) : null
        }
        isActive={block.isActive}
        onToggleActive={(v) => onToggleActive(v)}
        onEdit={() => {
          if (locked) return;
          setEditOpen(true);
        }}
        onDelete={onDelete}
        deleteTitle="حذف هماهنگ؟"
        deleteDescription="این هماهنگ و تمام هماهنگی‌های مرتبط برای همیشه حذف می‌شوند."
      />

      <BookingFlowDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="ویرایش هماهنگ"
        initial={block}
        submitting={submitting}
        providerConnections={providerConnections}
        onSubmit={async (next) => {
          setSubmitting(true);
          try {
            await onUpdate({
              ...next,
              id: block.id,
              isActive: block.isActive,
              sortOrder: block.sortOrder,
              spotlight: block.spotlight,
              animationStyle: block.animationStyle,
            });
            setEditOpen(false);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}
