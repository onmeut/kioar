/**
 * `/admin/affiliates/ledger` — cross-affiliate commission ledger.
 *
 * One row per referral that ever earned commission. Filter by status
 * via query string. Used for reconciliation and spotting anomalies.
 */
import type { Route } from "next";
import Link from "next/link";

import { listAdminLedger } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatShamsiDateTime } from "@/lib/date/persian";
import { AdminAffiliatesNav } from "@/app/admin/affiliates/_components/nav";

const FILTERS: { key: string; label: string; status?: string }[] = [
  { key: "all", label: "همه" },
  { key: "pending", label: "در انتظار", status: "pending" },
  { key: "available", label: "قابل برداشت", status: "available" },
  { key: "requested", label: "در حال تسویه", status: "requested" },
  { key: "paid", label: "پرداخت‌شده", status: "paid" },
  { key: "rejected", label: "رد شده", status: "rejected" },
  { key: "flagged", label: "در بررسی", status: "flagged" },
];

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  pending: { label: "در انتظار", cls: "bg-amber-500/15 text-amber-700" },
  available: {
    label: "قابل برداشت",
    cls: "bg-emerald-500/15 text-emerald-700",
  },
  requested: {
    label: "در حال تسویه",
    cls: "bg-violet-500/15 text-violet-700",
  },
  paid: { label: "پرداخت‌شده", cls: "bg-sky-500/15 text-sky-700" },
  rejected: { label: "رد شده", cls: "bg-rose-500/15 text-rose-700" },
  flagged: { label: "در بررسی", cls: "bg-zinc-500/15 text-zinc-700" },
};

type SearchParams = Promise<{ status?: string; affiliate?: string }>;

export default async function AdminAffiliateLedgerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filterKey = params.status ?? "all";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const status = filter.status as
    | "pending"
    | "available"
    | "requested"
    | "paid"
    | "rejected"
    | "flagged"
    | undefined;
  const affiliateUserId =
    typeof params.affiliate === "string" && params.affiliate.length > 0
      ? params.affiliate
      : undefined;

  const rows = await listAdminLedger({
    status,
    affiliateUserId,
    limit: 500,
  });

  const total = rows.reduce((s, r) => s + (r.commissionToman ?? 0), 0);

  return (
    <section className="section-shell space-y-5 py-6">
      <AdminAffiliatesNav />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.key !== "all") params.set("status", f.key);
          if (affiliateUserId) params.set("affiliate", affiliateUserId);
          const qs = params.toString();
          return (
            <Link
              key={f.key}
              href={
                (qs
                  ? `/admin/affiliates/ledger?${qs}`
                  : "/admin/affiliates/ledger") as Route
              }
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                f.key === filterKey
                  ? "bg-foreground text-background"
                  : "bg-muted text-foreground hover:bg-muted/70"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
        <span className="ms-auto text-[12px] text-muted-foreground">
          {toPersianDigits(rows.length)} مورد —{" "}
          <span className="font-mono font-bold" dir="ltr">
            {formatPersianNumber(total)}
          </span>{" "}
          ت
        </span>
      </div>

      {affiliateUserId ? (
        <div className="rounded-2xl border border-border bg-muted px-3 py-2 text-[12px]">
          فیلتر شده برای همکار:{" "}
          <span className="font-mono" dir="ltr">
            {affiliateUserId.slice(0, 8)}…
          </span>
          <Link
            href={"/admin/affiliates/ledger" as Route}
            className="ms-2 text-violet-700 hover:underline"
          >
            حذف فیلتر
          </Link>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background py-10 text-center text-muted-foreground">
          هیچ ردیف پورسانتی در این فیلتر پیدا نشد.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((r) => {
              const v = r.commissionStatus
                ? STATUS_VARIANT[r.commissionStatus]
                : null;
              return (
                <div
                  key={r.id}
                  className="rounded-2xl border border-border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/admin/affiliates/${r.affiliateUserId}` as Route}
                      className="min-w-0 hover:underline"
                    >
                      <p className="truncate text-[13px] font-bold">
                        {r.affiliateName}
                      </p>
                      <p
                        className="font-mono text-[11px] text-muted-foreground"
                        dir="ltr"
                      >
                        {formatPhoneDisplay(r.affiliatePhone)}
                      </p>
                    </Link>
                    {v ? (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${v.cls}`}
                      >
                        {v.label}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">پورسانت</p>
                      <p className="font-mono font-bold" dir="ltr">
                        {formatPersianNumber(r.commissionToman ?? 0)} ت
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">چرخه</p>
                      <p className="font-bold">
                        {r.billingCycle === "annual"
                          ? "سالانه"
                          : r.billingCycle === "monthly"
                            ? "ماهانه"
                            : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">رفری</p>
                      <p className="font-mono" dir="ltr">
                        {r.refereeMaskedPhone}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">تاریخ</p>
                      <p>
                        {r.rewardedAt
                          ? formatShamsiDateTime(r.rewardedAt)
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-border bg-background lg:block">
            <table className="w-full text-end text-[13px]">
              <thead className="bg-muted text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">همکار</th>
                  <th className="px-3 py-2">رفری</th>
                  <th className="px-3 py-2">چرخه</th>
                  <th className="px-3 py-2">خالص فاکتور</th>
                  <th className="px-3 py-2">پورسانت</th>
                  <th className="px-3 py-2">وضعیت</th>
                  <th className="px-3 py-2">باز شدن</th>
                  <th className="px-3 py-2">پرداخت</th>
                  <th className="px-3 py-2">تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const v = r.commissionStatus
                    ? STATUS_VARIANT[r.commissionStatus]
                    : null;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link
                          href={
                            `/admin/affiliates/${r.affiliateUserId}` as Route
                          }
                          className="font-bold hover:underline"
                        >
                          {r.affiliateName}
                        </Link>
                        <p
                          className="font-mono text-[11px] text-muted-foreground"
                          dir="ltr"
                        >
                          {formatPhoneDisplay(r.affiliatePhone)}
                        </p>
                      </td>
                      <td className="px-3 py-2 font-mono" dir="ltr">
                        {r.refereeMaskedPhone}
                      </td>
                      <td className="px-3 py-2">
                        {r.billingCycle === "annual"
                          ? "سالانه"
                          : r.billingCycle === "monthly"
                            ? "ماهانه"
                            : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono" dir="ltr">
                        {r.netAmountToman != null
                          ? formatPersianNumber(r.netAmountToman)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold" dir="ltr">
                        {formatPersianNumber(r.commissionToman ?? 0)}
                      </td>
                      <td className="px-3 py-2">
                        {v ? (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${v.cls}`}
                          >
                            {v.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {r.unlockAt ? formatShamsiDateTime(r.unlockAt) : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]" dir="ltr">
                        {r.payoutId ? r.payoutId.slice(0, 8) + "…" : "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {r.rewardedAt
                          ? formatShamsiDateTime(r.rewardedAt)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
