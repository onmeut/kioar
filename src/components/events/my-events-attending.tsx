"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { CalendarDaysIcon, QrCodeIcon } from "lucide-react";

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
      {upcoming.length === 0 && past.length === 0 ? (
        <p className="rounded-4xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          هنوز در رویدادی ثبت‌نام نکرده‌اید.
        </p>
      ) : null}

      {upcoming.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((item) => (
            <AttendingCard key={item.registrationId} item={item} onShowQr={() => setQrOpen(true)} />
          ))}
        </ul>
      ) : null}

      {past.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            رویدادهای گذشته
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
            {past.map((item) => (
              <AttendingCard key={item.registrationId} item={item} onShowQr={() => setQrOpen(true)} />
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

function AttendingCard({ item, onShowQr }: { item: AttendingItem; onShowQr: () => void }) {
  return (
    <li className="flex h-full flex-col overflow-hidden rounded-4xl border border-border bg-card">
      <Link
        href={`/${item.pageSlug}/e/${item.eventSlug}` as Route}
        className="flex aspect-[16/9] w-full items-center justify-center bg-muted"
      >
        <CalendarDaysIcon className="size-8 text-muted-foreground/50" />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/${item.pageSlug}/e/${item.eventSlug}` as Route}
            className="min-w-0 flex-1"
          >
            <h3 className="line-clamp-2 font-bold leading-snug hover:underline">
              {item.title}
            </h3>
          </Link>
          <Badge
            className={cn("shrink-0 rounded-full", STATUS_TONE[item.status] ?? "")}
          >
            {REGISTRATION_STATUS_LABELS[item.status]}
          </Badge>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDaysIcon className="size-3.5 shrink-0" />
          {formatShamsiDateTimeInZone(new Date(item.startsAt), item.timezone)}
        </p>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {!item.isPast ? (
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
              className="h-9 w-full text-xs"
            />
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full text-xs"
            onClick={onShowQr}
          >
            <QrCodeIcon className="size-3.5" />
            نمایش کد QR برای ورود
          </Button>
        </div>
      </div>
    </li>
  );
}
