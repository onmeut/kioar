import { CardOffersForm } from "@/components/admin/card-offers-form";
import { getAllSettings } from "@/lib/app-settings";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminCardOffersPage() {
  await requireAdmin();
  const s = await getAllSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">پیشنهادها</h1>
        <p className="text-sm text-muted-foreground">
          فعال/غیرفعال‌سازی هدیه‌های متقابل و ویرایش متن‌های تبلیغی نمایش‌داده‌شده
          در صفحهٔ پلن‌ها و فروشگاه کارت.
        </p>
      </div>

      <CardOffersForm
        planGrantsCard={s["cards.offer_plan_grants_card_enabled"]}
        cardGrantsPlan={s["cards.offer_card_grants_plan_enabled"]}
        copyPlanIncludesCard={s["cards.copy_plan_includes_card"]}
        copyCardIncludesPlan={s["cards.copy_card_includes_plan"]}
      />
    </div>
  );
}
