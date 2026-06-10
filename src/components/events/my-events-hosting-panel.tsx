"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { CalendarDaysIcon, CalendarPlusIcon, UsersIcon } from "lucide-react";

import { EventBuilderDialog } from "@/components/dashboard/event-builder-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { toPersianDigits } from "@/lib/date/persian";
import { EVENT_STATUS_LABELS } from "@/lib/events/labels";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import type { EventFormInitial } from "@/components/events/event-form";

export type HostEventListItem = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "cancelled";
  startsAtLabel: string;
  registrantCount: number;
  capacity: number | null;
};

type Props = {
  events: HostEventListItem[];
  pageId: string;
  eventFormInitials: Record<string, EventFormInitial>;
  saveAction: (
    state: ActionState & { id?: string; slug?: string },
    formData: FormData,
  ) => Promise<ActionState & { id?: string; slug?: string }>;
};

export function MyEventsHostingPanel({
  events,
  pageId,
  eventFormInitials,
  saveAction,
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const initial = editingEventId ? (eventFormInitials[editingEventId] ?? null) : null;

  function openNew() {
    setEditingEventId(null);
    setDialogOpen(true);
  }

  function openEdit(eventId: string) {
    setEditingEventId(eventId);
    setDialogOpen(true);
  }

  function handleSaved(_state: ActionState & { id?: string }) {
    setDialogOpen(false);
    setEditingEventId(null);
    router.refresh();
  }

  if (events.length === 0) {
    return (
      <>
        <div className="surface-card flex flex-col items-center justify-center gap-3 p-6 text-center sm:p-8">
          <div className="flex size-14 items-center justify-center rounded-4xl bg-primary/10 text-primary">
            <CalendarPlusIcon className="size-6" />
          </div>
          <h3 className="text-lg font-bold">هنوز رویدادی نساخته‌اید</h3>
          <p className="max-w-md text-sm leading-7 text-muted-foreground">
            اولین رویداد جامعه‌ات را بساز و ثبت‌نام‌ها را جمع کن.
          </p>
          <button
            type="button"
            onClick={openNew}
            className={cn(buttonVariants({ size: "lg", className: "rounded-full" }))}
          >
            ساخت رویداد
          </button>
        </div>
        <EventBuilderDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pageId={pageId}
          initial={null}
          saveAction={saveAction}
          onSaved={handleSaved}
        />
      </>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((ev) => (
          <HostingCard
            key={ev.id}
            ev={ev}
            onEdit={() => openEdit(ev.id)}
          />
        ))}
      </ul>

      <EventBuilderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pageId={pageId}
        initial={initial}
        saveAction={saveAction}
        onSaved={handleSaved}
      />
    </>
  );
}

function HostingCard({
  ev,
  onEdit,
}: {
  ev: HostEventListItem;
  onEdit: () => void;
}) {
  return (
    <li className="flex h-full flex-col overflow-hidden rounded-4xl border border-border bg-card">
      <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted">
        <CalendarDaysIcon className="size-8 text-muted-foreground/50" />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 line-clamp-2 font-bold leading-snug">
            {ev.title}
          </h3>
          <Badge
            className={cn(
              "shrink-0 rounded-full",
              ev.status === "published"
                ? "bg-emerald-500/12 text-emerald-700"
                : ev.status === "cancelled"
                  ? "bg-rose-500/12 text-rose-700"
                  : "bg-muted text-foreground",
            )}
          >
            {EVENT_STATUS_LABELS[ev.status]}
          </Badge>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDaysIcon className="size-3.5 shrink-0" />
          {ev.startsAtLabel}
        </p>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UsersIcon className="size-3.5 shrink-0" />
          {toPersianDigits(ev.registrantCount)} ثبت‌نام
          {ev.capacity ? ` از ${toPersianDigits(ev.capacity)} نفر` : " (نامحدود)"}
        </p>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link
            href={`/my-events/${ev.id}/manage` as Route}
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-9 flex-1 text-xs",
            )}
          >
            مدیریت
          </Link>
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9 flex-1 text-xs",
            )}
          >
            ویرایش
          </button>
        </div>
      </div>
    </li>
  );
}
