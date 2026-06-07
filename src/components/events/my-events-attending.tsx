"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { QrCodeIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QrCard } from "@/components/dashboard/qr-card";
import { AddToCalendar } from "@/components/events/add-to-calendar";
import { REGISTRATION_STATUS_LABELS } from "@/lib/events/labels";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { cn } from "@/lib/utils";
import { cancelRegistrationAction } from "@/app/[slug]/e/[eventSlug]/actions";

export type AttendingItem = {
  registrationId: string;
  eventId: string;
  title: string;
  eventSlug: string;
  pageSlug: string;
  description: string | null;
  locationType: "physical" | "online";
  locationAddress: string | null;
  startsAt: string; // ISO
  endsAt: string | null; // ISO
  timezone: string;
  status: keyof typeof REGISTRATION_STATUS_LABELS;
  isPast: boolean;
};

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-500/12 text-emerald-700",
  attended: "bg-sky-500/12 text-sky-700",
  pending_approval: "bg-amber-500/12 text-amber-800",
  payment_pending: "bg-amber-500/12 text-amber-800",
  payment_submitted: "bg-amber-500/12 text-amber-800",
  waitlisted: "bg-violet-500/12 text-violet-700",
};

export function MyEventsAttending({
  items,
  qrUrl,
}: {
  items: AttendingItem[];
  qrUrl: string;
}) {
  const upcoming = items.filter((i) => !i.isPast);
  const past = items.filter((i) => i.isPast);
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full"
        onClick={() => setQrOpen(true)}
      >
        <QrCodeIcon className="size-5" />
        نمایش کد QR برای ورود
      </Button>

      {upcoming.length === 0 && past.length === 0 ? (
        <p className="rounded-4xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          هنوز در رویدادی ثبت‌نام نکرده‌اید.
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <ul className="space-y-3">
          {upcoming.map((item) => (
            <AttendingCard key={item.registrationId} item={item} />
          ))}
        </ul>
      ) : null}

      {past.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            رویدادهای گذشته
          </h2>
          <ul className="space-y-3 opacity-70">
            {past.map((item) => (
              <AttendingCard key={item.registrationId} item={item} />
            ))}
          </ul>
        </div>
      ) : null}

      <Sheet open={qrOpen} onOpenChange={setQrOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>کد QR شما</SheetTitle>
          </SheetHeader>
          <div className="p-4 pt-0">
            <p className="mb-4 text-center text-sm text-muted-foreground">
              این کد را در ورودی رویداد به میزبان نشان دهید.
            </p>
            <QrCard url={qrUrl} title="کد QR کی‌یوآر من" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AttendingCard({ item }: { item: AttendingItem }) {
  const [pending, start] = useTransition();
  const confirmed = item.status === "approved" || item.status === "attended";
  const canCancel =
    !item.isPast &&
    item.status !== "attended" &&
    item.status !== "rejected" &&
    item.status !== "cancelled";

  function cancel() {
    if (!window.confirm("ثبت‌نام شما لغو شود؟")) return;
    start(async () => {
      const res = await cancelRegistrationAction(item.pageSlug, item.eventSlug);
      if (res.ok) toast.success("ثبت‌نام لغو شد.");
      else toast.error(res.message ?? "لغو ناموفق بود.");
    });
  }

  return (
    <li className="rounded-4xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/${item.pageSlug}/e/${item.eventSlug}` as Route}
          className="min-w-0 flex-1"
        >
          <h3 className="truncate font-bold hover:underline">{item.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatShamsiDateTimeInZone(new Date(item.startsAt), item.timezone)}
          </p>
        </Link>
        <Badge className={cn("rounded-full", STATUS_TONE[item.status] ?? "")}>
          {REGISTRATION_STATUS_LABELS[item.status]}
        </Badge>
      </div>

      {confirmed && !item.isPast ? (
        <div className="mt-3">
          <AddToCalendar
            title={item.title}
            description={item.description}
            location={
              item.locationType === "physical" ? item.locationAddress : null
            }
            startsAt={item.startsAt}
            endsAt={item.endsAt}
            timezone={item.timezone}
            uid={item.eventId}
            url={`https://kioar.com/${item.pageSlug}/e/${item.eventSlug}`}
          />
        </div>
      ) : null}

      {canCancel ? (
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="mt-3 text-xs text-rose-600 underline-offset-2 hover:underline disabled:opacity-50"
        >
          لغو ثبت‌نام
        </button>
      ) : null}
    </li>
  );
}
