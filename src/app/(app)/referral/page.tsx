/**
 * Dashboard → دعوت دوستان (redesign #3).
 *
 * - max-w-3xl shell
 * - "لینک دعوت" hero card: benefit tiles (شما ۱ ماه / دوستت ۱ ماه) +
 *   large discover-style invite-link chip + share button
 * - کد دعوت card removed
 * - Stats + progress: semantic tokens, rounded-4xl
 * - Social wall: only shows signups / conversions (clicks filtered out)
 * - Redemption grid unchanged
 */
import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import {
  GiftIcon,
  HeartHandshakeIcon,
  MousePointerClickIcon,
  PartyPopperIcon,
  Share2Icon,
  TrendingUpIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";

import { ShareSheet } from "@/app/(app)/referral/share-sheet";
import { RedeemGrid } from "@/app/(app)/referral/redeem-grid";
import { ReferralRewardToaster } from "@/app/(app)/referral/reward-toaster";
import { CopyableInviteLink } from "@/app/(app)/referral/copy-link";
import { ReferralFeed } from "@/components/referral/referral-feed";
import { getCurrentViewer } from "@/lib/auth/session";
import { listPagesForOwner } from "@/lib/pages";
import { getReferralStats } from "@/lib/referrals";
import { profileShareHost } from "@/lib/profile-domains";
import { absoluteUrl } from "@/lib/site";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { getDb } from "@/db";
import { pageSubscriptions, plans } from "@/db/schema";

export const metadata: Metadata = { title: "دعوت دوستان" };
export const dynamic = "force-dynamic";

export default async function ReferralPage() {
  const viewer = await getCurrentViewer();
  if (!viewer) redirect("/auth");

  const stats = await getReferralStats(viewer.user.id);
  const ownedPages = await listPagesForOwner(viewer.user.id);

  const subRows =
    ownedPages.length > 0
      ? await getDb()
          .select({
            pageId: pageSubscriptions.pageId,
            planKey: plans.key,
            currentPeriodEnd: pageSubscriptions.currentPeriodEnd,
          })
          .from(pageSubscriptions)
          .innerJoin(plans, eq(plans.id, pageSubscriptions.planId))
          .where(
            inArray(
              pageSubscriptions.pageId,
              ownedPages.map((p) => p.id),
            ),
          )
      : [];
  const subByPage = new Map(subRows.map((s) => [s.pageId, s]));

  const redeemPages = ownedPages.map((p) => {
    const sub = subByPage.get(p.id);
    return {
      id: p.id,
      slug: p.slug,
      fullName: p.fullName,
      avatarUrl: p.avatarUrl,
      avatarSeed: p.avatarSeed,
      domain: p.domain,
      planKey: (sub?.planKey ?? "free") as "free" | "pro" | "business",
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      shareHost: profileShareHost(p.slug, p.domain ?? "kioar.com"),
    };
  });

  const inviteUrl = absoluteUrl(`/r/${stats.code.code}`);
  const inviterName =
    ownedPages[0]?.fullName?.trim() || ownedPages[0]?.slug || "دوست شما";

  // Cap progress: earned (capped at cap) over cap.
  const earnedCapped = Math.min(stats.monthsEarned, stats.cap);
  const capPercent = Math.round((earnedCapped / stats.cap) * 100);

  // Show milestone toast when conversions hit a friendly threshold.
  const milestone = milestoneFor(stats.conversions);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 space-y-6 py-6 sm:py-10">
      <ReferralRewardToaster
        latestRewardedAt={stats.latestRewardedAt?.toISOString() ?? null}
        monthsAvailable={stats.monthsAvailable}
      />

      <header className="flex flex-col items-center gap-4 text-center pb-2">
        <BrandMark variant="mark" className="size-12" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            برنامه‌ی دعوت
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            دوستات رو بیار، با هم پرو شو
          </h1>
        </div>
      </header>

      {/* 1. Hero — benefit tiles + invite link + share */}
      <section className="rounded-4xl bg-card p-5 border border-border">
        <h2 className="text-lg font-bold mb-4">لینک دعوت</h2>

        {/* Benefit visualization — شما ۱ ماه / دوستت ۱ ماه */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <UserIcon className="size-4 text-violet-700" />
              </span>
              <p className="text-sm font-bold text-violet-900">شما</p>
            </div>
            <p className="text-3xl font-extrabold text-violet-900">۱ ماه</p>
            <p className="text-xs text-violet-600 mt-1">پرو رایگان</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                <HeartHandshakeIcon className="size-4 text-emerald-700" />
              </span>
              <p className="text-sm font-bold text-emerald-900">دوستت</p>
            </div>
            <p className="text-3xl font-extrabold text-emerald-900">۱ ماه</p>
            <p className="text-xs text-emerald-600 mt-1">پرو رایگان</p>
          </div>
        </div>

        <p className="mb-4 text-xs leading-6 text-muted-foreground">
          هر کسی با این لینک ثبت‌نام کنه و پرو رو فعال کنه، هر دو طرف یک ماه پرو
          رایگان می‌گیرن — تا سقف {toPersianDigits(stats.cap)} ماه برای شما.
        </p>

        {/* Invite link chip with Kioar logo */}
        <CopyableInviteLink inviteUrl={inviteUrl} />

        <div className="mt-3">
          <ShareSheet
            inviteUrl={inviteUrl}
            inviterName={inviterName}
            trigger={
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-bold text-background transition hover:bg-foreground/90"
              >
                <Share2Icon className="size-4" />
                اشتراک‌گذاری دعوت
              </button>
            }
          />
        </div>
      </section>

      {/* 2. Stats + cap progress */}
      <section className="rounded-4xl bg-card p-5 border border-border">
        <div className="space-y-1">
          <h2 className="text-base font-bold">کارنامه‌ی دعوت‌های شما</h2>
          <p className="text-xs leading-6 text-muted-foreground">
            از کلیک تا پرو شدن — مسیر کاملِ هر دعوتی که فرستادی.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatTile
            icon={MousePointerClickIcon}
            label="کلیک"
            value={stats.clicks}
          />
          <StatTile icon={UsersIcon} label="ثبت‌نام" value={stats.signups} />
          <StatTile
            icon={TrendingUpIcon}
            label="پرو شد"
            value={stats.conversions}
            tone="primary"
          />
          <StatTile
            icon={GiftIcon}
            label="ماه آماده"
            value={stats.monthsAvailable}
            tone="emerald"
          />
        </div>

        {/* Cap progress */}
        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold">موجودی اعتبار</p>
            <p className="text-xs text-muted-foreground">
              <span dir="ltr" className="font-bold text-foreground">
                {toPersianDigits(stats.monthsEarned)}
              </span>{" "}
              از{" "}
              <span dir="ltr" className="font-bold text-foreground">
                {toPersianDigits(stats.cap)}
              </span>{" "}
              ماه
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${capPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            مصرف‌شده:{" "}
            <span dir="ltr" className="font-semibold text-foreground">
              {toPersianDigits(stats.monthsRedeemed)}
            </span>{" "}
            ماه • قابل اعمال:{" "}
            <span dir="ltr" className="font-semibold text-emerald-600">
              {toPersianDigits(stats.monthsAvailable)}
            </span>{" "}
            ماه
          </p>
        </div>

        {milestone ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-6 text-amber-900">
            <PartyPopperIcon className="size-4 shrink-0" />
            <span>{milestone}</span>
          </div>
        ) : null}
      </section>

      {/* 3. Social wall */}
      <section className="rounded-4xl bg-card p-5 border border-border">
        <div className="space-y-1">
          <h2 className="text-base font-bold">
            کسانی که با لینک تو وارد کی‌یو‌آر شدن
          </h2>
          <p className="text-xs leading-6 text-muted-foreground">
            ۲۰ نفر آخر — اونایی که پرو شدن با حاشیه‌ی بنفش مشخصن.
          </p>
        </div>
        <div className="mt-4 -mx-5">
          <ReferralFeed rows={feedToClient(stats.recentReferrals)} />
        </div>
      </section>

      {/* 4. Redemption */}
      <section className="rounded-4xl bg-card p-5 border border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-bold">اعمال یک ماه روی صفحه‌ت</h2>
            <p className="text-xs leading-6 text-muted-foreground">
              هر بار یه ماه پرو رو روی هر صفحه‌ای که خواستی فعال کن. صفحه‌های
              رایگان نیاز به ارتقا دارن.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            {toPersianDigits(stats.monthsAvailable)} ماه آماده
          </span>
        </div>

        <div className="mt-4">
          {redeemPages.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
              هنوز صفحه‌ای ندارید.
            </p>
          ) : stats.monthsAvailable < 1 ? (
            <EmptyAvailable />
          ) : (
            <RedeemGrid pages={redeemPages} available={stats.monthsAvailable} />
          )}
        </div>
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "primary" | "emerald";
}) {
  const wrap =
    tone === "primary"
      ? "border-primary/20 bg-primary/5"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-border bg-background";
  const chip =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "emerald"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-muted text-foreground";
  const valueCls =
    tone === "primary"
      ? "text-primary"
      : tone === "emerald"
        ? "text-emerald-700"
        : "text-foreground";
  return (
    <div className={cn("rounded-2xl border p-3", wrap)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-lg",
            chip,
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span>{label}</span>
      </div>
      <div
        className={cn("mt-1.5 text-2xl font-extrabold leading-none", valueCls)}
      >
        {toPersianDigits(value)}
      </div>
    </div>
  );
}

function EmptyAvailable() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-card text-primary border border-primary/20">
        <GiftIcon className="size-6" />
      </div>
      <p className="mt-3 text-sm font-bold">هنوز اعتباری نداری</p>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        اولین ماه پروی رایگانت وقتی می‌رسه که اولین دوستت با لینک تو پرو رو فعال
        کنه. فقط لازمه لینکت رو بفرستی — بقیه کارها خودکاره.
      </p>
    </div>
  );
}

function milestoneFor(conversions: number): string | null {
  if (conversions === 1)
    return "اولین تبدیل ✨ — کارت معجزه می‌کنه. ادامه بده!";
  if (conversions === 3) return "۳ نفر پرو شدن. ۳ ماه پرو رایگان مهمون شمایید.";
  if (conversions === 5)
    return "۵ تبدیل — حالا جزو دعوت‌کنندگان فعال کی‌یو‌آری.";
  if (conversions === 10)
    return "۱۰ تبدیل، ۱۰ ماه پرو. واقعاً چیز خاصی فروختی.";
  return null;
}

type ServerFeedRow = Awaited<
  ReturnType<typeof getReferralStats>
>["recentReferrals"][number];

function feedToClient(rows: ServerFeedRow[]) {
  return rows
    .filter((r) => r.status !== "clicked")
    .map((r) => ({
      id: r.id,
      status: r.status,
      refereeName: r.refereeName,
      refereeSlug: r.refereeSlug,
      refereeAvatarUrl: r.refereeAvatarUrl,
      refereeAvatarSeed: r.refereeAvatarSeed,
      refereeDomain: r.refereeDomain,
      refereePlanKey: r.refereePlanKey,
      clickedAt: r.clickedAt.toISOString(),
      signedUpAt: r.signedUpAt?.toISOString() ?? null,
      convertedAt: r.convertedAt?.toISOString() ?? null,
      rewardedAt: r.rewardedAt?.toISOString() ?? null,
    }));
}
