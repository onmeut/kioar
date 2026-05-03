/**
 * Phase 12 — billing hub page for a specific page.
 *
 * Replaces the Phase 8 scaffold + Phase 9 inline plan-change UI with a
 * focused hub:
 *
 *   - Header card: current plan + status badge + period boundary.
 *   - Trial CTAs (one row per eligible trial).
 *   - 4 nav buttons → `plans` / `invoices` / `discount` / `cancel`.
 *
 * The plan picker now lives at `./billing/plans` (registry + comparison
 * table). Discount input at `./billing/discount`. Invoices at
 * `./billing/invoices`. Cancel confirmation at `./billing/cancel`.
 *
 * Pricing is read from the `plans` registry; no hardcoded tomans here.
 */
import Link from "next/link";
import type { Route } from "next";
import { eq } from "drizzle-orm";
import {
  ChevronLeftIcon,
  CreditCardIcon,
  FileTextIcon,
  TagIcon,
  XCircleIcon,
} from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

  const periodEndDate = sub.trialEndsAt ?? sub.currentPeriodEnd;
  const periodEndLabel = periodEndDate
    ? formatPersianDate(new Date(periodEndDate))
    : null;

  const isPaid = sub.plan.key === "pro" || sub.plan.key === "business";
  const cyclePrice =
    sub.billingCycle === "annual"
      ? sub.plan.priceAnnualToman
      : sub.plan.priceMonthlyToman;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:py-10">
      <header className="space-y-1">
        <p className="text-xs font-medium text-zinc-500">صورت‌حساب صفحه</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {displayName}
        </h1>
        <p className="text-xs text-zinc-500" dir="ltr">
          {shareHost}
        </p>
      </header>

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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">پلن فعلی</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              مدیریت اشتراک، فاکتورها و کد تخفیف از اینجا انجام می‌شود.
            </p>
          </div>
          <Badge variant="outline" className={STATUS_TONE[sub.status]}>
            {STATUS_LABELS[sub.status] ?? sub.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xl font-bold tracking-tight">
                {sub.plan.nameFa}
              </p>
              {isPaid ? (
                <p className="text-[12px] text-zinc-500">
                  {formatToman(cyclePrice)} تومان{" "}
                  {sub.billingCycle === "annual" ? "در سال" : "در ماه"}
                </p>
              ) : (
                <p className="text-[12px] text-zinc-500">
                  پلن رایگان — برای همیشه
                </p>
              )}
            </div>
            {periodEndLabel ? (
              <div className="text-end text-[12px]">
                <p className="text-zinc-500">
                  {sub.status === "trialing"
                    ? "پایان آزمایش"
                    : sub.status === "grace"
                      ? "پایان مهلت پرداخت"
                      : "پایان دوره"}
                </p>
                <p dir="ltr" className="font-semibold text-zinc-700">
                  {periodEndLabel}
                </p>
              </div>
            ) : null}
          </div>

          {(sub.cancelAtPeriodEnd || sub.pendingPlanChangePlanId) &&
          periodEndLabel ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {sub.cancelAtPeriodEnd ? (
                <p>
                  اشتراک شما در{" "}
                  <span dir="ltr" className="font-semibold">
                    {periodEndLabel}
                  </span>{" "}
                  لغو خواهد شد.
                </p>
              ) : null}
              {sub.pendingPlanChangePlanId && sub.pendingPlanChange ? (
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

          <Separator />

          <div className="grid gap-2 sm:grid-cols-2">
            <BillingNavButton
              href={`/dashboard/pages/${pageId}/billing/plans` as Route}
              icon={<CreditCardIcon className="size-4" />}
              label="مدیریت اشتراک و پلن‌ها"
              primary
            />
            <BillingNavButton
              href={`/dashboard/pages/${pageId}/billing/invoices` as Route}
              icon={<FileTextIcon className="size-4" />}
              label="فاکتورها"
            />
            <BillingNavButton
              href={`/dashboard/pages/${pageId}/billing/discount` as Route}
              icon={<TagIcon className="size-4" />}
              label="کد تخفیف"
            />
            {isPaid ? (
              <BillingNavButton
                href={`/dashboard/pages/${pageId}/billing/cancel` as Route}
                icon={<XCircleIcon className="size-4" />}
                label="لغو اشتراک"
                tone="danger"
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {eligibleTrials.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">آزمایش رایگان</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              قبل از پرداخت، امکانات هر پلن را به‌صورت رایگان روی این صفحه تجربه
              کنید.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {eligibleTrials.map((option, idx) => (
              <div key={option.id}>
                {idx > 0 ? <Separator className="my-3" /> : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{option.nameFa}</p>
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                      >
                        {toPersianDigits(option.trialDays)} روز رایگان
                      </Badge>
                    </div>
                    {option.descriptionFa ? (
                      <p className="text-xs text-zinc-500">
                        {option.descriptionFa}
                      </p>
                    ) : null}
                    <p className="text-xs text-zinc-500">
                      پس از آزمایش: {formatToman(option.priceMonthlyToman)}{" "}
                      تومان در ماه
                    </p>
                  </div>
                  <Button
                    render={
                      <Link
                        href={`/dashboard/pages/${pageId}/trial` as Route}
                      />
                    }
                    className="h-11 sm:w-auto"
                  >
                    شروع آزمایش رایگان
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
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
  tone = "neutral",
}: {
  href: Route;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  tone?: "neutral" | "danger";
}) {
  return (
    <Link
      href={href}
      className={
        "flex h-12 items-center justify-between rounded-xl border px-4 text-sm font-medium transition-colors " +
        (primary
          ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
          : tone === "danger"
            ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50")
      }
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ChevronLeftIcon className="size-4 opacity-60" />
    </Link>
  );
}
