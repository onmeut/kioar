import type { Metadata } from "next";
import Image from "next/image";
import {
  CalendarDaysIcon,
  LockIcon,
  MapPinIcon,
  TicketIcon,
  UsersIcon,
  VideoIcon,
} from "lucide-react";

import { PageThemeProvider } from "@/components/public-page/page-theme-provider";
import { KioarBadge } from "@/components/public/kioar-badge";
import { PublicProfileShareButton } from "@/components/public/public-profile-actions";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PublicEventRegister } from "@/components/events/public-event-register";
import { getCurrentViewer } from "@/lib/auth/session";
import { getPublicEvent } from "@/lib/events/queries";
import { coerceAppearance } from "@/lib/appearance/types";
import { formatShamsiDateTimeInZone } from "@/lib/date/timezone";
import { toPersianDigits } from "@/lib/date/persian";
import { absoluteUrl } from "@/lib/site";
import { notFound } from "next/navigation";
import Link from "next/link";

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

  const appearance = coerceAppearance(event.pageAppearance);
  const isDarkTheme = appearance.theme === "dark";
  const headerLogoSrc = isDarkTheme ? "/brand/logo-white.svg" : "/brand/logo.svg";
  const publicUrl = absoluteUrl(`/${slug}`);
  const displayName = event.pageName || "کی‌یو‌آر";

  return (
    <main
      dir="rtl"
      className="relative min-h-dvh overflow-x-hidden text-foreground"
    >
      <PageThemeProvider
        appearance={appearance}
        className="min-h-dvh w-full bg-muted"
      >
        <div className="relative mx-auto flex min-h-dvh w-full max-w-145 flex-col pt-[env(safe-area-inset-top)] lg:pt-10">
          <div className="relative flex flex-1 flex-col overflow-hidden bg-card pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1.5rem))] lg:rounded-t-[2rem] lg:shadow-card">
            {/* Header */}
            <div className="relative border-b border-border/40 px-6 pt-6 pb-4 lg:px-8 lg:pt-8">
              <div className="relative flex items-center justify-between">
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="max-w-[55%] truncate text-center text-base font-bold">
                    {event.title}
                  </span>
                </span>
                <a
                  href={publicUrl}
                  aria-label="بازگشت به پروفایل"
                  className="tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/[0.07] text-foreground transition-colors hover:bg-foreground/12"
                >
                  <Image src={headerLogoSrc} alt="" width={17} height={19} className="h-[19px] w-auto" />
                </a>
                <PublicProfileShareButton
                  url={absoluteUrl(`/${slug}/e/${eventSlug}`)}
                  title={`${event.title} | ${displayName}`}
                  slug={slug}
                  avatarUrl={event.pageAvatarUrl}
                  avatarSeed={event.pageAvatarSeed}
                  qrStyle={
                    (event.pageQrStyle as
                      | import("@/lib/qr/types").QrStyle
                      | null) ?? null
                  }
                  className="bg-foreground/[0.07] shadow-none hover:bg-foreground/12"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 py-6 lg:px-8">
              {/* Cover */}
              {event.coverUrl ? (
                <div className="w-full overflow-hidden rounded-3xl bg-muted">
                  <Image
                    src={event.coverUrl}
                    alt={event.title}
                    width={0}
                    height={0}
                    sizes="(min-width: 768px) 42rem, 100vw"
                    className="h-auto w-full"
                    priority
                  />
                </div>
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                  <TicketIcon className="size-12 opacity-50" />
                </div>
              )}

              {/* Host */}
              <Link
                href={`/${slug}`}
                className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Avatar className="size-7">
                  {event.pageAvatarUrl ? (
                    <AvatarImage src={event.pageAvatarUrl} alt={displayName} />
                  ) : null}
                  <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                میزبان: {displayName}
              </Link>

              <h1 className="mt-3 text-2xl font-bold">{event.title}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-primary/10 text-primary shadow-none">
                  {priceLabel(event)}
                </Badge>
                {event.spotsRemaining != null ? (
                  <Badge className="rounded-full bg-muted text-foreground shadow-none">
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

              {/* Register section */}
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
                  viewerHasPage={Boolean(viewer?.profile?.isComplete)}
                />
              </div>
            </div>

            {/* Footer badge */}
            <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-2 lg:px-8">
              <KioarBadge variant={isDarkTheme ? "dark" : "default"} />
            </div>
          </div>
        </div>
      </PageThemeProvider>
    </main>
  );
}
