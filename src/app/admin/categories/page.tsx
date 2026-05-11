import { CategoryManager } from "@/components/admin/category-manager";
import { requireAdmin } from "@/lib/auth/session";
import { getAllDiscoverCategories } from "@/lib/discover";
import {
  adminCreateCategoryAction,
  adminDeleteCategoryAction,
  adminMoveCategoryAction,
  adminUpdateCategoryAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = await getAllDiscoverCategories();

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">دسته‌بندی‌های دیسکاور</h1>
      <p className="text-sm text-muted-foreground mb-6">
        دسته‌بندی‌هایی که کاربران هنگام ثبت‌نام و در تنظیمات صفحه انتخاب
        می‌کنند. تغییر شناسه یک دسته‌بندی تمام پروفایل‌های وابسته را به‌طور
        خودکار به‌روزرسانی می‌کند.
      </p>
      <CategoryManager
        categories={categories}
        createAction={adminCreateCategoryAction}
        updateAction={adminUpdateCategoryAction}
        deleteAction={adminDeleteCategoryAction}
        moveAction={adminMoveCategoryAction}
      />
    </div>
  );
}
