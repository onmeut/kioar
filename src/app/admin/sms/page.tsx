import { desc, sql } from "drizzle-orm";

import { SmsTemplateRow } from "@/components/admin/sms-template-row";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { smsQueue, smsTemplates } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianDateTime, toPersianDigits } from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<
  "queued" | "sending" | "sent" | "failed",
  { label: string; className: string }
> = {
  queued: { label: "در صف", className: "bg-muted text-foreground" },
  sending: {
    label: "در حال ارسال",
    className: "bg-amber-500/12 text-amber-700",
  },
  sent: {
    label: "ارسال شد",
    className: "bg-emerald-500/12 text-emerald-700",
  },
  failed: {
    label: "ناموفق",
    className: "bg-destructive/10 text-destructive",
  },
};

export default async function AdminSmsPage() {
  await requireAdmin();
  const db = getDb();

  const [templates, queueRows, queueCounts] = await Promise.all([
    db.select().from(smsTemplates).orderBy(smsTemplates.nameFa),
    db.select().from(smsQueue).orderBy(desc(smsQueue.createdAt)).limit(50),
    db
      .select({
        status: smsQueue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(smsQueue)
      .groupBy(smsQueue.status),
  ]);

  const counts = new Map(queueCounts.map((row) => [row.status, row.count]));

  const unmapped = templates.filter((t) => !t.kavenegarTemplate).length;
  const inactive = templates.filter((t) => !t.isActive).length;
  const outOfSync = templates.filter((t) => {
    if (!t.bodyPreviewUpdatedAt) return false;
    if (!t.kavenegarSyncedAt) return true;
    return t.bodyPreviewUpdatedAt.getTime() > t.kavenegarSyncedAt.getTime();
  }).length;

  return (
    <div className="section-shell space-y-8 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">پیامک‌ها</h1>
        <p className="text-sm text-muted-foreground">
          نگاشت تمپلیت‌های Kavenegar، فعال‌سازی، ارسال آزمایشی و مرور صف ارسال.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <Stat label="تمپلیت‌ها" value={templates.length} />
        <Stat
          label="نگاشت نشده"
          value={unmapped}
          accent={unmapped > 0 ? "warn" : "default"}
        />
        <Stat
          label="غیرفعال"
          value={inactive}
          accent={inactive > 0 ? "warn" : "default"}
        />
        <Stat
          label="نیاز به همگام‌سازی"
          value={outOfSync}
          accent={outOfSync > 0 ? "warn" : "default"}
        />
        <Stat
          label="ناموفق در صف"
          value={counts.get("failed") ?? 0}
          accent={(counts.get("failed") ?? 0) > 0 ? "destructive" : "default"}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">تمپلیت‌ها</h2>
        <div className="grid gap-3">
          {templates.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              هنوز هیچ تمپلیتی seed نشده است. <br />
              <code dir="ltr" className="font-mono">
                pnpm db:seed:sms
              </code>{" "}
              را اجرا کنید.
            </p>
          ) : (
            templates.map((template) => (
              <SmsTemplateRow
                key={template.key}
                templateKey={template.key}
                nameFa={template.nameFa}
                descriptionFa={template.descriptionFa}
                kavenegarTemplate={template.kavenegarTemplate}
                variableSchema={template.variableSchema ?? []}
                isActive={template.isActive}
                bodyFaPreview={template.bodyFaPreview}
                bodyPreviewUpdatedAt={template.bodyPreviewUpdatedAt}
                kavenegarSyncedAt={template.kavenegarSyncedAt}
              />
            ))
          )}
        </div>
      </section>

      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">صف ارسال (۵۰ مورد اخیر)</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["queued", "sending", "sent", "failed"] as const).map((s) => (
              <Badge
                key={s}
                variant="outline"
                className={cn("rounded-full", STATUS_STYLES[s].className)}
              >
                {STATUS_STYLES[s].label}: {toPersianDigits(counts.get(s) ?? 0)}
              </Badge>
            ))}
          </div>
        </header>

        {queueRows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            صف ارسال خالی است.
          </p>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <table className="w-full table-auto text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">تمپلیت</th>
                  <th className="px-3 py-2 text-start">گیرنده</th>
                  <th className="px-3 py-2 text-start">وضعیت</th>
                  <th className="px-3 py-2 text-start">تلاش</th>
                  <th className="px-3 py-2 text-start">زمان‌بندی</th>
                  <th className="px-3 py-2 text-start">خطا</th>
                </tr>
              </thead>
              <tbody>
                {queueRows.map((row) => {
                  const style = STATUS_STYLES[row.status];
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td
                        className="px-3 py-2 align-top font-mono text-xs"
                        dir="ltr"
                      >
                        {row.templateKey}
                      </td>
                      <td className="px-3 py-2 align-top text-xs" dir="ltr">
                        {formatPhoneDisplay(row.phone)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Badge
                          variant="outline"
                          className={cn("rounded-full", style.className)}
                        >
                          {style.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {toPersianDigits(row.attempts)}
                      </td>
                      <td
                        className="px-3 py-2 align-top text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {formatPersianDateTime(row.scheduledFor)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-rose-600">
                        {row.lastError ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: number;
  accent?: "default" | "warn" | "destructive";
}) {
  return (
    <div className="rounded-4xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold leading-none",
          accent === "warn" && "text-amber-600",
          accent === "destructive" && "text-rose-600",
        )}
      >
        {toPersianDigits(value)}
      </p>
    </div>
  );
}
