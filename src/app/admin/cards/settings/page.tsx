import { CardSettingsForm } from "@/components/admin/card-settings-form";
import { getAllSettings } from "@/lib/app-settings";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminCardSettingsPage() {
  await requireAdmin();
  const s = await getAllSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">تنظیمات کارت و پلن</h1>
        <p className="text-sm text-muted-foreground">
          قیمت‌ها، پلنی که خرید کارت هدیه می‌دهد، و جنس کارتی که هر پلن هدیه
          می‌دهد. تمام منطق هدیه از این تنظیمات می‌خواند.
        </p>
      </div>

      <CardSettingsForm
        priceColorful={s["cards.price_colorful_toman"]}
        priceMetal={s["cards.price_metal_toman"]}
        shippingCost={s["cards.shipping_cost_toman"]}
        purchaseGrantsPlan={s["cards.purchase_grants_plan"]}
        proMaterial={s["cards.plan_grants_material"].pro}
        businessMaterial={s["cards.plan_grants_material"].business}
        colorfulEnabled={s["cards.material_enabled"].colorful}
        metalEnabled={s["cards.material_enabled"].metal}
      />
    </div>
  );
}
