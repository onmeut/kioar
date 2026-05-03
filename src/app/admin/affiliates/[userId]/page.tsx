/**
 * `/admin/affiliates/[userId]` — single affiliate detail.
 */
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { getAdminAffiliateDetail } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatShamsiDate, formatShamsiDateTime } from "@/lib/date/persian";
import { AdminAffiliatesNav } from "@/app/admin/affiliates/_components/nav";
import { StatusControl } from "@/app/admin/affiliates/[userId]/status-control";
import { BankingForm } from "@/app/admin/affiliates/[userId]/banking-form";
import { AdminNotesForm } from "@/app/admin/affiliates/[userId]/admin-notes-form";

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  active: { label: "فعال", cls: "bg-emerald-500/15 text-emerald-700" },
  paused: { label: "توقف موقت", cls: "bg-amber-500/15 text-amber-700" },
  banned: { label: "محروم", cls: "bg-rose-500/15 text-rose-700" },
};

const PAYOUT_VARIANT: Record<string, { label: string; cls: string }> = {
  requested: {
    label: "ارسال‌شده",
    cls: "bg-violet-500/15 text-violet-700",
  },
  processing: {
    label: "در حال پردازش",
    cls: "bg-amber-500/15 text-amber-700",
  },
  paid: { label: "پرداخت‌شده", cls: "bg-emerald-500/15 text-emerald-700" },
  rejected: { label: "رد شده", cls: "bg-rose-500/15 text-rose-700" },
};

const COMMISSION_VARIANT: Record<string, { label: string; cls: string }> = {
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

export default async function AdminAffiliateDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const detail = await getAdminAffiliateDetail(userId);
  if (!detail) notFound();

  const v = STATUS_VARIANT[detail.status] ?? STATUS_VARIANT.active;

  return (
    <section className="section-shell space-y-6 py-6">
      <AdminAffiliatesNav />

      {/* Header */}
      <div className="rounded-2xl border border-border bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-tight">
              {detail.profile?.displayName || "—"}
            </h2>
            <p
              className="mt-0.5 font-mono text-[12px] text-muted-foreground"
              dir="ltr"
            >
              {formatPhoneDisplay(detail.user.phone)}
            </p>
            {detail.profile?.contactEmail ? (
              <p
                className="font-mono text-[12px] text-muted-foreground"
                dir="ltr"
              >
                {detail.profile.contactEmail}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                className={`rounded-full border-transparent px-2.5 py-0.5 text-[10px] font-bold ${v.cls}`}
              >
                {v.label}
              </Badge>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold">
                کد:{" "}
                <span className="font-mono" dir="ltr">
                  {detail.code.code}
                </span>
              </span>
              {detail.approvedAt ? (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px]">
                  تأیید شده در {formatShamsiDate(detail.approvedAt)}
                </span>
              ) : null}
            </div>
          </div>

          <StatusControl
            affiliateUserId={detail.user.id}
            currentStatus={detail.status}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-[12px] sm:grid-cols-6">
          <KV
            k="درصد پورسانت"
            v={`${toPersianDigits(detail.commissionPct)}٪`}
          />
          <KV
            k="نگه‌داری"
            v={`${toPersianDigits(detail.holdingPeriodDays)} روز`}
          />
          <KV
            k="حداقل تسویه"
            v={formatPersianNumber(detail.minWithdrawalToman)}
            mono
          />
          <KV k="کلیک" v={toPersianDigits(detail.balance.clicks)} />
          <KV k="ثبت‌نام" v={toPersianDigits(detail.balance.signups)} />
          <KV
            k="فروش سالانه"
            v={toPersianDigits(detail.balance.yearlyConversions)}
          />
        </div>
      </div>

      {/* Balance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="در انتظار" toman={detail.balance.pendingToman} />
        <Stat label="قابل برداشت" toman={detail.balance.availableToman} />
        <Stat label="در حال تسویه" toman={detail.balance.requestedToman} />
        <Stat label="پرداخت‌شده" toman={detail.balance.paidToman} />
        <Stat
          label="درآمد کل"
          toman={detail.balance.totalEarnedToman}
          highlight
        />
      </div>

      {/* Banking */}
      <div className="rounded-2xl border border-border bg-background p-5">
        <h3 className="text-[15px] font-semibold tracking-tight">
          اطلاعات بانکی
        </h3>
        <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
          ادمین می‌تونه روی اطلاعات بانکی پاک‌نویسی کنه (مثلاً بعد از تماس
          تلفنی). برای تسویه‌های قبلاً ثبت‌شده اعمال نمی‌شه.
        </p>
        <div className="mt-4">
          <BankingForm
            userId={detail.user.id}
            defaults={{
              sheba: detail.profile?.shebaNumber ?? "",
              holderName: detail.profile?.accountHolderName ?? "",
              nationalId: detail.profile?.nationalId ?? "",
              contactEmail: detail.profile?.contactEmail ?? "",
            }}
          />
        </div>
      </div>

      {/* Admin notes */}
      <div className="rounded-2xl border border-border bg-background p-5">
        <h3 className="text-[15px] font-semibold tracking-tight">
          یادداشت‌های داخلی
        </h3>
        <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
          فقط ادمین می‌بیند. مثلاً نتیجه‌ی تماس تلفنی، شرایط خاص یا هشدارهای
          تیمی.
        </p>
        <div className="mt-4">
          <AdminNotesForm
            userId={detail.user.id}
            defaultValue={detail.profile?.adminNotes ?? ""}
          />
        </div>
      </div>

      {/* Payouts */}
      <div>
        <h3 className="mb-3 text-[15px] font-semibold tracking-tight">
          تسویه‌ها
        </h3>
        {detail.payouts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-6 text-center text-[13px] text-muted-foreground">
            هنوز تسویه‌ای ثبت نشده.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            {detail.payouts.map((p, i) => {
              const pv = PAYOUT_VARIANT[p.status];
              return (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div>
                    <p className="font-mono text-[14px] font-bold" dir="ltr">
                      {formatPersianNumber(p.amountToman)} ت
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatShamsiDateTime(p.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pv.cls}`}
                  >
                    {pv.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ledger */}
      <div>
        <h3 className="mb-3 text-[15px] font-semibold tracking-tight">
          دفترچه‌ی پورسانت
        </h3>
        {detail.ledger.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background p-6 text-center text-[13px] text-muted-foreground">
            هیچ پورسانتی ثبت نشده.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-background">
            <table className="w-full text-start">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>مخاطب</Th>
                  <Th>تاریخ</Th>
                  <Th>نوع</Th>
                  <Th align="end">خالص</Th>
                  <Th align="end">پورسانت</Th>
                  <Th>وضعیت</Th>
                  <Th>آزادسازی</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[12px]">
                {detail.ledger.map((row) => {
                  const cv = row.commissionStatus
                    ? COMMISSION_VARIANT[row.commissionStatus]
                    : null;
                  return (
                    <tr key={row.id}>
                      <Td>
                        <div>
                          <p className="font-mono font-bold" dir="ltr">
                            {row.refereeMaskedHandle}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {row.refereeMaskedPhone}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        {row.rewardedAt
                          ? formatShamsiDate(row.rewardedAt)
                          : "—"}
                      </Td>
                      <Td>
                        {row.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                      </Td>
                      <Td align="end" mono>
                        {row.netAmountToman
                          ? formatPersianNumber(row.netAmountToman)
                          : "—"}
                      </Td>
                      <Td align="end" mono>
                        {row.commissionToman
                          ? formatPersianNumber(row.commissionToman)
                          : "—"}
                      </Td>
                      <Td>
                        {cv ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cv.cls}`}
                          >
                            {cv.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        {row.commissionStatus === "pending" && row.unlockAt
                          ? formatShamsiDate(row.unlockAt)
                          : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {k}
      </p>
      <p
        className={`text-[13px] font-bold ${mono ? "font-mono" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {v}
      </p>
    </div>
  );
}

function Stat({
  label,
  toman,
  highlight,
}: {
  label: string;
  toman: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-border bg-background"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-[16px] font-bold leading-tight"
        dir="ltr"
      >
        {formatPersianNumber(toman)}
      </p>
      <p className="text-[10px] text-muted-foreground">تومان</p>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-medium ${align === "end" ? "text-end" : "text-start"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  mono,
}: {
  children: React.ReactNode;
  align?: "end";
  mono?: boolean;
}) {
  return (
    <td
      className={`px-3 py-2 ${align === "end" ? "text-end" : "text-start"} ${mono ? "font-mono" : ""}`}
      dir={mono ? "ltr" : undefined}
    >
      {children}
    </td>
  );
}
