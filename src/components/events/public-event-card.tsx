import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon, VideoIcon } from "lucide-react";

import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";

export type PublicEventCardData = {
  id: string;
  slug: string;
  pageSlug: string;
  pageName: string | null;
  title: string;
  coverUrl: string | null;
  locationType: "physical" | "online";
  priceType: "free" | "paid";
  priceToman: number;
  startsAt: string; // ISO
  timezone: string;
};

/** Discovery / block card linking to the branded public event page. */
export function PublicEventCard({ event }: { event: PublicEventCardData }) {
  return (
    <Link
      href={`/${event.pageSlug}/e/${event.slug}` as Route}
      className="group flex h-full flex-col overflow-hidden rounded-4xl border border-border bg-card transition-colors hover:bg-muted/40"
    >
      {event.coverUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <Image
            src={event.coverUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted">
          <CalendarDaysIcon className="size-8 text-muted-foreground/50" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-bold leading-snug">{event.title}</h3>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDaysIcon className="size-3.5 shrink-0" />
          {formatShamsiDateTimeInZone(new Date(event.startsAt), event.timezone)}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {event.locationType === "online" ? (
              <VideoIcon className="size-3.5" />
            ) : (
              <MapPinIcon className="size-3.5" />
            )}
            {event.locationType === "online" ? "آنلاین" : "حضوری"}
          </span>
          <span className="text-xs font-semibold">
            {event.priceType === "free"
              ? "رایگان"
              : `${toPersianDigits(event.priceToman.toLocaleString("en-US"))} تومان`}
          </span>
        </div>

        {event.pageName ? (
          <p className="truncate text-xs text-muted-foreground/70">
            میزبان: {event.pageName}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
