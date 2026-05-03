/**
 * Phase 12 — feature × plan comparison table.
 *
 * Server component. Reads the registry (`features` + `plans` + `plan_features`)
 * and renders a grouped table with one row per feature and one column per
 * active plan. Cells render either a check (boolean grant), the limit
 * value (numeric grant), or a dash (not granted).
 *
 * Hidden by default on small mobile (<sm) — pricing cards already cover the
 * "what do I get" question on phones; the matrix is a desktop convenience.
 */
import { Fragment } from "react";
import { CheckIcon, MinusIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <div className="overflow-x-auto rounded-2xl border bg-white">
      <Table className="text-[13px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44%] text-start font-semibold">
              امکانات
            </TableHead>
            {sortedPlans.map((p) => (
              <TableHead
                key={p.id}
                className={cn(
                  "text-center font-semibold",
                  p.key === "pro" && "bg-zinc-50",
                )}
              >
                {p.nameFa}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from(groups.entries()).map(([category, rows]) => (
            <Fragment key={`cat-${category}`}>
              <TableRow className="bg-zinc-50/60 hover:bg-zinc-50/60">
                <TableCell
                  colSpan={1 + sortedPlans.length}
                  className="py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500"
                >
                  {CATEGORY_LABELS[category] ?? category}
                </TableCell>
              </TableRow>
              {rows.map((feature) => (
                <TableRow key={feature.id}>
                  <TableCell className="font-medium text-zinc-800">
                    {feature.nameFa}
                  </TableCell>
                  {sortedPlans.map((p) => {
                    const planGrants = grantsByPlan.get(p.id);
                    const has = planGrants?.has(feature.id) ?? false;
                    const limit = planGrants?.get(feature.id);
                    return (
                      <TableCell
                        key={p.id}
                        className={cn(
                          "text-center",
                          p.key === "pro" && "bg-zinc-50/60",
                        )}
                      >
                        {has ? (
                          typeof limit === "number" ? (
                            <span className="font-semibold">
                              {toPersianDigits(formatPersianNumber(limit))}
                            </span>
                          ) : (
                            <CheckIcon className="mx-auto size-4 text-emerald-600" />
                          )
                        ) : (
                          <MinusIcon className="mx-auto size-3 text-zinc-300" />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
