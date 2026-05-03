/**
 * `/invited?via=<code>` — public landing for visitors who clicked an
 * invite link. By the time they land here, `/r/:code` has already
 * written the `kioar_ref` cookie so even if `via` is stripped during
 * navigation, attribution is preserved. The `via` param is decorative
 * so we can greet the visitor with the inviter's name + avatar.
 *
 * Rebuild notes (vs the prior version):
 *
 *   - Marketing-shell aesthetic (paper / ink palette, marketing-shell
 *     container, hero gradient backdrop) instead of the generic
 *     dashboard look.
 *   - Inviter card: avatar (Boring Avatar fallback) + their first
 *     page's display name + a clickable @slug link to peek at their
 *     real Kioar page.
 *   - Inline username claim: SlugInput → server action that writes the
 *     `kioar_pending_slug` cookie, redirects to /auth. Onboarding will
 *     pre-fill the slug.
 *   - Gift callout uses Sparkles + Gift icons in a violet/orange
 *     gradient pill.
 *   - Value-prop "what you'll get" carousel matching the homepage tone
 *     (outcomes not features).
 *   - Mobile-first: hero + claim CTA in the first viewport.
 */
import type { Metadata } from "next";

import Link from "next/link";

import {
  CalendarCheckIcon,
  GiftIcon,
  LinkIcon,
  QrCodeIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { eq, asc } from "drizzle-orm";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BoringAvatar } from "@/components/shared/boring-avatar";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { SlugInput } from "@/components/shared/slug-input";
import { claimHandleAction } from "@/app/invited/actions";
import { getReferrerByCode } from "@/lib/referrals";
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
    <div className="min-h-dvh bg-paper text-ink">
      {/* Header */}
      <header className="border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <BrandMark variant="wordmark" href="/" />
          <Button variant="ghost" size="sm" render={<Link href="/auth" />}>
            ورود به حساب
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative mx-auto w-full max-w-3xl px-4 pb-10 pt-10 sm:px-6 sm:pt-16">
          {/* Inviter chip */}
          {inviter ? (
            <div className="flex items-center gap-3 rounded-full border border-hairline bg-paper-soft px-3 py-2 shadow-sm sm:w-fit">
              <Avatar size="default" className="size-9">
                {inviter.avatarUrl ? (
                  <AvatarImage src={inviter.avatarUrl} alt={inviter.fullName} />
                ) : null}
                <AvatarFallback>
                  <BoringAvatar
                    seed={inviter.avatarSeed ?? inviter.slug}
                    size={36}
                  />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  دعوت‌نامه‌ای از سمت
                </p>
                <p className="truncate text-sm font-bold text-ink">
                  {inviter.fullName}
                </p>
              </div>
              {inviterUrl ? (
                <a
                  href={inviterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50"
                  dir="ltr"
                >
                  دیدن صفحه‌اش →
                </a>
              ) : null}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-paper-soft px-3 py-1.5 text-xs font-medium text-ink-soft">
              <SparklesIcon className="size-3.5 text-violet-500" />
              <span>دعوت‌نامه‌ی کی‌یو‌آر</span>
            </div>
          )}

          {/* Headline */}
          <h1 className="mt-6 text-[clamp(32px,6vw,52px)] font-semibold leading-[1.05] tracking-tight">
            {inviter ? (
              <>
                <span className="text-violet-600">{inviter.fullName}</span> شما
                را به <span className="whitespace-nowrap">کی‌یو‌آر</span> دعوت
                کرد
              </>
            ) : (
              <>
                به کی‌یو‌آر خوش اومدی —{" "}
                <span className="text-violet-600">یک ماه پرو</span> مهمون مایی
              </>
            )}
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-8 text-ink-soft sm:text-base">
            کی‌یو‌آر کارت ویزیت دیجیتالی هست که توش لینک، رزرو نوبت، فرم و QR
            زنده رو یه‌جا داری. همین حالا نام کاربریت رو بگیر — ساختش کم‌تر از
            دو دقیقه طول می‌کشه.
          </p>

          {/* Gift callout */}
          <div className="mt-7 flex items-start gap-3 overflow-hidden rounded-3xl border border-violet-200 bg-violet-50 p-4 sm:p-5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-600 ring-1 ring-violet-200 shadow-sm">
              <GiftIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-violet-900">
                  هدیه‌ی شما: ۳۰ روز پرو رایگان
                </p>
                <Badge
                  variant="outline"
                  className="border-violet-300 bg-white text-[10px] font-bold text-violet-700"
                >
                  خودکار
                </Badge>
              </div>
              <p className="mt-1 text-[12px] leading-6 text-ink-soft">
                وقتی پلن پرو رو روی صفحه‌ت فعال کنی، ۳۰ روز اضافه به دوره‌ی
                اشتراکت اضافه می‌شه. بدون کد تخفیف، بدون مرحله‌ی اضافه — مهمون
                {inviter ? ` ${inviter.fullName}` : " کی‌یو‌آر"} هستی.
              </p>
            </div>
          </div>

          {/* Inline username claim */}
          <form action={claimHandleAction} className="mt-7 grid gap-3">
            <label className="text-xs font-bold text-ink">
              نام کاربری دلخواهت رو همین الان قاپ بزن
            </label>
            <SlugInput name="handle" enterKeyHint="go" autoFocus={false} />
            <Button
              type="submit"
              size="lg"
              className="h-12 w-full rounded-full text-[15px] font-bold sm:w-auto sm:min-w-64"
            >
              ساخت رایگان حساب با این نام
            </Button>
            <p className="text-[11px] leading-6 text-ink-soft">
              با یه شماره موبایل ثبت‌نام می‌کنی. هیچ کارت بانکی لازم نیست.
            </p>
          </form>
        </div>
      </section>

      {/* Value-prop carousel */}
      <section className="bg-paper py-12 sm:py-16">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <h2 className="text-[clamp(22px,3.5vw,34px)] font-semibold leading-[1.15] tracking-tight">
            چی به دست میاری
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-7 text-ink-soft">
            نه یه لیست لینک خشک — یه صفحه‌ی فعال که برات نوبت می‌گیره، فرم پر
            می‌کنه و آمار میده.
          </p>

          {/* Mobile: horizontal scroll. Desktop: 4-col grid. */}
          <div className="mt-8 -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4 no-scrollbar">
            <ValueCard
              icon={LinkIcon}
              title="یه لینک، کلِ کار"
              body="همه‌ی لینک‌ها، شبکه‌های اجتماعی و راه‌های تماس روی یه صفحه‌ی تمیز."
              tone="violet"
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
          <div className="mt-10 flex items-center gap-3 rounded-3xl border border-hairline bg-paper-soft px-4 py-4 sm:gap-4 sm:px-6">
            <div className="flex shrink-0 items-center -space-x-2 ltr:space-x-reverse">
              <span className="size-9 rounded-full bg-violet-200 ring-2 ring-paper-soft" />
              <span className="size-9 rounded-full bg-orange-200 ring-2 ring-paper-soft" />
              <span className="size-9 rounded-full bg-emerald-200 ring-2 ring-paper-soft" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">
                +۲۰۰ هزار ایرانی روی کی‌یو‌آر
              </p>
              <p className="text-[11px] leading-6 text-ink-soft">
                ساخته شده برای کسب‌وکار واقعی — از فریلنسر تا کلینیک و رستوران.
              </p>
            </div>
          </div>

          {/* Inviter peek */}
          {inviter && inviterUrl ? (
            <div className="mt-6 rounded-3xl border border-hairline bg-paper-soft p-5">
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="size-14">
                  {inviter.avatarUrl ? (
                    <AvatarImage
                      src={inviter.avatarUrl}
                      alt={inviter.fullName}
                    />
                  ) : null}
                  <AvatarFallback>
                    <BoringAvatar
                      seed={inviter.avatarSeed ?? inviter.slug}
                      size={56}
                    />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">
                    صفحه‌ی {inviter.fullName} رو ببین
                  </p>
                  {inviter.title ? (
                    <p className="truncate text-[12px] text-ink-soft">
                      {inviter.title}
                    </p>
                  ) : null}
                  <p
                    className="mt-0.5 truncate font-mono text-[11px] text-ink-soft"
                    dir="ltr"
                  >
                    {inviterShareHost}/{inviter.slug}
                  </p>
                </div>
                <a
                  href={inviterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-auto shrink-0 rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"
                >
                  باز کن
                </a>
              </div>
            </div>
          ) : null}

          {/* Bottom CTA */}
          <div className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-hairline bg-paper-soft p-6 text-center sm:p-10">
            <UsersIcon className="size-7 text-violet-600" />
            <h3 className="text-xl font-semibold sm:text-2xl">
              همین الان شروع کن
            </h3>
            <p className="max-w-md text-[13px] leading-7 text-ink-soft">
              ساختن صفحه رایگانه. هدیه‌ی یک ماه پرو هم وقتی فعال کنی، خودکار
              اعمال می‌شه.
            </p>
            <Button
              size="lg"
              className="h-12 rounded-full px-8 text-[15px] font-bold"
              render={<Link href="/auth" />}
            >
              رایگان شروع کن
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
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: "violet" | "emerald" | "amber" | "sky";
}) {
  const toneRing: Record<string, string> = {
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="snap-start min-w-65 shrink-0 rounded-3xl border border-hairline bg-paper-soft p-5 transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-30px_rgba(15,23,42,0.18)] sm:min-w-0">
      <div
        className={`flex size-11 items-center justify-center rounded-2xl ${toneRing[tone]}`}
      >
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-[16px] font-semibold leading-tight tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-[13px] leading-7 text-ink-soft">{body}</p>
    </div>
  );
}
