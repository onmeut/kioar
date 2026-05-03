import { sql } from "drizzle-orm";

import { PlanFeatureCell } from "@/components/admin/plan-feature-cell";
import { RebuildPlanButton } from "@/components/admin/rebuild-plan-button";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  core: "هسته",
  branding: "برندینگ",
  design: "طراحی",
  link_types: "انواع لینک",
  analytics: "آمار",
  marketing: "بازاریابی",
  business_tools: "ابزارهای کسب‌وکار",
  support: "پشتیبانی",
  limits: "محدودیت‌ها",
};

const LIMIT_FEATURE_KEYS = new Set<string>([
  "limit_storage_image_uploads_mb",
  "limit_max_links",
  "limit_form_submissions_per_month",
  "limit_max_pages",
  "limit_blocks_per_page",
  "limit_email_per_month",
  "products_max_items_per_block",
]);

type PlanRow = {
  id: string;
  key: "free" | "pro" | "business";
  name_fa: string;
  page_count: number;
};

type FeatureRow = {
  id: string;
  key: string;
  name_fa: string;
  description_fa: string | null;
  category: string;
};

type MapRow = {
  plan_id: string;
  feature_id: string;
  limit_value: number | null;
};

export default async function AdminPlansPage() {
  await requireAdmin();
  const db = getDb();

  const [plans, features, mappings] = await Promise.all([
    db.execute(sql`
      SELECT
        pl."id"            AS id,
        pl."key"::text     AS key,
        pl."name_fa"       AS name_fa,
        coalesce(c."page_count", 0)::int AS page_count
      FROM "plans" pl
      LEFT JOIN (
        SELECT "plan_id", count(*) AS page_count
        FROM "page_subscriptions"
        GROUP BY "plan_id"
      ) c ON c."plan_id" = pl."id"
      WHERE pl."is_active" = true
      ORDER BY pl."display_order" ASC
    `) as unknown as Promise<PlanRow[]>,
    db.execute(sql`
      SELECT
        "id", "key", "name_fa", "description_fa", "category"
      FROM "features"
      ORDER BY "category" ASC NULLS LAST, "display_order" ASC NULLS LAST,
               "name_fa" ASC
    `) as unknown as Promise<FeatureRow[]>,
    db.execute(sql`
      SELECT "plan_id", "feature_id", "limit_value"::bigint::int AS limit_value
      FROM "plan_features"
    `) as unknown as Promise<MapRow[]>,
  ]);

  const mapKey = (planId: string, featureId: string) =>
    `${planId}::${featureId}`;
  const mapByKey = new Map<string, MapRow>();
  for (const m of mappings) mapByKey.set(mapKey(m.plan_id, m.feature_id), m);

  const grouped = new Map<string, FeatureRow[]>();
  for (const f of features) {
    const arr = grouped.get(f.category) ?? [];
    arr.push(f);
    grouped.set(f.category, arr);
  }

  return (
    <div className="section-shell space-y-6 py-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">پلن‌ها و قابلیت‌ها</h1>
        <p className="text-sm text-muted-foreground">
          هر سوییچ یک ردیف <code dir="ltr">plan_features</code> را تغییر می‌دهد.
          تغییرات روی صفحه‌های موجود اعمال نمی‌شود مگر این‌که از دکمه‌ی
          «بازسازی» استفاده کنید.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{p.name_fa}</p>
              <Badge variant="outline" className="font-mono text-[10px]">
                {p.key}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {toPersianDigits(formatPersianNumber(p.page_count))} صفحه فعال
            </p>
            <div className="mt-3">
              <RebuildPlanButton
                planId={p.id}
                planNameFa={p.name_fa}
                pageCount={p.page_count}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky inset-s-0 z-10 bg-muted/40 px-4 py-3 text-start text-xs font-semibold text-muted-foreground">
                قابلیت
              </th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground"
                >
                  {p.name_fa}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...grouped.entries()].map(([category, list]) => (
              <CategoryGroup
                key={category}
                category={category}
                features={list}
                plans={plans}
                mapByKey={mapByKey}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function CategoryGroup({
  category,
  features,
  plans,
  mapByKey,
}: {
  category: string;
  features: FeatureRow[];
  plans: PlanRow[];
  mapByKey: Map<
    string,
    { plan_id: string; feature_id: string; limit_value: number | null }
  >;
}) {
  return (
    <>
      <tr className="border-t border-border bg-muted/20">
        <td
          colSpan={1 + plans.length}
          className="px-4 py-2 text-xs font-semibold text-muted-foreground"
        >
          {CATEGORY_LABELS[category] ?? category}
        </td>
      </tr>
      {features.map((f) => {
        const hasLimit = LIMIT_FEATURE_KEYS.has(f.key);
        return (
          <tr key={f.id} className="border-t border-border">
            <td className="sticky inset-s-0 z-10 bg-card px-4 py-3 align-top">
              <p className="text-sm font-medium">{f.name_fa}</p>
              <p
                className="mt-0.5 font-mono text-[10px] text-muted-foreground"
                dir="ltr"
              >
                {f.key}
              </p>
              {f.description_fa ? (
                <p className="mt-1 max-w-[36ch] text-[11px] text-muted-foreground">
                  {f.description_fa}
                </p>
              ) : null}
            </td>
            {plans.map((p) => {
              const m = mapByKey.get(`${p.id}::${f.id}`);
              return (
                <td key={p.id} className="px-2 py-3">
                  <PlanFeatureCell
                    planId={p.id}
                    featureId={f.id}
                    enabled={Boolean(m)}
                    limitValue={m?.limit_value ?? null}
                    hasLimit={hasLimit}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
