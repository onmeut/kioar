import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDaysIcon,
  LockIcon,
  MapPinIcon,
  TicketIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PublicEventRegister } from "@/components/events/public-event-register";
import { getCurrentViewer } from "@/lib/auth/session";
import { getPublicEvent } from "@/lib/events/queries";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; eventSlug: string }>;
}): Promise<Metadata> {
  const { slug, eventSlug } = await params;
  const event = await getPublicEvent(slug, eventSlug, null);
  if (!event) return { title: "رویداد پیدا نشد" };
  return {
    title: `${event.title} | ${event.pageName ?? "کی‌یو‌آر"}`,
    description: event.description ?? undefined,
    openGraph: {
      title: event.title,
      description: event.description ?? undefined,
      url: absoluteUrl(`/${slug}/e/${eventSlug}`),
      images: event.coverUrl ? [{ url: event.coverUrl }] : undefined,
    },
  };
}

function priceLabel(event: { priceType: "free" | "paid"; priceToman: number }) {
  if (event.priceType === "free") return "رایگان";
  return `${toPersianDigits(event.priceToman.toLocaleString("en-US"))} تومان`;
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string; eventSlug: string }>;
}) {
  const { slug, eventSlug } = await params;
  const viewer = await getCurrentViewer();
  const event = await getPublicEvent(slug, eventSlug, viewer?.user.id ?? null);
  if (!event) notFound();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-6 safe-pb">
      {/* Cover */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl bg-muted">
        {event.coverUrl ? (
          <Image
            src={event.coverUrl}
            alt={event.title}
            fill
            className="object-cover"
            priority
            sizes="(min-width: 768px) 42rem, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <TicketIcon className="size-12 opacity-50" />
          </div>
        )}
      </div>

      {/* Host */}
      <Link
        href={`/${event.pageSlug}`}
        className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Avatar className="size-7">
          {event.pageAvatarUrl ? (
            <AvatarImage src={event.pageAvatarUrl} alt={event.pageName ?? ""} />
          ) : null}
          <AvatarFallback>{(event.pageName ?? "؟").slice(0, 1)}</AvatarFallback>
        </Avatar>
        میزبان: {event.pageName ?? event.pageSlug}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">{event.title}</h1>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-primary/10 text-primary">
          {priceLabel(event)}
        </Badge>
        {event.spotsRemaining != null ? (
          <Badge className="rounded-full bg-muted text-foreground">
            {event.isFull
              ? "تکمیل ظرفیت"
              : `${toPersianDigits(event.spotsRemaining)} جای باقی‌مانده`}
          </Badge>
        ) : null}
      </div>

      {/* When & where */}
      <div className="mt-5 space-y-3 rounded-3xl border border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDaysIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">
              {formatShamsiDateTimeInZone(event.startsAt, event.timezone)}
            </p>
            {event.endsAt ? (
              <p className="text-sm text-muted-foreground">
                تا {formatShamsiDateTimeInZone(event.endsAt, event.timezone)}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {event.locationType === "online" ? (
              <VideoIcon className="size-5" />
            ) : (
              <MapPinIcon className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            {event.locationType === "online" ? (
              event.onlineUrl ? (
                <a
                  href={event.onlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline"
                  dir="ltr"
                >
                  {event.onlineUrl}
                </a>
              ) : (
                <p className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                  <LockIcon className="size-3.5" />
                  لینک پس از تأیید نمایش داده می‌شود
                </p>
              )
            ) : (
              <p className="font-semibold">
                {event.locationAddress ?? "محل برگزاری"}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {event.locationType === "online" ? "رویداد آنلاین" : "حضوری"}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      {event.description ? (
        <div className="mt-5">
          <h2 className="mb-2 text-sm font-bold text-muted-foreground">
            درباره رویداد
          </h2>
          <p className="text-pretty leading-8 whitespace-pre-line">
            {event.description}
          </p>
        </div>
      ) : null}

      {/* Register */}
      <div className="mt-6 rounded-3xl border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">ثبت‌نام</h2>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UsersIcon className="size-4 text-primary" />
            {toPersianDigits(event.confirmedSpots)} نفر
          </span>
        </div>
        <PublicEventRegister
          event={event}
          isLoggedIn={Boolean(viewer)}
          currentUserId={viewer?.user.id ?? null}
        />
      </div>
    </main>
  );
}
