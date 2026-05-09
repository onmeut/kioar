/**
 * `/affiliate/dashboard` — overview page.
 *
 * Hero with the affiliate's unique link + copy/share, then a stat strip
 * (clicks / signups / conversions / earned), then a slim ledger preview
 * with a CTA to the full earnings page.
 */
import Link from "next/link";

import {
  CoinsIcon,
  MousePointerClickIcon,
  PartyPopperIcon,
  TimerIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { CopyableLink } from "@/app/affiliate/dashboard/copyable-link";
import {
  getAffiliateBalance,
  getAffiliateStateForUser,
  listAffiliateLedger,
} from "@/lib/affiliate";
import { requireUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/site";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { formatShamsiDate } from "@/lib/date/persian";

export default async function AffiliateDashboardOverview() {
  const viewer = await requireUser();
  const state = await getAffiliateStateForUser(viewer.user.id);
  // Layout already gates this — but TS narrowing needs the check.
  if (state.kind !== "approved") return null;

  const [balance, ledger] = await Promise.all([
    getAffiliateBalance(viewer.user.id),
    listAffiliateLedger(viewer.user.id, 5),
  ]);

  const link = absoluteUrl(`/r/${state.code}`);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="rounded-3xl border border-hairline bg-paper-soft p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercaser text-violet-700">
          لینک اختصاصی شما
        </p>
        <h1 className="mt-2 text-[clamp(22px,3.5vw,32px)] font-semibold leading-[1.15]">
          هرجا که می‌تونی به اشتراکش بذار
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-7 text-ink-soft">
          هر کلیک به این لینک ثبت می‌شه. هر کسی که از این لینک خرید سالانه‌ی پرو
          کنه، {toPersianDigits(30)}٪ سهم تو می‌شه و ۳ ماه پروی هدیه برای خودش.
        </p>

        <div className="mt-5">
          <CopyableLink href={link} />
        </div>
      </section>

      {/* Stat strip */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={MousePointerClickIcon}
            label="کلیک"
            value={toPersianDigits(balance.clicks)}
            tone="violet"
          />
          <Stat
            icon={UsersIcon}
            label="ثبت‌نام"
            value={toPersianDigits(balance.signups)}
            tone="sky"
          />
          <Stat
            icon={PartyPopperIcon}
            label="فروش سالانه"
            value={toPersianDigits(balance.yearlyConversions)}
            tone="emerald"
          />
          <Stat
            icon={CoinsIcon}
            label="درآمد کل"
            value={`${formatPersianNumber(balance.totalEarnedToman)} ت`}
            tone="amber"
          />
        </div>
      </section>

      {/* Balance card */}
      <section className="grid gap-4 sm:grid-cols-3">
        <BalanceCard
          title="در انتظار آزادسازی"
          subtitle="بعد از ۳۰ روز قابل برداشت می‌شن"
          toman={balance.pendingToman}
          icon={TimerIcon}
          tone="amber"
        />
        <BalanceCard
          title="قابل برداشت"
          subtitle="هر زمان می‌تونی درخواست تسویه بدی"
          toman={balance.availableToman}
          icon={WalletIcon}
          tone="emerald"
          highlight
        />
        <BalanceCard
          title="در حال تسویه"
          subtitle="درخواست‌های ارسال‌شده در صف پرداخت"
          toman={balance.requestedToman}
          icon={CoinsIcon}
          tone="violet"
        />
      </section>

      <div className="flex justify-center">
        <Link
          href="/affiliate/dashboard/payouts"
          className="rounded-full bg-ink px-6 py-3 text-[14px] font-bold text-paper hover:bg-ink/90"
        >
          درخواست تسویه
        </Link>
      </div>

      {/* Recent ledger */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">
            آخرین فروش‌ها
          </h2>
          <Link
            href="/affiliate/dashboard/earnings"
            className="text-[12px] font-bold text-violet-700 hover:underline"
          >
            دیدن همه ←
          </Link>
        </div>

        {ledger.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-hairline bg-paper-soft p-8 text-center">
            <p className="text-[14px] text-ink-soft">
              هنوز فروشی ثبت نشده. لینکت رو پخش کن.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-hairline bg-paper">
            {ledger.map((row, i) => (
              <div
                key={row.id}
                className={`flex items-center justify-between gap-3 px-5 py-4 ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-ink" dir="ltr">
                    {row.refereeMaskedHandle}
                  </p>
                  <p className="text-[11px] text-ink-soft">
                    {row.rewardedAt ? formatShamsiDate(row.rewardedAt) : "—"}
                    {" · "}
                    {row.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                  </p>
                </div>
                <div className="text-end">
                  <p
                    className="font-mono text-[14px] font-bold text-ink"
                    dir="ltr"
                  >
                    {row.commissionToman
                      ? `+${formatPersianNumber(row.commissionToman)}`
                      : "—"}
                  </p>
                  <LedgerStatusPill status={row.commissionStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "violet" | "sky" | "emerald" | "amber";
}) {
  const toneRing: Record<string, string> = {
    violet: "bg-violet-100 text-violet-700",
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-4">
      <div
        className={`flex size-9 items-center justify-center rounded-xl ${toneRing[tone]}`}
      >
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-[11px] font-medium uppercaser text-ink-soft">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-bold leading-tight text-ink">
        {value}
      </p>
    </div>
  );
}

function BalanceCard({
  title,
  subtitle,
  toman,
  icon: Icon,
  tone,
  highlight,
}: {
  title: string;
  subtitle: string;
  toman: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "violet" | "emerald" | "amber";
  highlight?: boolean;
}) {
  const toneRing: Record<string, string> = {
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div
      className={`rounded-3xl border p-5 ${
        highlight
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-hairline bg-paper-soft"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex size-10 items-center justify-center rounded-2xl ${toneRing[tone]}`}
        >
          <Icon className="size-5" />
        </div>
        <p className="text-[13px] font-bold text-ink">{title}</p>
      </div>
      <p
        className="mt-4 font-mono text-[24px] font-bold leading-tight text-ink"
        dir="ltr"
      >
        {formatPersianNumber(toman)}
      </p>
      <p className="text-[11px] text-ink-soft">تومان</p>
      <p className="mt-2 text-[11px] leading-6 text-ink-soft">{subtitle}</p>
    </div>
  );
}

function LedgerStatusPill({
  status,
}: {
  status:
    | "pending"
    | "available"
    | "requested"
    | "paid"
    | "rejected"
    | "flagged"
    | null;
}) {
  if (!status) return null;
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "در انتظار",
      cls: "bg-amber-50 text-amber-800 ring-amber-200",
    },
    available: {
      label: "قابل برداشت",
      cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    },
    requested: {
      label: "در حال تسویه",
      cls: "bg-violet-50 text-violet-800 ring-violet-200",
    },
    paid: { label: "پرداخت‌شده", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
    rejected: {
      label: "رد شده",
      cls: "bg-rose-50 text-rose-800 ring-rose-200",
    },
    flagged: {
      label: "در بررسی",
      cls: "bg-zinc-50 text-zinc-800 ring-zinc-200",
    },
  };
  const m = map[status];
  return (
    <span
      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
