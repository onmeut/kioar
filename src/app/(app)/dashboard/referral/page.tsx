/**
 * Dashboard → دعوت دوستان (redesigned).
 *
 * Layout follows standard dashboard chrome: max-w-3xl shell, eyebrow +
 * h1 header, cards stacked with `space-y-6`. Sections in order:
 *
 *   1. Hero card — copy-able invite link + share-sheet trigger.
 *   2. Stats row — clicks / signups / conversions, plus a 12-month-cap
 *      progress bar showing earned vs the cap.
 *   3. Social wall — recent invitees rendered as avatar+slug rows,
 *      converted rows highlighted with an emerald accent. Ghost rows
 *      for clicked-only entries (privacy-preserving).
 *   4. Redemption grid — every owned page as a visual card with a CTA
 *      button to apply one month of credit. Replaces the old Select
 *      that exposed UUIDs.
 *
 * Backend logic in `lib/referrals.ts` is untouched — this is purely a
 * presentation rebuild.
 */
import type { Metadata } from "next";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import {
  GiftIcon,
  MousePointerClickIcon,
  PartyPopperIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { ShareSheet } from "@/app/(app)/dashboard/referral/share-sheet";
import { RedeemGrid } from "@/app/(app)/dashboard/referral/redeem-grid";
import { ReferralRewardToaster } from "@/app/(app)/dashboard/referral/reward-toaster";
import {
  CopyableInviteCode,
  CopyableInviteLink,
} from "@/app/(app)/dashboard/referral/copy-link";
import { ReferralFeed } from "@/components/referral/referral-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentViewer } from "@/lib/auth/session";
import { listPagesForOwner } from "@/lib/pages";
import { getReferralStats } from "@/lib/referrals";
import { profileShareHost } from "@/lib/profile-domains";
import { absoluteUrl } from "@/lib/site";
import { toPersianDigits } from "@/lib/persian";
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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      <ReferralRewardToaster
        latestRewardedAt={stats.latestRewardedAt?.toISOString() ?? null}
        monthsAvailable={stats.monthsAvailable}
      />

      <header className="space-y-1">
        <p className="text-xs font-medium text-zinc-500">برنامه‌ی دعوت</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          دوستات رو بیار، با هم پرو شو
        </h1>
      </header>

      {/* 1. Hero — invite link + share */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <GiftIcon className="size-5" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-base">لینک شخصی شما</CardTitle>
              <p className="text-xs text-zinc-500">
                هر کسی با این لینک ثبت‌نام کنه و پرو رو فعال کنه، یک ماه پروی
                رایگان به دوره‌ی شما اضافه می‌شه — تا سقف{" "}
                {toPersianDigits(stats.cap)} ماه. دوست شما هم یک ماه پرو هدیه
                می‌گیره.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyableInviteCode code={stats.code.code} />
          <CopyableInviteLink inviteUrl={inviteUrl} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <ShareSheet inviteUrl={inviteUrl} inviterName={inviterName} />
          </div>
        </CardContent>
      </Card>

      {/* 2. Stats + cap progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">کارنامه‌ی دعوت‌های شما</CardTitle>
          <p className="mt-1 text-xs text-zinc-500">
            از کلیک تا پرو شدن — مسیر کاملِ هر دعوتی که فرستادی.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile
              icon={<MousePointerClickIcon className="size-4" />}
              label="کلیک"
              value={stats.clicks}
            />
            <StatTile
              icon={<UsersIcon className="size-4" />}
              label="ثبت‌نام"
              value={stats.signups}
            />
            <StatTile
              icon={<TrendingUpIcon className="size-4" />}
              label="پرو شد"
              value={stats.conversions}
              tone="violet"
            />
            <StatTile
              icon={<GiftIcon className="size-4" />}
              label="ماه آماده"
              value={stats.monthsAvailable}
              tone="emerald"
            />
          </div>

          {/* Cap progress */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-zinc-700">موجودی اعتبار</p>
              <p className="text-xs text-zinc-500">
                <span dir="ltr" className="font-bold text-zinc-800">
                  {toPersianDigits(stats.monthsEarned)}
                </span>{" "}
                از{" "}
                <span dir="ltr" className="font-bold text-zinc-800">
                  {toPersianDigits(stats.cap)}
                </span>{" "}
                ماه
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-violet-500 transition-[width]"
                style={{ width: `${capPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              مصرف‌شده:{" "}
              <span dir="ltr" className="font-semibold text-zinc-700">
                {toPersianDigits(stats.monthsRedeemed)}
              </span>{" "}
              ماه • قابل اعمال:{" "}
              <span dir="ltr" className="font-semibold text-emerald-700">
                {toPersianDigits(stats.monthsAvailable)}
              </span>{" "}
              ماه
            </p>
          </div>

          {milestone ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-6 text-amber-900">
              <PartyPopperIcon className="size-4 shrink-0" />
              <span>{milestone}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. Social wall */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            کسانی که با لینک تو وارد کی‌یو‌آر شدن
          </CardTitle>
          <p className="mt-1 text-xs text-zinc-500">
            ۲۰ نفر آخر — اونایی که پرو شدن با حاشیه‌ی بنفش مشخصن.
          </p>
        </CardHeader>
        <CardContent className="px-0">
          <ReferralFeed rows={feedToClient(stats.recentReferrals)} />
        </CardContent>
      </Card>

      {/* 4. Redemption */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <CardTitle className="text-base">
                اعمال یک ماه روی صفحه‌ت
              </CardTitle>
              <p className="text-xs text-zinc-500">
                هر بار یه ماه پرو رو روی هر صفحه‌ای که خواستی فعال کن. صفحه‌های
                رایگان نیاز به ارتقا دارن.
              </p>
            </div>
            <div className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              {toPersianDigits(stats.monthsAvailable)} ماه آماده
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {redeemPages.length === 0 ? (
            <p className="rounded-xl bg-zinc-50 p-4 text-center text-xs text-zinc-500">
              هنوز صفحه‌ای ندارید.
            </p>
          ) : stats.monthsAvailable < 1 ? (
            <EmptyAvailable />
          ) : (
            <RedeemGrid pages={redeemPages} available={stats.monthsAvailable} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "violet" | "emerald";
}) {
  const toneCls =
    tone === "violet"
      ? "border-violet-200 bg-violet-50/60 text-violet-700"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
        : "border-zinc-200 bg-white text-zinc-500";
  const valCls =
    tone === "violet"
      ? "text-violet-900"
      : tone === "emerald"
        ? "text-emerald-900"
        : "text-zinc-950";
  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneCls}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>
        {toPersianDigits(value)}
      </div>
    </div>
  );
}

function EmptyAvailable() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/60 p-5 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-violet-600 ring-1 ring-violet-200">
        <GiftIcon className="size-6" />
      </div>
      <p className="mt-3 text-sm font-bold text-zinc-900">هنوز اعتباری نداری</p>
      <p className="mt-1 text-xs leading-6 text-zinc-500">
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
  return rows.map((r) => ({
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
