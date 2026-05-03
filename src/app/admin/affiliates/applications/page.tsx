/**
 * `/admin/affiliates/applications` — queue.
 */
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAdminApplications } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";
import { formatShamsiDateTime } from "@/lib/date/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { toPersianDigits } from "@/lib/persian";
import { AdminAffiliatesNav } from "@/app/admin/affiliates/_components/nav";
import { ApplicationActions } from "@/app/admin/affiliates/applications/application-actions";

const CHANNEL_LABEL: Record<string, string> = {
  instagram: "اینستاگرام",
  telegram: "تلگرام",
  youtube: "یوتیوب",
  blog: "بلاگ / سایت",
  podcast: "پادکست",
  agency: "آژانس",
  other: "دیگر",
};

const AUDIENCE_LABEL: Record<string, string> = {
  lt_1k: "زیر ۱هزار",
  "1k_10k": "۱ تا ۱۰هزار",
  "10k_50k": "۱۰ تا ۵۰هزار",
  "50k_200k": "۵۰ تا ۲۰۰هزار",
  "200k_plus": "بیش از ۲۰۰هزار",
};

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  pending: {
    label: "در انتظار",
    className: "bg-amber-500/15 text-amber-700",
  },
  needs_info: {
    label: "نیاز به اطلاعات",
    className: "bg-sky-500/15 text-sky-700",
  },
  approved: {
    label: "تأیید شده",
    className: "bg-emerald-500/15 text-emerald-700",
  },
  rejected: {
    label: "رد شده",
    className: "bg-rose-500/15 text-rose-700",
  },
};

const FILTERS: { key: string; label: string; status?: string }[] = [
  { key: "pending", label: "در انتظار", status: "pending" },
  { key: "needs_info", label: "نیاز به اطلاعات", status: "needs_info" },
  { key: "approved", label: "تأیید شده", status: "approved" },
  { key: "rejected", label: "رد شده", status: "rejected" },
  { key: "all", label: "همه" },
];

type SearchParams = Promise<{ status?: string }>;

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filterKey = params.status ?? "pending";
  const status = (FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0])
    .status as "pending" | "needs_info" | "approved" | "rejected" | undefined;

  const apps = await listAdminApplications({ status, limit: 200 });

  return (
    <section className="section-shell space-y-5 py-6">
      <AdminAffiliatesNav />

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={
              f.key === "pending"
                ? "/admin/affiliates/applications"
                : `/admin/affiliates/applications?status=${f.key}`
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
          {toPersianDigits(apps.length)} مورد
        </span>
      </div>

      {apps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background py-10 text-center text-muted-foreground">
          هیچ درخواستی در این وضعیت وجود نداره.
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => {
            const v = STATUS_VARIANT[app.status] ?? STATUS_VARIANT.pending;
            return (
              <div
                key={app.id}
                className="rounded-2xl border border-border bg-background p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-bold">
                        {app.applicantName}
                      </p>
                      <Badge
                        className={`rounded-full border-transparent px-2.5 py-0.5 text-[10px] font-bold ${v.className}`}
                      >
                        {v.label}
                      </Badge>
                    </div>
                    <p
                      className="mt-1 font-mono text-[12px] text-muted-foreground"
                      dir="ltr"
                    >
                      {formatPhoneDisplay(app.contactPhone)}
                      {app.contactEmail ? ` · ${app.contactEmail}` : null}
                    </p>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatShamsiDateTime(app.createdAt)}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <KV
                    k="کانال"
                    v={CHANNEL_LABEL[app.channelKind] ?? app.channelKind}
                  />
                  <KV
                    k="مخاطب"
                    v={AUDIENCE_LABEL[app.audienceSize] ?? app.audienceSize}
                  />
                  <KV k="لینک" v={app.channelUrl} mono link />
                </div>

                <div className="mt-3 rounded-xl bg-muted/50 px-4 py-3 text-[12px] leading-7 text-foreground/90">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    برنامه‌ی تبلیغ
                  </p>
                  <p className="mt-1 whitespace-pre-line">
                    {app.promotionPlan}
                  </p>
                </div>

                {app.adminNote ? (
                  <p className="mt-3 rounded-xl bg-sky-50 px-4 py-2 text-[12px] leading-6 text-sky-900">
                    <span className="font-bold">یادداشت ادمین:</span>{" "}
                    {app.adminNote}
                  </p>
                ) : null}

                {app.status === "pending" ? (
                  <div className="mt-4">
                    <ApplicationActions applicationId={app.id} />
                  </div>
                ) : (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/admin/users/${app.userId}`} />}
                    >
                      کارت کاربر →
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function KV({
  k,
  v,
  mono,
  link,
}: {
  k: string;
  v: string;
  mono?: boolean;
  link?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {k}
      </p>
      {link ? (
        <a
          href={v}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all text-[12px] font-bold text-violet-700 hover:underline"
          dir="ltr"
        >
          {v}
        </a>
      ) : (
        <p
          className={`text-[13px] ${mono ? "font-mono" : "font-medium"}`}
          dir={mono ? "ltr" : undefined}
        >
          {v}
        </p>
      )}
    </div>
  );
}
