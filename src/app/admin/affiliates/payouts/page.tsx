/**
 * `/admin/affiliates/payouts` — payout queue with copyable Sheba.
 */
import type { Route } from "next";
import Link from "next/link";

import { listAdminPayouts } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatShamsiDateTime } from "@/lib/date/persian";
import { AdminAffiliatesNav } from "@/app/admin/affiliates/_components/nav";
import { PayoutRow } from "@/app/admin/affiliates/payouts/payout-row";

const FILTERS: { key: string; label: string; status?: string }[] = [
  { key: "requested", label: "ارسال‌شده", status: "requested" },
  { key: "processing", label: "در حال پردازش", status: "processing" },
  { key: "paid", label: "پرداخت‌شده", status: "paid" },
  { key: "rejected", label: "رد شده", status: "rejected" },
  { key: "all", label: "همه" },
];

type SearchParams = Promise<{ status?: string }>;

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filterKey = params.status ?? "requested";
  const status = (FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0])
    .status as "requested" | "processing" | "paid" | "rejected" | undefined;

  const payouts = await listAdminPayouts({ status, limit: 200 });
  const totalAmount = payouts.reduce((s, p) => s + p.amountToman, 0);

  return (
    <section className="section-shell space-y-5 py-6">
      <AdminAffiliatesNav />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={
              (f.key === "requested"
                ? "/admin/affiliates/payouts"
                : `/admin/affiliates/payouts?status=${f.key}`) as Route
            }
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
              f.key === filterKey
                ? "bg-foreground text-background"
                : "bg-muted text-foreground hover:bg-muted/70"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="ms-auto text-[12px] text-muted-foreground">
          {toPersianDigits(payouts.length)} مورد —{" "}
          <span className="font-mono font-bold" dir="ltr">
            {formatPersianNumber(totalAmount)}
          </span>{" "}
          ت
        </span>
        <a
          href={
            filterKey === "all"
              ? "/api/admin/affiliates/payouts/export"
              : `/api/admin/affiliates/payouts/export?status=${filterKey}`
          }
          className="rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-bold text-foreground hover:bg-muted"
          download
        >
          دانلود CSV
        </a>
      </div>

      {payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background py-10 text-center text-muted-foreground">
          هیچ تسویه‌ای در این وضعیت وجود نداره.
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-background p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/affiliates/${p.userId}` as Route}
                    className="block"
                  >
                    <p className="text-[14px] font-bold hover:underline">
                      {p.affiliateName}
                    </p>
                    <p
                      className="font-mono text-[11px] text-muted-foreground"
                      dir="ltr"
                    >
                      {formatPhoneDisplay(p.affiliatePhone)}
                    </p>
                  </Link>
                </div>
                <div className="text-end">
                  <p className="font-mono text-[20px] font-bold" dir="ltr">
                    {formatPersianNumber(p.amountToman)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    تومان · {formatShamsiDateTime(p.createdAt)}
                  </p>
                </div>
              </div>

              <PayoutRow
                payout={{
                  id: p.id,
                  status: p.status,
                  sheba: p.shebaSnapshot,
                  holder: p.holderNameSnapshot,
                  nationalId: p.nationalIdSnapshot,
                  ref: p.transactionRef,
                  rejected: p.rejectedReason,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
