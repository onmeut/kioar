/**
 * `/admin/affiliates` — overview tiles + sub-nav.
 */
import type { Route } from "next";
import Link from "next/link";

import {
  ClipboardListIcon,
  CoinsIcon,
  HandshakeIcon,
  SettingsIcon,
  WalletIcon,
} from "lucide-react";

import {
  listAdminAffiliates,
  listAdminApplications,
  listAdminPayouts,
} from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { AdminAffiliatesNav } from "@/app/admin/affiliates/_components/nav";

export default async function AdminAffiliatesOverview() {
  await requireAdmin();
  const [pendingApps, affiliates, requestedPayouts] = await Promise.all([
    listAdminApplications({ status: "pending", limit: 200 }),
    listAdminAffiliates(),
    listAdminPayouts({ status: "requested", limit: 200 }),
  ]);

  const totalPending = affiliates.reduce((s, a) => s + a.pendingToman, 0);
  const totalAvailable = affiliates.reduce((s, a) => s + a.availableToman, 0);
  const totalPaid = affiliates.reduce((s, a) => s + a.paidToman, 0);
  const totalRequestedAmount = requestedPayouts.reduce(
    (s, p) => s + p.amountToman,
    0,
  );

  return (
    <section className="section-shell space-y-6 py-6">
      <AdminAffiliatesNav />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={ClipboardListIcon}
          label="درخواست‌های جدید"
          value={toPersianDigits(pendingApps.length)}
          href="/admin/affiliates/applications"
          highlight={pendingApps.length > 0}
        />
        <Tile
          icon={HandshakeIcon}
          label="همکاران فعال"
          value={toPersianDigits(
            affiliates.filter((a) => a.affiliateStatus === "active").length,
          )}
          href="/admin/affiliates/list"
        />
        <Tile
          icon={WalletIcon}
          label="درخواست‌های تسویه"
          value={toPersianDigits(requestedPayouts.length)}
          href="/admin/affiliates/payouts"
          highlight={requestedPayouts.length > 0}
        />
        <Tile
          icon={CoinsIcon}
          label="مجموع پرداخت‌شده"
          value={`${formatPersianNumber(totalPaid)} ت`}
          href="/admin/affiliates/payouts?status=paid"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Stat label="در انتظار آزادسازی" toman={totalPending} />
        <Stat label="قابل برداشت کل" toman={totalAvailable} />
        <Stat label="در صف تسویه" toman={totalRequestedAmount} tone="warning" />
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink
          href="/admin/affiliates/applications"
          icon={ClipboardListIcon}
          title="بررسی درخواست‌های همکاری"
          body="تأیید، رد یا درخواست اطلاعات بیشتر."
        />
        <QuickLink
          href="/admin/affiliates/payouts"
          icon={WalletIcon}
          title="مدیریت تسویه‌ها"
          body="کپی شبا، علامت‌گذاری به‌عنوان واریزی."
        />
        <QuickLink
          href="/admin/affiliates/settings"
          icon={SettingsIcon}
          title="تنظیمات کلی"
          body="درصد پورسانت، حداقل تسویه، دوره‌ی نگه‌داری."
        />
      </div>
    </section>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className={`block rounded-2xl border p-4 transition hover:border-foreground/40 ${
        highlight
          ? "border-amber-300 bg-amber-50/60"
          : "border-border bg-background"
      }`}
    >
      <div
        className={`flex size-9 items-center justify-center rounded-xl ${
          highlight
            ? "bg-amber-100 text-amber-700"
            : "bg-violet-100 text-violet-700"
        }`}
      >
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-[11px] font-medium uppercaser text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-bold">{value}</p>
    </Link>
  );
}

function Stat({
  label,
  toman,
  tone,
}: {
  label: string;
  toman: number;
  tone?: "warning";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50/40"
          : "border-border bg-background"
      }`}
    >
      <p className="text-[11px] font-medium uppercaser text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-[20px] font-bold leading-tight"
        dir="ltr"
      >
        {formatPersianNumber(toman)}
      </p>
      <p className="text-[11px] text-muted-foreground">تومان</p>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  body,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href as Route}
      className="flex gap-3 rounded-2xl border border-border bg-background p-4 transition hover:border-foreground/40"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold">{title}</p>
        <p className="mt-0.5 text-[12px] leading-6 text-muted-foreground">
          {body}
        </p>
      </div>
    </Link>
  );
}
