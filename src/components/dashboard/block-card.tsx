"use client";

import { useState, type ReactNode } from "react";
import { GripVerticalIcon, LockIcon, MoreHorizontalIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { RequiredPlanTier } from "@/lib/block-features";
import { UpgradePlanModal } from "@/components/dashboard/upgrade-plan-modal";

/**
 * Visual shell shared by every block on the dashboard "links" page —
 * profile links, booking blocks and form blocks all render through this
 * to guarantee identical sizing, drag handle position, control order
 * and spacing.
 *
 * Layout (RTL):
 *   [drag] [icon] [title + meta row]      [active] [edit] [delete]
 *
 * Each card is a single visual row regardless of block kind. Secondary
 * meta sits inline next to the title (no second line) so price/duration
 * etc. don't push the layout to two lines.
 */
export type BlockCardProps = {
  /** Drag handle props from `useSortable` (attributes + listeners). */
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  /** True while this card is the dragged item — adds elevation. */
  isDragging?: boolean;
  /** Slot for the leading icon / cover — caller supplies the bubble. */
  icon: ReactNode;
  /** Title shown bold at the start of the row. Truncates. */
  title: string;
  /** Inline meta chips/badges shown next to the title. Optional. */
  meta?: ReactNode;
  /** Whether the block is published. */
  isActive: boolean;
  onToggleActive: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  /** Confirm-dialog copy. */
  deleteTitle: string;
  deleteDescription: string;
  /** Optional small badge slot rendered before the action cluster. */
  trailing?: ReactNode;
  /** Optional spotlight (star) trigger rendered just before the active toggle. */
  spotlightSlot?: ReactNode;
  /** Optional content rendered below the header row (e.g. inline edit form). */
  children?: ReactNode;
  /**
   * Phase 5 graceful degradation. When true, the block is shown read-only:
   * the active toggle is disabled, "edit" stops opening editors, and a
   * compact lock chip (Pro = emerald, Business = purple) replaces the
   * trailing slot. Hovering the chip explains which plan unlocks the
   * block; clicking it routes to `/pro`. Delete remains available so
   * the owner can prune blocks they no longer want. The caller's
   * existing config is still rendered (children + meta) so the owner
   * can see exactly what they'd recover by upgrading.
   */
  locked?: boolean;
  /**
   * Plan tier required to unlock the block. Drives the lock chip color
   * and tooltip copy. Required when `locked` is true; ignored otherwise.
   */
  lockedPlan?: RequiredPlanTier;
};

export function BlockCard({
  dragProps,
  isDragging,
  icon,
  title,
  meta,
  isActive,
  onToggleActive,
  onEdit,
  onDelete,
  deleteTitle,
  deleteDescription,
  trailing,
  spotlightSlot,
  children,
  locked = false,
  lockedPlan,
}: BlockCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div
      className={cn(
        "min-w-0 rounded-3xl border border-border bg-background/80",
        "transition-shadow",
        isDragging && "shadow-lg ring-1 ring-foreground/10",
        !isActive && !locked && "opacity-60",
        locked && "border-dashed bg-muted/40",
      )}
    >
      {/*
       * Asymmetric inline padding: the kebab side (end in RTL = visual left)
       * is tighter than the grip side because the kebab button already
       * carries its own 32px hit-target. Equal padding made the action
       * cluster look pushed off the card edge.
       */}
      <div className="flex min-w-0 items-center gap-2.5 ps-3 pe-2 py-3 sm:gap-3 sm:ps-5 sm:pe-3 sm:py-4">
        <button
          type="button"
          aria-label="جابه‌جایی"
          className="shrink-0 cursor-grab touch-none rounded-2xl text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...dragProps}
        >
          <GripVerticalIcon className="size-4" />
        </button>

        <div className="shrink-0">{icon}</div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={locked ? undefined : onEdit}
              disabled={locked}
              className={cn(
                "truncate text-sm font-bold text-start",
                locked
                  ? "cursor-default text-muted-foreground"
                  : "hover:underline",
              )}
            >
              {title || "بدون عنوان"}
            </button>
            {meta ? (
              <span className="flex min-w-0 shrink items-center gap-1.5 text-[11px] text-muted-foreground">
                {meta}
              </span>
            ) : null}
          </div>
        </div>

        {/*
         * Unified action cluster — identical structure for every block kind
         * and every state (active / inactive / locked). One gutter (gap-1)
         * between siblings, no per-child margins. Slots, in order:
         *   1. Secondary stat (click/submission count) — desktop only.
         *      Hidden on mobile to give the title back ~70px.
         *   2. Spotlight star — only when the block is unlocked.
         *   3. Primary state — `Switch` when unlocked, `LockedPlanChip`
         *      with the SAME 24×44 footprint when locked. The chip
         *      replaces the switch instead of stacking next to a disabled
         *      one, so locked rows visually parallel active rows.
         *   4. Kebab menu.
         */}
        <div className="flex shrink-0 items-center gap-1">
          {!locked && trailing ? (
            <span className="hidden sm:inline-flex">{trailing}</span>
          ) : null}
          {!locked ? spotlightSlot : null}
          {locked ? (
            <LockedPlanChip plan={lockedPlan ?? "pro"} />
          ) : (
            <Switch
              checked={isActive}
              onCheckedChange={(v) => onToggleActive(!!v)}
              aria-label={isActive ? "غیرفعال کردن" : "فعال کردن"}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="گزینه‌ها"
              className="inline-flex size-8 items-center justify-center rounded-2xl text-muted-foreground hover:bg-foreground/5"
            >
              <MoreHorizontalIcon className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} disabled={locked}>
                ویرایش
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-red-600 focus:text-red-600"
              >
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {children}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            {deleteDescription ? (
              <AlertDialogDescription>
                {deleteDescription}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void onDelete()}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const LOCKED_CHIP_CLASSES: Record<RequiredPlanTier, string> = {
  pro: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 hover:text-emerald-800",
  business:
    "bg-purple-50 text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100 hover:text-purple-800",
};

const LOCKED_ARIA_LABELS: Record<RequiredPlanTier, string> = {
  pro: "ارتقا به پلن حرفه‌ای",
  business: "ارتقا به پلن کسب‌وکار",
};

/**
 * Compact lock affordance shown in place of the `Switch` when a block is
 * gated. Sized to match the switch exactly (24×44) so locked rows have the
 * same visual rhythm as active rows — no jumping action cluster as you
 * scroll past mixed states. Clicking opens the upgrade modal.
 */
function LockedPlanChip({ plan }: { plan: RequiredPlanTier }) {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={LOCKED_ARIA_LABELS[plan]}
        onClick={() => setModalOpen(true)}
        className={cn(
          "inline-flex h-6 w-11 items-center justify-center rounded-full transition-colors",
          LOCKED_CHIP_CLASSES[plan],
        )}
      >
        <LockIcon className="size-3.5" aria-hidden />
      </button>
      <UpgradePlanModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        plan={plan}
      />
    </>
  );
}
