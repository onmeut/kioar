import { IndustryManager } from "@/components/admin/industry-manager";
import { requireAdmin } from "@/lib/auth/session";
import { getIndustriesWithCounts } from "@/lib/discover";
import {
  adminCreateIndustryAction,
  adminDeleteIndustryAction,
  adminReorderIndustriesAction,
  adminUpdateIndustryAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminIndustriesPage() {
  await requireAdmin();
  const industries = await getIndustriesWithCounts();

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1">صنوف و دسته‌بندی‌ها</h1>
      <p className="text-sm text-muted-foreground mb-6">
        ساختار دو‌سطحی: صنف (Industry) ← دسته‌بندی (Category). کاربران در
        ثبت‌نام ابتدا صنف و سپس دسته‌بندی متناسب با نوع حساب خود را انتخاب
        می‌کنند. تغییر شناسهٔ یک دسته‌بندی، پروفایل‌های وابسته را به‌طور خودکار
        به‌روزرسانی می‌کند.
      </p>
      <IndustryManager
        industries={industries}
        createAction={adminCreateIndustryAction}
        updateAction={adminUpdateIndustryAction}
        deleteAction={adminDeleteIndustryAction}
        reorderAction={adminReorderIndustriesAction}
      />
    </div>
  );
}
