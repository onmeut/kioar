import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { CategoryManager } from "@/components/admin/category-manager";
import { requireAdmin } from "@/lib/auth/session";
import {
  getCategoriesByIndustryId,
  getIndustries,
  getIndustryBySlug,
} from "@/lib/discover";
import {
  adminCreateCategoryAction,
  adminDeleteCategoryAction,
  adminReorderCategoriesAction,
  adminUpdateCategoryAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesByIndustryPage({
  params,
}: {
  params: Promise<{ industrySlug: string }>;
}) {
  await requireAdmin();
  const { industrySlug } = await params;
  const industry = await getIndustryBySlug(industrySlug);
  if (!industry) notFound();

  const [categories, allIndustries] = await Promise.all([
    getCategoriesByIndustryId(industry.id, { includeInactive: true }),
    getIndustries({ includeInactive: true }),
  ]);

  return (
    <div className="p-6 max-w-3xl">
      <nav className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/categories" className="hover:text-foreground">
          صنوف
        </Link>
        <ChevronRight className="size-3.5 -scale-x-100" />
        <span className="text-foreground">{industry.titleFa}</span>
      </nav>
      <h1 className="text-xl font-semibold mb-1">
        دسته‌بندی‌های «{industry.titleFa}»
      </h1>
      <p className="text-sm text-muted-foreground mb-6" dir="ltr">
        {industry.titleEn} • {industry.accountTypes.join(" / ")}
      </p>
      <CategoryManager
        industry={industry}
        industries={allIndustries}
        categories={categories}
        createAction={adminCreateCategoryAction}
        updateAction={adminUpdateCategoryAction}
        deleteAction={adminDeleteCategoryAction}
        reorderAction={adminReorderCategoriesAction}
      />
    </div>
  );
}
