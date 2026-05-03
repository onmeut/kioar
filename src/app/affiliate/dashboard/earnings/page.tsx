/**
 * `/affiliate/dashboard/earnings` — full ledger of every commission
 * entry with status, dates, and unlock countdown.
 */
import { getAffiliateBalance, listAffiliateLedger } from "@/lib/affiliate";
import { requireUser } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { formatShamsiDate } from "@/lib/date/persian";

export default async function AffiliateEarningsPage() {
  const viewer = await requireUser();
  const [balance, ledger] = await Promise.all([
    getAffiliateBalance(viewer.user.id),
    listAffiliateLedger(viewer.user.id, 200),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
          درآمد و دفترچه‌ی فروش
        </p>
        <h1 className="mt-1 text-[clamp(22px,3.5vw,30px)] font-semibold tracking-tight">
          هر فروشی که از طرف تو اومده
        </h1>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Sum label="در انتظار" toman={balance.pendingToman} />
        <Sum label="قابل برداشت" toman={balance.availableToman} highlight />
        <Sum label="در حال تسویه" toman={balance.requestedToman} />
        <Sum label="پرداخت شده" toman={balance.paidToman} />
      </div>

      {ledger.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-hairline bg-paper-soft p-10 text-center">
          <p className="text-[14px] text-ink-soft">
            هنوز هیچ فروشی ثبت نشده. وقتی اولین خرید سالانه از طریق لینکت انجام
            بشه، اینجا می‌بینیش.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {ledger.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-hairline bg-paper p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="font-mono text-[13px] font-bold text-ink"
                    dir="ltr"
                  >
                    {row.refereeMaskedHandle}
                  </p>
                  <StatusPill status={row.commissionStatus} />
                </div>
                <p className="mt-1 text-[11px] text-ink-soft">
                  {row.refereeMaskedPhone}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                  <KV
                    k="مبلغ خالص"
                    v={
                      row.netAmountToman
                        ? `${formatPersianNumber(row.netAmountToman)} ت`
                        : "—"
                    }
                  />
                  <KV
                    k="پورسانت"
                    v={
                      row.commissionToman
                        ? `${formatPersianNumber(row.commissionToman)} ت`
                        : "—"
                    }
                  />
                  <KV
                    k="نوع"
                    v={row.billingCycle === "annual" ? "سالانه" : "ماهانه"}
                  />
                  <KV
                    k="تاریخ"
                    v={row.rewardedAt ? formatShamsiDate(row.rewardedAt) : "—"}
                  />
                </div>
                {row.commissionStatus === "pending" && row.unlockAt ? (
                  <p className="mt-3 text-[11px] text-amber-800">
                    آزاد می‌شه: {formatShamsiDate(row.unlockAt)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-3xl border border-hairline bg-paper lg:block">
            <table className="w-full text-start">
              <thead className="bg-paper-soft text-[11px] uppercase tracking-wider text-ink-soft">
                <tr>
                  <Th>مخاطب</Th>
                  <Th>تاریخ</Th>
                  <Th>نوع</Th>
                  <Th align="end">مبلغ خالص</Th>
                  <Th align="end">پورسانت</Th>
                  <Th>وضعیت</Th>
                  <Th>آزادسازی</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline text-[13px]">
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <div>
                        <p className="font-mono font-bold" dir="ltr">
                          {row.refereeMaskedHandle}
                        </p>
                        <p className="text-[11px] text-ink-soft">
                          {row.refereeMaskedPhone}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      {row.rewardedAt ? formatShamsiDate(row.rewardedAt) : "—"}
                    </Td>
                    <Td>
                      {row.billingCycle === "annual" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                          سالانه
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-700 ring-1 ring-zinc-200">
                          ماهانه
                        </span>
                      )}
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
                      <StatusPill status={row.commissionStatus} />
                    </Td>
                    <Td>
                      {row.commissionStatus === "pending" && row.unlockAt
                        ? formatShamsiDate(row.unlockAt)
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-[11px] leading-6 text-ink-soft">
        برای حفظ حریم خصوصی مخاطب، فقط بخش کوچکی از نام کاربری و شماره تماس
        نمایش داده می‌شه. اگه به جزئیات بیشتر برای دفاع از فروش نیاز داشتی، با
        پشتیبانی تماس بگیر.
      </p>
      <p className="text-[11px] text-ink-soft">
        نمایش {toPersianDigits(ledger.length)} فروش اخیر.
      </p>
    </div>
  );
}

function Sum({
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
          : "border-hairline bg-paper-soft"
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-[16px] font-bold leading-tight text-ink"
        dir="ltr"
      >
        {formatPersianNumber(toman)}
      </p>
      <p className="text-[11px] text-ink-soft">تومان</p>
    </div>
  );
}

function StatusPill({
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
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "end" }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-medium ${align === "end" ? "text-end" : "text-start"}`}
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
      className={`px-4 py-3 ${align === "end" ? "text-end" : "text-start"} ${mono ? "font-mono" : ""}`}
      dir={mono ? "ltr" : undefined}
    >
      {children}
    </td>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-soft">{k}</p>
      <p className="font-mono text-[13px] font-bold text-ink" dir="ltr">
        {v}
      </p>
    </div>
  );
}
