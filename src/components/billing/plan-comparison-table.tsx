/**
 * Phase 12 — feature × plan comparison table.
 *
 * Server component. Reads the registry (`features` + `plans` + `plan_features`)
 * and renders a grouped table with one row per feature and one column per
 * active plan. Cells render either a check (boolean grant), the limit
 * value (numeric grant), or a dash (not granted).
 *
 * Mobile-first: a single compact table with sticky header so the plan
 * column labels stay visible as the user scrolls a long category list.
 * Plain HTML table (not the shadcn Table) is used because the shadcn
 * wrapper introduces an `overflow-x-auto` scroll context that breaks
 * vertical `position: sticky` for the header.
 */
import { Fragment } from "react";
import { CheckIcon, MinusIcon } from "lucide-react";

import { getDb } from "@/db";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  key: "free" | "pro" | "business";
  nameFa: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  core: "هسته اصلی",
  branding: "برندینگ",
  design: "طراحی",
  link_types: "انواع لینک",
  analytics: "آمار و تحلیل",
  marketing: "بازاریابی",
  business_tools: "ابزارهای کسب‌وکار",
  support: "پشتیبانی",
  limits: "محدودیت‌ها",
};

type Props = {
  plans: Plan[];
};

export async function PlanComparisonTable({ plans }: Props) {
  const db = getDb();
  const [allFeatures, mappings] = await Promise.all([
    db.query.features.findMany({
      orderBy: (f, { asc }) => [asc(f.category), asc(f.displayOrder)],
    }),
    db.query.planFeatures.findMany(),
  ]);

  // Build a quick lookup: planId → featureId → limitValue|null|undefined
  // (undefined = not granted; null = boolean grant; number = quota).
  const grantsByPlan = new Map<string, Map<string, number | null>>();
  for (const m of mappings) {
    if (!grantsByPlan.has(m.planId)) {
      grantsByPlan.set(m.planId, new Map());
    }
    grantsByPlan.get(m.planId)!.set(m.featureId, m.limitValue);
  }

  // Group features by category, preserving the orderBy from the query.
  const groups = new Map<string, typeof allFeatures>();
  for (const f of allFeatures) {
    if (!groups.has(f.category)) groups.set(f.category, []);
    groups.get(f.category)!.push(f);
  }

  const sortedPlans = [...plans].sort((a, b) => {
    const order: Record<Plan["key"], number> = { free: 0, pro: 1, business: 2 };
    return order[a.key] - order[b.key];
  });

  return (
    <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-zinc-200">
      <table className="w-full border-separate border-spacing-0 text-right text-sm sm:text-[15px]">
        <thead className="sticky top-0 z-10">
          <tr>
            <th
              scope="col"
              className="border-b border-zinc-200 bg-white/95 px-4 py-4 text-start text-sm font-bold text-zinc-900 backdrop-blur-sm sm:px-6 sm:py-5 sm:text-base"
            >
              امکانات
            </th>
            {sortedPlans.map((p) => (
              <th
                key={p.id}
                scope="col"
                className={cn(
                  "border-b border-zinc-200 px-2 py-4 text-center text-sm font-bold text-zinc-900 backdrop-blur-sm sm:px-4 sm:py-5 sm:text-base",
                  p.key === "pro" ? "bg-zinc-50/95" : "bg-white/95",
                )}
              >
                {p.nameFa}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(groups.entries()).map(([category, rows]) => (
            <Fragment key={`cat-${category}`}>
              <tr>
                <td
                  colSpan={1 + sortedPlans.length}
                  className="border-b border-zinc-100 bg-zinc-50/70 px-4 py-3 text-[13px] font-bold text-zinc-500 sm:px-6 sm:text-sm"
                >
                  {CATEGORY_LABELS[category] ?? category}
                </td>
              </tr>
              {rows.map((feature, rowIdx) => {
                const isLastRow =
                  rowIdx === rows.length - 1 &&
                  category === Array.from(groups.keys()).at(-1);
                return (
                  <tr key={feature.id}>
                    <td
                      className={cn(
                        "border-b border-zinc-100 px-4 py-4 text-[13px] font-medium text-zinc-800 sm:px-6 sm:text-[15px]",
                        isLastRow && "border-b-0",
                      )}
                    >
                      {feature.nameFa}
                    </td>
                    {sortedPlans.map((p) => {
                      const planGrants = grantsByPlan.get(p.id);
                      const has = planGrants?.has(feature.id) ?? false;
                      const limit = planGrants?.get(feature.id);
                      return (
                        <td
                          key={p.id}
                          className={cn(
                            "border-b border-zinc-100 px-2 py-4 text-center sm:px-4",
                            p.key === "pro" && "bg-zinc-50/60",
                            isLastRow && "border-b-0",
                          )}
                        >
                          {has ? (
                            typeof limit === "number" ? (
                              <span className="font-semibold text-zinc-900">
                                {toPersianDigits(formatPersianNumber(limit))}
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "mx-auto flex size-6 items-center justify-center rounded-full sm:size-7",
                                  p.key === "pro"
                                    ? "bg-emerald-100"
                                    : p.key === "business"
                                      ? "bg-purple-100"
                                      : "bg-zinc-100",
                                )}
                              >
                                <CheckIcon
                                  strokeWidth={3}
                                  className={cn(
                                    "size-3.5 sm:size-4",
                                    p.key === "pro"
                                      ? "text-emerald-600"
                                      : p.key === "business"
                                        ? "text-purple-600"
                                        : "text-zinc-400",
                                  )}
                                />
                              </span>
                            )
                          ) : (
                            <MinusIcon className="mx-auto size-4 text-zinc-300" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
