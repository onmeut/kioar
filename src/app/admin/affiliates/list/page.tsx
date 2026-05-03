/**
 * `/admin/affiliates/list` — every approved affiliate.
 */
import type { Route } from "next";
import Link from "next/link";

import { listAdminAffiliates } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatShamsiDate } from "@/lib/date/persian";
import { AdminAffiliatesNav } from "@/app/admin/affiliates/_components/nav";

const STATUS_VARIANT: Record<string, { label: string; cls: string }> = {
  active: { label: "فعال", cls: "bg-emerald-500/15 text-emerald-700" },
  paused: { label: "توقف موقت", cls: "bg-amber-500/15 text-amber-700" },
  banned: { label: "محروم", cls: "bg-rose-500/15 text-rose-700" },
};

export default async function AdminAffiliatesListPage() {
  await requireAdmin();
  const affiliates = await listAdminAffiliates();

  return (
    <section className="section-shell space-y-5 py-6">
      <AdminAffiliatesNav />

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold tracking-tight">
          لیست همکاران
        </h2>
        <span className="text-[12px] text-muted-foreground">
          {toPersianDigits(affiliates.length)} نفر
        </span>
      </div>

      {affiliates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background py-10 text-center text-muted-foreground">
          هنوز هیچ همکاری تأیید نشده.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {affiliates.map((a) => {
              const v =
                STATUS_VARIANT[a.affiliateStatus] ?? STATUS_VARIANT.active;
              return (
                <Link
                  key={a.userId}
                  href={`/admin/affiliates/${a.userId}` as Route}
                  className="block rounded-2xl border border-border bg-background p-4 transition hover:border-foreground/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold">
                        {a.displayName}
                      </p>
                      <p
                        className="font-mono text-[11px] text-muted-foreground"
                        dir="ltr"
                      >
                        {formatPhoneDisplay(a.phone)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${v.cls}`}
                    >
                      {v.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <KV k="کلیک" v={toPersianDigits(a.clicks)} />
                    <KV k="فروش" v={toPersianDigits(a.yearlyConversions)} />
                    <KV
                      k="درآمد کل"
                      v={formatPersianNumber(a.totalEarnedToman)}
                      mono
                    />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-background lg:block">
            <table className="w-full text-start">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th>همکار</Th>
                  <Th>کد</Th>
                  <Th>کانال</Th>
                  <Th align="end">کلیک</Th>
                  <Th align="end">فروش</Th>
                  <Th align="end">قابل برداشت</Th>
                  <Th align="end">پرداخت‌شده</Th>
                  <Th>وضعیت</Th>
                  <Th>تاریخ تأیید</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px]">
                {affiliates.map((a) => {
                  const v =
                    STATUS_VARIANT[a.affiliateStatus] ?? STATUS_VARIANT.active;
                  return (
                    <tr key={a.userId} className="hover:bg-muted/30">
                      <Td>
                        <Link
                          href={`/admin/affiliates/${a.userId}` as Route}
                          className="block"
                        >
                          <p className="font-bold">{a.displayName}</p>
                          <p
                            className="font-mono text-[11px] text-muted-foreground"
                            dir="ltr"
                          >
                            {formatPhoneDisplay(a.phone)}
                          </p>
                        </Link>
                      </Td>
                      <Td mono>{a.code}</Td>
                      <Td>{a.channelKind}</Td>
                      <Td align="end" mono>
                        {toPersianDigits(a.clicks)}
                      </Td>
                      <Td align="end" mono>
                        {toPersianDigits(a.yearlyConversions)}
                      </Td>
                      <Td align="end" mono>
                        {formatPersianNumber(a.availableToman)}
                      </Td>
                      <Td align="end" mono>
                        {formatPersianNumber(a.paidToman)}
                      </Td>
                      <Td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v.cls}`}
                        >
                          {v.label}
                        </span>
                      </Td>
                      <Td>
                        {a.approvedAt ? formatShamsiDate(a.approvedAt) : "—"}
                      </Td>
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

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {k}
      </p>
      <p
        className={`text-[12px] font-bold ${mono ? "font-mono" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {v}
      </p>
    </div>
  );
}
