"use client";

import { CalendarDaysIcon, UsersIcon } from "lucide-react";

import { BlockCard } from "@/components/dashboard/block-card";
import type { RequiredPlanTier } from "@/lib/block-features";
import { toPersianDigits } from "@/lib/persian";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";

export type EditableEventBlockWithId = {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  status: "draft" | "published" | "cancelled";
  /** UTC ISO string — formatted in `timezone` at render. */
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  capacity: number | null;
  isActive: boolean;
  sortOrder: number;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
  registrantCount: number;
};

export type EventBlockRowProps = {
  block: EditableEventBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  locked?: boolean;
  lockedPlan?: RequiredPlanTier;
};

/**
 * Event block row in the unified blocks list. Mirrors {@link FormBlockRow}:
 * the on/off switch maps to `is_active` (public visibility ALSO needs
 * `status === "published"`, surfaced via the draft chip). Meta shows the
 * start date; trailing shows the registrant count.
 */
export function EventBlockRow({
  block,
  onEdit,
  onDelete,
  onToggleActive,
  dragProps,
  isDragging,
  locked = false,
  lockedPlan = "business",
}: EventBlockRowProps) {
  const isDraft = block.status === "draft";
  const isCancelled = block.status === "cancelled";

  return (
    <BlockCard
      dragProps={dragProps}
      isDragging={isDragging}
      locked={locked}
      lockedPlan={lockedPlan}
      icon={
        <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDaysIcon className="size-5" />
        </span>
      }
      title={block.title || "رویداد"}
      meta={
        isDraft ? (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
            پیش‌نویس
          </span>
        ) : isCancelled ? (
          <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
            لغو‌شده
          </span>
        ) : undefined
      }
      trailing={
        <span
          className="inline-flex items-center gap-1 rounded-xl bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground"
          title="تعداد ثبت‌نام"
        >
          <UsersIcon className="size-3" />
          <span className="mt-0.5">
            {toPersianDigits(block.registrantCount)}
          </span>
        </span>
      }
      isActive={block.isActive}
      onToggleActive={onToggleActive}
      onEdit={locked ? () => {} : onEdit}
      onDelete={onDelete}
      deleteTitle="حذف رویداد؟"
      deleteDescription="با حذف رویداد، تمام ثبت‌نام‌ها و اطلاعات مربوطه نیز حذف می‌شود."
    />
  );
}
