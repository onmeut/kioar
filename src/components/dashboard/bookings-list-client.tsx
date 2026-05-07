"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarXIcon,
  CopyIcon,
  InboxIcon,
  MapPinIcon,
  SendIcon,
  UserIcon,
  VideoIcon,
} from "lucide-react";
import { toast } from "sonner";

import { cancelBookingAction } from "@/app/(app)/bookings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { idleState } from "@/lib/action-state";
import {
  formatPersianDate,
  formatPersianTime,
  toPersianDigits,
} from "@/lib/persian";
import { cn } from "@/lib/utils";

export type BookingListItem = {
  id: string;
  status: "confirmed" | "cancelled";
  guestName: string;
  guestEmail: string;
  guestTimezone: string | null;
  startsAtIso: string;
  endsAtIso: string;
  createdAtIso: string;
  block: {
    id: string;
    profileId: string;
    name: string;
    timezone: string;
    locationType: "online" | "in_person";
    locationAddress: string | null;
    meetingLink: string | null;
  };
  type: {
    id: string;
    title: string;
    durationMin: number;
    priceAmount: number | null;
    priceCurrency: string | null;
  } | null;
};

type BookingsListClientProps = {
  viewerEmail: string | null;
  incoming: BookingListItem[];
  outgoing: BookingListItem[];
};

type View = "incoming" | "outgoing";
type Bucket = "upcoming" | "past";

function splitBookings(items: BookingListItem[]) {
  const now = Date.now();
  const upcoming: BookingListItem[] = [];
  const past: BookingListItem[] = [];
  for (const b of items) {
    const t = new Date(b.startsAtIso).getTime();
    if (b.status === "confirmed" && t >= now) upcoming.push(b);
    else past.push(b);
  }
  // Upcoming ascending (soonest first), past descending (most recent first).
  upcoming.sort(
    (a, b) =>
      new Date(a.startsAtIso).getTime() - new Date(b.startsAtIso).getTime(),
  );
  past.sort(
    (a, b) =>
      new Date(b.startsAtIso).getTime() - new Date(a.startsAtIso).getTime(),
  );
  return { upcoming, past };
}

export function BookingsListClient({
  incoming,
  outgoing,
}: BookingsListClientProps) {
  const [selected, setSelected] = useState<{
    item: BookingListItem;
    view: View;
  } | null>(null);

  const incomingSplit = useMemo(() => splitBookings(incoming), [incoming]);
  const outgoingSplit = useMemo(() => splitBookings(outgoing), [outgoing]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6">
      <header className="space-y-1">
        {/* Mobile shows the title via the dashboard header (DashboardPageTitle).
            Hide the duplicate H1 on mobile to avoid stacked headers, but keep
            the description visible. */}
        <h1 className="hidden text-2xl font-semibold md:block">هماهنگی‌ها</h1>
        <p className="text-sm text-muted-foreground">
          مدیریت جلسات و هماهنگی‌هایی که دریافت کرده‌اید یا در صفحات دیگران
          گذاشته‌اید.
        </p>
      </header>

      <Tabs defaultValue="incoming" className="space-y-5">
        <TabsList className="w-full">
          <TabsTrigger value="incoming" className="gap-2">
            <InboxIcon className="size-4" />
            دریافتی
            {incomingSplit.upcoming.length > 0 ? (
              <span className="rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums">
                {toPersianDigits(incomingSplit.upcoming.length)}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="gap-2">
            <SendIcon className="size-4" />
            هماهنگی‌های من
            {outgoingSplit.upcoming.length > 0 ? (
              <span className="rounded-full bg-foreground/10 px-1.5 text-xs tabular-nums">
                {toPersianDigits(outgoingSplit.upcoming.length)}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incoming" className="space-y-6">
          <BookingBucket
            title="پیش رو"
            items={incomingSplit.upcoming}
            bucket="upcoming"
            onSelect={(item) => setSelected({ item, view: "incoming" })}
            emptyText="هنوز رزرو پیش‌رویی ندارید."
            view="incoming"
          />
          <BookingBucket
            title="گذشته"
            items={incomingSplit.past}
            bucket="past"
            onSelect={(item) => setSelected({ item, view: "incoming" })}
            emptyText="سابقه‌ای وجود ندارد."
            view="incoming"
          />
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-6">
          <BookingBucket
            title="پیش رو"
            items={outgoingSplit.upcoming}
            bucket="upcoming"
            onSelect={(item) => setSelected({ item, view: "outgoing" })}
            emptyText="شما جلسه‌ی پیش‌رویی با دیگران ندارید."
            view="outgoing"
          />
          <BookingBucket
            title="گذشته"
            items={outgoingSplit.past}
            bucket="past"
            onSelect={(item) => setSelected({ item, view: "outgoing" })}
            emptyText="سابقه‌ای وجود ندارد."
            view="outgoing"
          />
        </TabsContent>
      </Tabs>

      <BookingDetailSheet
        selection={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function BookingBucket({
  title,
  items,
  bucket,
  view,
  onSelect,
  emptyText,
}: {
  title: string;
  items: BookingListItem[];
  bucket: Bucket;
  view: View;
  onSelect: (item: BookingListItem) => void;
  emptyText: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {toPersianDigits(items.length)}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          <CalendarDaysIcon className="size-5 shrink-0" />
          <span>{emptyText}</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <BookingCard
                item={item}
                bucket={bucket}
                view={view}
                onClick={() => onSelect(item)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingCard({
  item,
  bucket,
  view,
  onClick,
}: {
  item: BookingListItem;
  bucket: Bucket;
  view: View;
  onClick: () => void;
}) {
  const start = new Date(item.startsAtIso);
  const dateStr = formatPersianDate(start);
  const timeStr = formatPersianTime(start);
  const dimmed = item.status === "cancelled" || bucket === "past";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-start shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring",
        dimmed && "opacity-70",
      )}
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CalendarClockIcon className="size-5" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {item.type?.title ?? item.block.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {view === "incoming" ? (
                <>با {item.guestName}</>
              ) : (
                <>در «{item.block.name}»</>
              )}
            </p>
          </div>
          <StatusBadge status={item.status} bucket={bucket} />
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDaysIcon className="size-3.5" />
            {dateStr}
          </span>
          <span dir="ltr" className="tabular-nums">
            {toPersianDigits(timeStr)}
          </span>
          {item.type ? (
            <span className="tabular-nums">
              {toPersianDigits(item.type.durationMin)} دقیقه
            </span>
          ) : null}
          <LocationPill item={item} />
        </div>
      </div>
    </button>
  );
}

function StatusBadge({
  status,
  bucket,
}: {
  status: BookingListItem["status"];
  bucket: Bucket;
}) {
  if (status === "cancelled") {
    return (
      <Badge variant="destructive" className="shrink-0">
        لغو شده
      </Badge>
    );
  }
  if (bucket === "past") {
    return (
      <Badge variant="secondary" className="shrink-0">
        انجام شد
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="shrink-0">
      تأیید شده
    </Badge>
  );
}

function LocationPill({ item }: { item: BookingListItem }) {
  if (item.block.locationType === "online") {
    return (
      <span className="inline-flex items-center gap-1">
        <VideoIcon className="size-3.5" />
        آنلاین
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <MapPinIcon className="size-3.5" />
      حضوری
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Detail Sheet
// ─────────────────────────────────────────────────────────────────────────

function BookingDetailSheet({
  selection,
  onClose,
}: {
  selection: { item: BookingListItem; view: View } | null;
  onClose: () => void;
}) {
  const open = selection !== null;
  const item = selection?.item ?? null;
  const view = selection?.view ?? "incoming";

  const [state, formAction, pending] = useActionState(
    cancelBookingAction,
    idleState,
  );

  useEffect(() => {
    if (state.status === "success" && state.message) {
      toast.success(state.message);
      onClose();
    } else if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!item) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="bottom" className="sm:max-w-lg sm:mx-auto" />
      </Sheet>
    );
  }

  const start = new Date(item.startsAtIso);
  const end = new Date(item.endsAtIso);
  const isUpcoming =
    item.status === "confirmed" && start.getTime() > Date.now();
  const canJoin = !!item.block.meetingLink && isUpcoming;
  const canCancel = item.status === "confirmed" && isUpcoming;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="flex max-h-[92dvh] flex-col gap-0 sm:max-w-lg sm:mx-auto"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="text-base">
            {item.type?.title ?? item.block.name}
          </SheetTitle>
          <SheetDescription>
            {view === "incoming" ? "جزئیات رزرو دریافتی" : "جزئیات رزرو شما"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 safe-pb">
          {/* When */}
          <section className="space-y-1 rounded-2xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClockIcon className="size-4" />
              زمان
            </div>
            <p className="text-sm">{formatPersianDate(start)}</p>
            <p dir="ltr" className="text-sm tabular-nums">
              {toPersianDigits(formatPersianTime(start))} —{" "}
              {toPersianDigits(formatPersianTime(end))}
            </p>
            {item.type ? (
              <p className="text-xs text-muted-foreground">
                مدت: {toPersianDigits(item.type.durationMin)} دقیقه
              </p>
            ) : null}
            {item.guestTimezone ? (
              <p dir="ltr" className="text-xs text-muted-foreground">
                {item.guestTimezone}
              </p>
            ) : null}
          </section>

          {/* Who */}
          <section className="space-y-2 rounded-2xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserIcon className="size-4" />
              {view === "incoming" ? "مهمان" : "بلوک"}
            </div>
            {view === "incoming" ? (
              <>
                <p className="text-sm font-semibold">{item.guestName}</p>
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`mailto:${item.guestEmail}`}
                    dir="ltr"
                    className="text-sm underline underline-offset-2"
                  >
                    {item.guestEmail}
                  </a>
                  <CopyButton value={item.guestEmail} label="ایمیل کپی شد" />
                </div>
              </>
            ) : (
              <p className="text-sm">{item.block.name}</p>
            )}
          </section>

          {/* Where */}
          <section className="space-y-2 rounded-2xl border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {item.block.locationType === "online" ? (
                <VideoIcon className="size-4" />
              ) : (
                <MapPinIcon className="size-4" />
              )}
              محل جلسه
            </div>

            {item.block.locationType === "online" ? (
              item.block.meetingLink ? (
                <>
                  <a
                    href={item.block.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                    dir="ltr"
                    className="block truncate text-sm underline underline-offset-2"
                  >
                    {item.block.meetingLink}
                  </a>
                  <div className="flex flex-wrap gap-2">
                    {canJoin ? (
                      <Button
                        render={
                          <a
                            href={item.block.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                        size="sm"
                        className="gap-1.5"
                      >
                        <VideoIcon className="size-4" />
                        ورود به جلسه
                      </Button>
                    ) : null}
                    <CopyButton
                      value={item.block.meetingLink}
                      label="لینک کپی شد"
                      inline
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  لینک جلسه هنوز ثبت نشده است.
                </p>
              )
            ) : item.block.locationAddress ? (
              <p className="text-sm">{item.block.locationAddress}</p>
            ) : (
              <p className="text-xs text-muted-foreground">آدرسی ثبت نشده.</p>
            )}
          </section>
        </div>

        {/* Footer */}
        {canCancel ? (
          <form action={formAction} className="border-t p-4 safe-pb">
            <input type="hidden" name="bookingId" value={item.id} />
            <Button
              type="submit"
              variant="destructive"
              className="w-full gap-2"
              disabled={pending}
            >
              <CalendarXIcon className="size-4" />
              {pending ? "در حال لغو…" : "لغو رزرو"}
            </Button>
          </form>
        ) : (
          <div className="border-t p-4 safe-pb">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onClose}
            >
              بستن
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CopyButton({
  value,
  label,
  inline,
}: {
  value: string;
  label: string;
  inline?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={inline ? "sm" : "icon"}
      className={inline ? "gap-1.5" : "tap-target"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast.success(label);
        } catch {
          toast.error("کپی انجام نشد");
        }
      }}
    >
      <CopyIcon className="size-4" />
      {inline ? <span>کپی</span> : <span className="sr-only">کپی</span>}
    </Button>
  );
}
