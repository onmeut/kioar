/**
 * Phase 12 — billing hub page for a specific page.
 *
 * Slim hub: identity + period info + quick nav. Plan picker /
 * comparison / code redemption all live on `/pro` now (one canonical
 * upgrade surface), so this page no longer duplicates them.
 *
 * Surfaces:
 *   - Page identity card (avatar + name + share host + plan badge).
 *   - Status banners (success / failed / cancelled callbacks +
 *     pending plan change / cancel-at-period-end).
 *   - Trial CTAs (one row per eligible trial → /trial).
 *   - Quick nav: مدیریت اشتراک و پلن‌ها (→ /pro) · فاکتورها · لغو اشتراک.
 */
import Link from "next/link";
import type { Route } from "next";
import { eq } from "drizzle-orm";
import { ChevronLeftIcon, CreditCardIcon, FileTextIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { KioarAvatar } from "@/components/shared/kioar-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { pageSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getOwnedPageById } from "@/lib/pages";
import {
  formatPersianDate,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";
import {
  DEFAULT_PROFILE_DOMAIN,
  profileShareHost,
} from "@/lib/profile-domains";
import { getTrialEligibility } from "@/lib/trial";

export const metadata = {
  title: "صورت‌حساب صفحه",
};

type Params = Promise<{ pageId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_LABELS: Record<string, string> = {
  active: "فعال",
  trialing: "در حال آزمایش",
  pending_renewal: "در انتظار تمدید",
  grace: "مهلت پرداخت",
  expired: "منقضی شده",
  canceled: "لغو شده",
};

const STATUS_TONE: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  trialing: "border-blue-200 bg-blue-50 text-blue-700",
  pending_renewal: "border-amber-200 bg-amber-50 text-amber-800",
  grace: "border-amber-200 bg-amber-50 text-amber-800",
  expired: "border-zinc-200 bg-zinc-50 text-zinc-600",
  canceled: "border-zinc-200 bg-zinc-50 text-zinc-600",
};

const PLAN_BADGE: Record<
  "free" | "pro" | "business",
  { label: string; className: string }
> = {
  free: {
    label: "رایگان",
    className: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
  pro: {
    label: "حرفه‌ای",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  business: {
    label: "کسب‌وکار",
    className: "border-purple-200 bg-purple-50 text-purple-700",
  },
};

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

function persianizeNumber(invoiceNumber: string) {
  return invoiceNumber.replace(/[0-9]+/g, (m) => toPersianDigits(m));
}

export default async function PageBillingRoute({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { pageId } = await params;
  const sp = await searchParams;
  const viewer = await requireUser();
  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) notFound();

  const eligibility = await getTrialEligibility(pageId);
  if (!eligibility) notFound();

  const db = getDb();
  const sub = await db.query.pageSubscriptions.findFirst({
    where: eq(pageSubscriptions.pageId, pageId),
    with: { plan: true, pendingPlanChange: true },
  });
  if (!sub) notFound();

  const displayName =
    page.fullName?.trim() || page.title?.trim() || `/${page.slug}`;
  const shareHost = profileShareHost(
    page.slug,
    page.domain ?? DEFAULT_PROFILE_DOMAIN,
  );

  const eligibleTrials = eligibility.options.filter((o) => o.eligible);

  const paidParam = typeof sp.paid === "string" ? sp.paid : null;
  const billingParam = typeof sp.billing === "string" ? sp.billing : null;

  // ── Effective subscription state ──────────────────────────────────────────
  // The billing cron may lag (especially in dev/staging), leaving a row in
  // status="trialing" after trial_ends_at has passed. Compute the effective
  // state to avoid showing stale badge/plan info.
  const now = new Date();
  const isActivelyTrialing =
    sub.status === "trialing" &&
    sub.trialEndsAt != null &&
    sub.trialEndsAt > now;
  const isEffectivelyFree =
    sub.status === "expired" ||
    sub.status === "canceled" ||
    (sub.status === "trialing" && !isActivelyTrialing);

  const effectivePlanKey: "free" | "pro" | "business" = isEffectivelyFree
    ? "free"
    : (sub.plan.key as "free" | "pro" | "business");
  const effectiveStatus: typeof sub.status =
    isEffectivelyFree && sub.status === "trialing" ? "expired" : sub.status;

  const periodEndDate = isActivelyTrialing
    ? sub.trialEndsAt
    : sub.currentPeriodEnd;
  const periodEndLabel = periodEndDate
    ? formatPersianDate(new Date(periodEndDate))
    : null;

  const planKey = effectivePlanKey;
  const isPaid = planKey === "pro" || planKey === "business";
  const cyclePrice = isPaid
    ? sub.billingCycle === "annual"
      ? sub.plan.priceAnnualToman
      : sub.plan.priceMonthlyToman
    : 0;
  const planBadge = PLAN_BADGE[planKey];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:py-10">
      {/* Header — page identity, mirroring /pro page's "صفحه‌ی در حال
          ارتقا" panel. */}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar className="size-14 ring-2 ring-background [&_svg]:size-full!">
              {page.avatarUrl ? (
                <AvatarImage src={page.avatarUrl} alt={displayName} />
              ) : (
                <AvatarFallback className="bg-transparent p-0">
                  <KioarAvatar seed={page.avatarSeed} size={56} />
                </AvatarFallback>
              )}
            </Avatar>
            <Badge
              variant="outline"
              className={
                "absolute -bottom-1 -inset-e-1 h-5 px-1.5 text-[9px] font-bold shadow-sm " +
                planBadge.className
              }
            >
              {planBadge.label}
            </Badge>
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-[10px] font-semibold uppercaser text-zinc-400">
              صورت‌حساب صفحه
            </p>
            <p className="truncate text-base font-bold text-zinc-900 sm:text-lg">
              {displayName}
            </p>
            <p
              dir="ltr"
              className="truncate text-[11px] font-medium text-zinc-500"
            >
              {shareHost}
            </p>
          </div>
        </div>
      </section>

      {/* Callback banners */}
      {paidParam ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          پرداخت با موفقیت ثبت شد. شماره فاکتور:{" "}
          <span dir="ltr" className="font-semibold">
            {persianizeNumber(paidParam)}
          </span>
        </div>
      ) : null}
      {billingParam === "failed" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          پرداخت ناموفق بود. می‌توانید از قسمت فاکتورها دوباره تلاش کنید.
        </div>
      ) : billingParam === "cancelled" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          پرداخت توسط شما لغو شد.
        </div>
      ) : null}

      {/* Current plan summary */}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercaser text-zinc-400">
              پلن فعلی
            </p>
            <p className="text-2xl font-bold text-zinc-900">
              {isEffectivelyFree ? PLAN_BADGE.free.label : sub.plan.nameFa}
            </p>
            <p className="text-xs text-zinc-500">
              {isPaid ? (
                <>
                  <span className="font-semibold text-zinc-900">
                    {formatToman(cyclePrice)} تومان
                  </span>{" "}
                  {sub.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                </>
              ) : (
                "پلن رایگان — برای همیشه"
              )}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge variant="outline" className={STATUS_TONE[effectiveStatus]}>
              {STATUS_LABELS[effectiveStatus] ?? effectiveStatus}
            </Badge>
            {periodEndLabel ? (
              <div className="text-start sm:text-end">
                <p className="text-[10px] uppercaser text-zinc-400">
                  {isActivelyTrialing
                    ? "پایان آزمایش"
                    : effectiveStatus === "grace"
                      ? "پایان مهلت پرداخت"
                      : "پایان دوره"}
                </p>
                <p dir="ltr" className="text-xs font-semibold text-zinc-700">
                  {periodEndLabel}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {sub.pendingPlanChangePlanId && periodEndLabel ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {sub.pendingPlanChange ? (
              <p>
                تغییر پلن به «{sub.pendingPlanChange.nameFa}» در{" "}
                <span dir="ltr" className="font-semibold">
                  {periodEndLabel}
                </span>{" "}
                اعمال خواهد شد.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Quick nav — plan picker / discount code / comparison all live
          on /pro now, so we link there as one entry point. */}
      <section className="space-y-3">
        <BillingNavButton
          href={"/pro" as Route}
          icon={<CreditCardIcon className="size-4" />}
          label="مدیریت اشتراک و پلن‌ها"
          primary
        />
        <BillingNavButton
          href={`/account/billing/${pageId}/invoices` as Route}
          icon={<FileTextIcon className="size-4" />}
          label="فاکتورها"
        />
      </section>

      {/* Trial CTA — only when at least one plan is still trial-eligible
          for this page. */}
      {eligibleTrials.length > 0 ? (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-lg font-bold text-zinc-900 sm:text-xl">
              آزمایش رایگان
            </h2>
            <p className="text-xs leading-6 text-zinc-500 sm:text-sm">
              قبل از پرداخت، امکانات هر پلن را به‌صورت رایگان روی این صفحه تجربه
              کنید.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {eligibleTrials.map((option) => (
              <div
                key={option.id}
                className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200 transition-all hover:ring-zinc-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-zinc-900 sm:text-lg">
                      {option.nameFa}
                    </p>
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                    >
                      {toPersianDigits(option.trialDays)} روز رایگان
                    </Badge>
                  </div>
                  {option.descriptionFa ? (
                    <p className="text-xs leading-6 text-zinc-500 sm:text-[13px]">
                      {option.descriptionFa}
                    </p>
                  ) : null}
                  <p className="text-xs text-zinc-500">
                    پس از آزمایش:{" "}
                    <span className="font-semibold text-zinc-900">
                      {formatToman(option.priceMonthlyToman)} تومان
                    </span>{" "}
                    ماهانه
                  </p>
                </div>
                <Button
                  render={<Link href={"/trial" as Route} />}
                  className="h-12 w-full text-sm font-bold sm:w-auto sm:min-w-32"
                >
                  شروع آزمایش رایگان
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-center text-[11px] text-zinc-400">
        قیمت‌ها از تنظیمات پلن خوانده می‌شود و توسط مدیر قابل تغییر است.
      </p>
    </div>
  );
}

function BillingNavButton({
  href,
  icon,
  label,
  primary = false,
}: {
  href: Route;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        "flex h-14 items-center justify-between rounded-2xl px-5 text-sm font-bold transition-colors " +
        (primary
          ? "bg-zinc-900 text-white hover:bg-zinc-800"
          : "bg-white text-zinc-800 ring-1 ring-zinc-200 hover:ring-zinc-300")
      }
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      <ChevronLeftIcon className="size-4 opacity-60" />
    </Link>
  );
}
