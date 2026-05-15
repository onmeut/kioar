/**
 * `/invited?via=<code>` — public landing for visitors who clicked an
 * invite link. Shares the same visual language as /discover:
 * - bg-muted page background
 * - Discover-style full navbar (logo + nav links + auth CTAs)
 * - Cards = bg-card on bg-muted, no borders/shadows
 */
import type { Metadata } from "next";

import Image from "next/image";
import Link from "next/link";

import {
  CalendarCheckIcon,
  GiftIcon,
  LinkIcon,
  QrCodeIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { eq, asc } from "drizzle-orm";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Button } from "@/components/ui/button";
import { SlugInput } from "@/components/shared/slug-input";
import { claimHandleAction } from "@/app/invited/actions";
import { getReferrerByCode } from "@/lib/referrals";
import { cn } from "@/lib/utils";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import {
  DEFAULT_PROFILE_DOMAIN,
  isProfileDomain,
  profileShareHost,
  profileShareUrl,
} from "@/lib/profile-domains";

export const dynamic = "force-dynamic";

type Inviter = {
  fullName: string;
  slug: string;
  domain: string;
  avatarUrl: string | null;
  avatarSeed: string | null;
  title: string | null;
};

async function getInviter(code: string): Promise<Inviter | null> {
  try {
    const referrer = await getReferrerByCode(code);
    if (!referrer) return null;
    const db = getDb();
    const page = await db.query.profiles.findFirst({
      where: eq(profiles.userId, referrer.referrer.id),
      orderBy: [asc(profiles.createdAt)],
      columns: {
        slug: true,
        fullName: true,
        avatarUrl: true,
        avatarSeed: true,
        title: true,
        domain: true,
      },
    });
    if (!page) return null;
    return {
      fullName: page.fullName?.trim() || page.slug,
      slug: page.slug,
      domain: page.domain,
      avatarUrl: page.avatarUrl,
      avatarSeed: page.avatarSeed,
      title: page.title,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ via?: string | string[] }>;
}): Promise<Metadata> {
  const params = await searchParams;
  const raw = Array.isArray(params.via) ? params.via[0] : params.via;
  const code = typeof raw === "string" ? raw : null;
  const inviter = code ? await getInviter(code) : null;

  const title = inviter
    ? `${inviter.fullName} شما را به کی‌یو‌آر دعوت کرد — یک ماه پرو رایگان`
    : "دعوت‌نامه‌ی کی‌یو‌آر — یک ماه پرو رایگان";
  const description = inviter
    ? `با لینک ${inviter.fullName} به کی‌یو‌آر بپیوندید و یک ماه پروی رایگان روی صفحه‌تان فعال کنید.`
    : "با دعوت یک دوست، یک ماه پرو رایگان روی صفحه‌ی شما فعال می‌شود.";

  const ogImage = code ? `/api/og/invite/${encodeURIComponent(code)}` : null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

type SearchParams = Promise<{ via?: string | string[] }>;

export default async function InvitedPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawVia = params.via;
  const code = Array.isArray(rawVia) ? rawVia[0] : rawVia;
  const inviter = code ? await getInviter(code) : null;

  const inviterDomain = inviter
    ? isProfileDomain(inviter.domain)
      ? inviter.domain
      : DEFAULT_PROFILE_DOMAIN
    : DEFAULT_PROFILE_DOMAIN;
  const inviterUrl = inviter
    ? profileShareUrl(inviter.slug, inviterDomain)
    : null;
  const inviterShareHost = inviter
    ? profileShareHost(inviter.slug, inviterDomain)
    : null;

  return (
    <div
      dir="rtl"
      className="relative min-h-dvh bg-muted font-sans pt-[env(safe-area-inset-top)]"
    >
      {/* Discover-style floating pill navbar */}
      <div className="sticky top-4 z-30 mx-auto w-full max-w-3xl px-4">
        <header className="flex h-16 w-full items-center justify-between rounded-full bg-card pl-2 pr-5 ring-1 ring-border">
          {/* Logo */}
          <Link
            href="/"
            aria-label="کیوآر"
            className="flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Image
              src="/brand/logo.svg"
              alt=""
              width={20}
              height={24}
              className="h-6 w-auto"
              priority
            />
            <span className="hidden text-lg font-bold sm:inline">کیوآر</span>
          </Link>
          {/* Auth CTAs */}
          <div className="flex items-center gap-2">
            <Link
              href="/auth"
              className="hidden h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/80 sm:flex"
            >
              ورود
            </Link>
            <Link
              href="/start"
              className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
            >
              ثبت‌نام رایگان
            </Link>
          </div>
        </header>
      </div>

      {/* Hero */}
      <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Inviter chip — avatar on end (RTL left), label then bold name */}
          {inviter ? (
            <a
              href={inviterUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm transition hover:bg-card/80"
            >
              <span className="text-[11px] text-muted-foreground">
                دعوت‌نامه‌ای از سمت
              </span>
              <span className="font-bold">{inviter.fullName}</span>
              <Avatar className="size-7 rounded-full">
                {inviter.avatarUrl ? (
                  <AvatarImage src={inviter.avatarUrl} alt={inviter.fullName} />
                ) : null}
                <AvatarFallback>
                  <KioarAvatar
                    seed={inviter.avatarSeed ?? inviter.slug}
                    size={28}
                  />
                </AvatarFallback>
              </Avatar>
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
              <GiftIcon className="size-3.5 text-primary" />
              <span>دعوت‌نامه‌ی کی‌یو‌آر</span>
            </div>
          )}

          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            {inviter ? (
              <>
                <span className="text-primary">{inviter.fullName}</span> شما را
                به کی‌یو‌آر دعوت کرد
              </>
            ) : (
              <>یک ماه اشتراکِ پرو، مهمانِ ما</>
            )}
          </h1>

          <p className="max-w-sm text-sm leading-7 text-muted-foreground sm:text-[15px]">
            کی‌یو‌آر کارت ویزیت دیجیتالی هست که توش لینک، رزرو نوبت، فرم و QR
            زنده رو یه‌جا داری. همین حالا نام کاربریت رو بگیر.
          </p>
        </div>

        {/* Username claim card */}
        <form
          action={claimHandleAction}
          className="rounded-3xl bg-card p-5 space-y-3"
        >
          <label className="block text-sm font-bold">
            نام کاربری دلخواهت رو همین الان قاپ بزن
          </label>
          <SlugInput
            name="handle"
            enterKeyHint="go"
            autoFocus={false}
            placeholder="elonmusc"
          />
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-full text-[15px] font-bold"
          >
            ساخت صفحه رایگان
          </Button>
        </form>

        {/* Gift callout */}
        <div className="rounded-3xl bg-white p-5">
          <div className="mb-4 flex items-center justify-center gap-2">
            <GiftIcon className="size-4 text-violet-700" />
            <p className="text-sm font-bold text-violet-900">
              هدیه‌ی دوطرفه: ۳۰ روز پرو رایگان
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-violet-50 p-4 text-center">
              <p className="text-xs font-medium text-violet-700">شما</p>
              <p className="mt-1 text-3xl font-extrabold text-violet-900">
                ۱ ماه
              </p>
              <p className="text-xs text-violet-600">پرو رایگان</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4 text-center">
              <p className="text-xs font-medium text-violet-700">دوستت</p>
              <p className="mt-1 text-3xl font-extrabold text-violet-900">
                ۱ ماه
              </p>
              <p className="text-xs text-violet-600">پرو رایگان</p>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] leading-5 text-violet-600/80">
            توام بعدا می‌تونی دوستات رو دعوت کنی و اشتراک رایگان بگیری
          </p>
        </div>
      </section>

      {/* Value-prop section */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold sm:text-3xl">چی به دست میاری</h2>
            <p className="max-w-xl text-[14px] leading-7 text-muted-foreground">
              نه یه لیست لینک خشک — یه صفحه‌ی فعال که برات نوبت می‌گیره، فرم پر
              می‌کنه و آمار میده.
            </p>
          </div>

          <div className="mt-6 -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:px-0 no-scrollbar">
            <ValueCard
              icon={LinkIcon}
              title="یه لینک، کلِ کار"
              body="همه‌ی لینک‌ها، شبکه‌های اجتماعی و راه‌های تماس روی یه صفحه‌ی تمیز."
              tone="primary"
            />
            <ValueCard
              icon={CalendarCheckIcon}
              title="رزرو نوبت بدون چت"
              body="مشتری توی همون صفحه روز و ساعت رو انتخاب می‌کنه. دیگه پیام نزن."
              tone="emerald"
            />
            <ValueCard
              icon={QrCodeIcon}
              title="QR کد و کارت NFC"
              body="یه QR زنده داری که هر زمان قابل ویرایشه. کارت NFC هم قابل سفارشه."
              tone="amber"
            />
            <ValueCard
              icon={TrendingUpIcon}
              title="آمار روزانه‌ی واقعی"
              body="می‌بینی دقیقاً چقدر نفر دیدنت کرده، روی چی کلیک کرده و از کجا اومدن."
              tone="sky"
            />
          </div>

          {/* Trust line */}
          <div className="mt-6 flex items-center gap-3 rounded-3xl bg-card px-4 py-4 sm:gap-4 sm:px-6">
            <div className="flex shrink-0 items-center -space-x-2 ltr:space-x-reverse">
              <span className="size-9 rounded-full bg-primary/30 ring-2 ring-card" />
              <span className="size-9 rounded-full bg-amber-200 ring-2 ring-card" />
              <span className="size-9 rounded-full bg-emerald-200 ring-2 ring-card" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">+۲۰۰ هزار ایرانی روی کی‌یو‌آر</p>
              <p className="text-[11px] leading-6 text-muted-foreground">
                ساخته شده برای کسب‌وکار واقعی — از فریلنسر تا کلینیک و رستوران.
              </p>
            </div>
          </div>

          {/* Inviter peek — round avatar linking to their profile, chip below */}
          {inviter && inviterUrl && inviterShareHost ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold">
                صفحه‌ی {inviter.fullName} رو ببین
              </p>
              <a
                href={inviterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-3xl bg-card p-4 transition hover:bg-card/80"
              >
                {/* Avatar */}
                <Avatar className="size-12 shrink-0 rounded-full">
                  {inviter.avatarUrl ? (
                    <AvatarImage
                      src={inviter.avatarUrl}
                      alt={inviter.fullName}
                    />
                  ) : null}
                  <AvatarFallback>
                    <KioarAvatar
                      seed={inviter.avatarSeed ?? inviter.slug}
                      size={48}
                    />
                  </AvatarFallback>
                </Avatar>

                {/* Name + title */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {inviter.fullName}
                  </p>
                  {inviter.title ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {inviter.title}
                    </p>
                  ) : null}
                </div>

                {/* URL chip */}
                <span
                  dir="ltr"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-muted px-3 text-sm font-medium text-foreground"
                >
                  <Image
                    src="/brand/logo.svg"
                    alt=""
                    width={14}
                    height={18}
                    className="h-[16px] w-auto opacity-60"
                  />
                  <span>{inviterShareHost}</span>
                </span>
              </a>
            </div>
          ) : null}

          {/* Bottom CTA */}
          <div className="mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card p-6 text-center sm:p-10">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <UsersIcon className="size-6" />
            </span>
            <h3 className="text-xl font-bold sm:text-2xl">همین الان شروع کن</h3>
            <p className="max-w-md text-[13px] leading-7 text-muted-foreground">
              ساختن صفحه رایگانه. هدیه‌ی یک ماه پرو هم وقتی فعال کنی، خودکار
              اعمال می‌شه.
            </p>
            <Button
              size="lg"
              className="h-12 rounded-full px-8 text-[15px] font-bold"
              render={<Link href="/start" />}
            >
              ساخت صفحه رایگان
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ValueCard({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone: "primary" | "emerald" | "amber" | "sky";
}) {
  const chip: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="snap-start min-w-65 shrink-0 rounded-3xl bg-card p-5 transition hover:bg-card/80 sm:min-w-0">
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-2xl",
          chip[tone],
        )}
      >
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-[16px] font-bold leading-tight">{title}</h3>
      <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{body}</p>
    </div>
  );
}
