import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { toPersianDigits } from "@/lib/persian";
import { formatShamsiDateTime } from "@/lib/date/persian";
import { Badge } from "@/components/ui/badge";
import { PlanPricingForm } from "@/components/admin/plan-pricing-form";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: string;
  key: "free" | "pro" | "business";
  nameFa: string;
  priceMonthlyToman: number;
  priceAnnualToman: number;
  annualDiscountPercent: number | null;
};

type CountRow = {
  plan_id: string;
  active_count: number;
  locked_count: number;
};

type LastEventRow = {
  plan_id: string;
  policy: string;
  grandfathered_count: number;
  created_at: Date;
};

export default async function AdminPlansPricingPage() {
  await requireAdmin();
  const db = getDb();

  const planRows = (await db
    .select({
      id: plans.id,
      key: plans.key,
      nameFa: plans.nameFa,
      priceMonthlyToman: plans.priceMonthlyToman,
      priceAnnualToman: plans.priceAnnualToman,
      annualDiscountPercent: plans.annualDiscountPercent,
    })
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(plans.displayOrder)) as PlanRow[];

  const counts = (await db.execute(sql`
    SELECT
      pl."id" AS plan_id,
      coalesce(s.active_count, 0)::int AS active_count,
      coalesce(l.locked_count, 0)::int AS locked_count
    FROM "plans" pl
    LEFT JOIN (
      SELECT "plan_id", count(*) AS active_count
      FROM "page_subscriptions"
      WHERE "status" IN ('active','trialing','pending_renewal','grace')
      GROUP BY "plan_id"
    ) s ON s."plan_id" = pl."id"
    LEFT JOIN (
      SELECT "plan_id", count(*) AS locked_count
      FROM "subscription_price_locks"
      GROUP BY "plan_id"
    ) l ON l."plan_id" = pl."id"
    WHERE pl."is_active" = true
  `)) as unknown as CountRow[];

  const lastEvents = (await db.execute(sql`
    SELECT DISTINCT ON ("plan_id")
      "plan_id", "policy", "grandfathered_count", "created_at"
    FROM "subscription_price_change_events"
    ORDER BY "plan_id", "created_at" DESC
  `)) as unknown as LastEventRow[];

  const countByPlan = new Map(counts.map((c) => [c.plan_id, c]));
  const eventByPlan = new Map(lastEvents.map((e) => [e.plan_id, e]));

  const paidPlans = planRows.filter((p) => p.key !== "free");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">قیمت‌گذاری پلن‌ها</h1>
        <p className="text-sm text-muted-foreground">
          تغییر قیمت یک پلن دو حالت دارد: «همه به قیمت جدید» (پیش‌فرض) یا
          «قفل قیمت قدیم برای فعلی‌ها» که برای هر اشتراک فعلی یک ردیف در
          <code dir="ltr">subscription_price_locks</code> ثبت می‌کند.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {paidPlans.map((plan) => {
          const c = countByPlan.get(plan.id);
          const ev = eventByPlan.get(plan.id);
          return (
            <article
              key={plan.id}
              className="rounded-2xl border border-border bg-card p-5 space-y-4"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{plan.nameFa}</h2>
                  <p
                    className="text-[11px] text-muted-foreground font-mono"
                    dir="ltr"
                  >
                    {plan.key}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <Badge variant="secondary" className="font-mono">
                    {toPersianDigits(c?.active_count ?? 0)} مشترک فعال
                  </Badge>
                  {(c?.locked_count ?? 0) > 0 ? (
                    <Badge variant="outline" className="font-mono">
                      {toPersianDigits(c?.locked_count ?? 0)} قفل قیمت
                    </Badge>
                  ) : null}
                </div>
              </header>

              {ev ? (
                <p className="text-xs text-muted-foreground">
                  آخرین تغییر:{" "}
                  {ev.policy === "grandfather"
                    ? `با حفظ قیمت قدیم برای ${toPersianDigits(ev.grandfathered_count)} اشتراک`
                    : "همه به قیمت جدید"}
                  {" — "}
                  {formatShamsiDateTime(ev.created_at)}
                </p>
              ) : null}

              <PlanPricingForm
                planId={plan.id}
                planKey={plan.key}
                planNameFa={plan.nameFa}
                priceMonthlyToman={plan.priceMonthlyToman}
                priceAnnualToman={plan.priceAnnualToman}
                annualDiscountPercent={plan.annualDiscountPercent}
                activeCount={c?.active_count ?? 0}
              />
            </article>
          );
        })}
      </div>

      {paidPlans.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          هیچ پلن پولی فعالی برای ویرایش وجود ندارد.
        </p>
      ) : null}

      <aside className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
        <p>
          مالیات بر ارزش افزوده در صفحه‌ی{" "}
          <code dir="ltr">/admin/billing/config</code> تنظیم می‌شود و روی
          مبلغ پس از تخفیف اعمال خواهد شد.
        </p>
        <p>
          درصد سالانه فقط برای محاسبه‌ی کمکی فرم است — مبلغ نهایی همان
          عددی است که در فیلد سالانه ذخیره می‌شود.
        </p>
      </aside>
    </div>
  );
}
