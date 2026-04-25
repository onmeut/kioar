"use client";

import { useState } from "react";
import {
  CalendarIcon,
  ClockIcon,
  DollarSignIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";

import { BookingFlowDialog } from "@/components/dashboard/booking-flow-dialog";
import type {
  EditableBookingBlockWithId,
  ProviderConnection,
} from "@/components/dashboard/booking.types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export type BookingBlockRowProps = {
  block: EditableBookingBlockWithId;
  providerConnections: ProviderConnection[];
  onUpdate: (next: EditableBookingBlockWithId) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onToggleActive: (isActive: boolean) => Promise<void> | void;
  /** Count of confirmed bookings to date (decorative). */
  bookingCount?: number;
};

export function BookingBlockRow({
  block,
  providerConnections,
  onUpdate,
  onDelete,
  onToggleActive,
  bookingCount = 0,
}: BookingBlockRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <li
      className={cn(
        "min-w-0 rounded-3xl border border-border bg-background/80 p-4",
        !block.isActive && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <CalendarIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{block.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>میتینگ</span>
            <span>·</span>
            <span>{toPersianDigits(block.types.length)} نوع</span>
            {bookingCount > 0 ? (
              <>
                <span>·</span>
                <span>{toPersianDigits(bookingCount)} رزرو</span>
              </>
            ) : null}
          </p>
        </div>
        <Switch
          checked={block.isActive}
          onCheckedChange={(v) => onToggleActive(!!v)}
          aria-label="فعال/غیرفعال"
        />
        <button
          type="button"
          aria-label="ویرایش"
          onClick={() => setEditOpen(true)}
          className="tap-target grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5"
        >
          <PencilIcon className="size-4" />
        </button>
        <ConfirmDialog
          title="حذف میتینگ؟"
          description="این میتینگ و تمام رزروهای مرتبط برای همیشه حذف می‌شوند."
          confirmLabel="حذف"
          destructive
          onConfirm={onDelete}
        >
          <button
            type="button"
            aria-label="حذف"
            className="tap-target grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2Icon className="size-4" />
          </button>
        </ConfirmDialog>
      </div>

      {block.types.length ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {block.types.map((t, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] px-3 py-1 text-[11px]"
            >
              <ClockIcon className="size-3" />
              <span className="font-bold">{t.title}</span>
              <span className="text-muted-foreground">
                · {toPersianDigits(t.durationMin)} د
              </span>
              <DollarSignIcon className="size-3 opacity-60" />
              <span className="text-muted-foreground" dir="ltr">
                {t.priceAmount === 0
                  ? "رایگان"
                  : `${t.priceAmount} ${t.priceCurrency}`}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <BookingFlowDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="ویرایش میتینگ"
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
            });
            setEditOpen(false);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </li>
  );
}
