/**
 * `/affiliate/dashboard/payouts` — request payout + history.
 */
import { eq } from "drizzle-orm";

import {
  getAffiliateBalance,
  getAffiliatePayoutHistory,
  getAffiliateSettings,
} from "@/lib/affiliate";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { affiliateProfiles } from "@/db/schema";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { formatShamsiDate } from "@/lib/date/persian";
import { PayoutRequestForm } from "@/app/affiliate/dashboard/payouts/payout-request-form";

type SearchParams = Promise<{ success?: string }>;

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const successAmount = params.success ? Number(params.success) : null;

  const viewer = await requireUser();
  const db = getDb();

  const [balance, settings, profile, history] = await Promise.all([
    getAffiliateBalance(viewer.user.id),
    getAffiliateSettings(),
    db.query.affiliateProfiles.findFirst({
      where: eq(affiliateProfiles.userId, viewer.user.id),
    }),
    getAffiliatePayoutHistory(viewer.user.id),
  ]);

  const eligible = balance.availableToman >= settings.minWithdrawalToman;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercaser text-violet-700">
          تسویه
        </p>
        <h1 className="mt-1 text-[clamp(22px,3.5vw,30px)] font-semibold">
          درآمدت رو به شبا واریز کن
        </h1>
      </div>

      {successAmount && successAmount > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-[13px] leading-7 text-emerald-900">
          درخواست تسویه برای{" "}
          <span className="font-mono font-bold" dir="ltr">
            {formatPersianNumber(successAmount)}
          </span>{" "}
          تومان ثبت شد. ظرف ۲ تا ۵ روز کاری به شبات واریز می‌شه و کد رهگیری برات
          پیامک می‌آد.
        </div>
      ) : null}

      {/* Balance + form */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr] lg:gap-6">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-6">
          <p className="text-[12px] font-medium text-emerald-900">
            موجودی قابل برداشت
          </p>
          <p
            className="mt-2 font-mono text-[36px] font-bold leading-tight text-emerald-900"
            dir="ltr"
          >
            {formatPersianNumber(balance.availableToman)}
          </p>
          <p className="text-[12px] text-emerald-900/80">تومان</p>

          <div className="mt-5 space-y-2 text-[12px] leading-6 text-emerald-900/90">
            <p>
              حداقل تسویه:{" "}
              <span className="font-mono font-bold" dir="ltr">
                {formatPersianNumber(settings.minWithdrawalToman)}
              </span>{" "}
              تومان
            </p>
            <p>
              دوره‌ی نگه‌داری: {toPersianDigits(settings.holdingPeriodDays)} روز
              از تاریخ پرداخت
            </p>
          </div>

          {!eligible ? (
            <p className="mt-5 rounded-xl bg-white px-4 py-3 text-[12px] leading-6 text-ink-soft ring-1 ring-emerald-200">
              برای درخواست تسویه به حداقل{" "}
              <span className="font-mono font-bold text-ink" dir="ltr">
                {formatPersianNumber(settings.minWithdrawalToman)}
              </span>{" "}
              تومان موجودی قابل برداشت نیاز داری.
            </p>
          ) : null}
        </div>

        <div className="rounded-3xl border border-hairline bg-paper p-6">
          <h2 className="text-[15px] font-bold">
            درخواست تسویه
          </h2>
          <p className="mt-1 text-[12px] leading-6 text-ink-soft">
            اطلاعات بانکی برای واریز.
          </p>
          <div className="mt-5">
            <PayoutRequestForm
              eligible={eligible}
              defaults={{
                sheba: profile?.shebaNumber ?? "",
                holderName: profile?.accountHolderName ?? "",
                nationalId: profile?.nationalId ?? "",
              }}
            />
          </div>
        </div>
      </section>

      {/* History */}
      <section>
        <h2 className="mb-3 text-[16px] font-semibold">
          تاریخچه‌ی تسویه‌ها
        </h2>

        {history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-hairline bg-paper-soft p-8 text-center">
            <p className="text-[14px] text-ink-soft">
              هنوز درخواست تسویه‌ای ثبت نشده.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-hairline bg-paper">
            {history.map((row, i) => (
              <div
                key={row.id}
                className={`px-5 py-4 ${
                  i > 0 ? "border-t border-hairline" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p
                      className="font-mono text-[15px] font-bold text-ink"
                      dir="ltr"
                    >
                      {formatPersianNumber(row.amountToman)} ت
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      ثبت: {formatShamsiDate(row.createdAt)}
                    </p>
                  </div>
                  <PayoutStatusPill status={row.status} />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2">
                  <KV k="شبا" v={row.shebaSnapshot} mono />
                  <KV k="صاحب حساب" v={row.holderNameSnapshot} />
                  {row.transactionRef ? (
                    <KV k="کد پیگیری" v={row.transactionRef} mono />
                  ) : null}
                  {row.paidAt ? (
                    <KV k="تاریخ واریز" v={formatShamsiDate(row.paidAt)} />
                  ) : null}
                </div>

                {row.rejectedReason ? (
                  <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12px] leading-6 text-rose-900">
                    دلیل رد: {row.rejectedReason}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PayoutStatusPill({
  status,
}: {
  status: "requested" | "processing" | "paid" | "rejected";
}) {
  const map: Record<string, { label: string; cls: string }> = {
    requested: {
      label: "ارسال‌شده",
      cls: "bg-violet-50 text-violet-800 ring-violet-200",
    },
    processing: {
      label: "در حال پردازش",
      cls: "bg-amber-50 text-amber-800 ring-amber-200",
    },
    paid: {
      label: "پرداخت‌شده",
      cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    },
    rejected: {
      label: "رد شده",
      cls: "bg-rose-50 text-rose-800 ring-rose-200",
    },
  };
  const m = map[status];
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercaser text-ink-soft">{k}</p>
      <p
        className={`text-[13px] text-ink ${mono ? "font-mono font-bold" : "font-medium"}`}
        dir={mono ? "ltr" : undefined}
      >
        {v}
      </p>
    </div>
  );
}
