"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { recordAdminAudit } from "@/lib/admin-audit";
import { setSetting } from "@/lib/app-settings";

export type SettingsState = { status: "idle" | "error" | "ok"; message?: string };

/**
 * Save the Card & Plan settings (prices, which plan a card grants, which
 * material each plan grants, material availability). All gift/pricing logic
 * reads these — nothing is hardcoded.
 */
export async function saveCardSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const viewer = await requireAdmin();

  const priceColorful = Number(formData.get("priceColorful"));
  const priceMetal = Number(formData.get("priceMetal"));
  const shippingCost = Number(formData.get("shippingCost"));
  const purchaseGrantsPlan = String(formData.get("purchaseGrantsPlan"));
  const proMaterial = String(formData.get("proMaterial"));
  const businessMaterial = String(formData.get("businessMaterial"));
  const colorfulEnabled = formData.get("colorfulEnabled") === "on";
  const metalEnabled = formData.get("metalEnabled") === "on";

  if (!Number.isInteger(priceColorful) || priceColorful < 0) {
    return { status: "error", message: "قیمت کارت رنگی نامعتبر است." };
  }
  if (!Number.isInteger(priceMetal) || priceMetal < 0) {
    return { status: "error", message: "قیمت کارت فلزی نامعتبر است." };
  }
  if (!Number.isInteger(shippingCost) || shippingCost < 0) {
    return { status: "error", message: "هزینه ارسال نامعتبر است." };
  }
  if (!["free", "pro", "business"].includes(purchaseGrantsPlan)) {
    return { status: "error", message: "پلن هدیه نامعتبر است." };
  }
  if (
    !["colorful", "metal"].includes(proMaterial) ||
    !["colorful", "metal"].includes(businessMaterial)
  ) {
    return { status: "error", message: "جنس هدیهٔ پلن نامعتبر است." };
  }

  await Promise.all([
    setSetting("cards.price_colorful_toman", priceColorful, viewer.user.id),
    setSetting("cards.price_metal_toman", priceMetal, viewer.user.id),
    setSetting("cards.shipping_cost_toman", shippingCost, viewer.user.id),
    setSetting(
      "cards.purchase_grants_plan",
      purchaseGrantsPlan as "free" | "pro" | "business",
      viewer.user.id,
    ),
    setSetting(
      "cards.plan_grants_material",
      {
        pro: proMaterial as "colorful" | "metal",
        business: businessMaterial as "colorful" | "metal",
      },
      viewer.user.id,
    ),
    setSetting(
      "cards.material_enabled",
      { colorful: colorfulEnabled, metal: metalEnabled },
      viewer.user.id,
    ),
  ]);

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "card.settings_updated",
    metadata: { section: "card_plan_settings" },
  });

  revalidatePath("/admin/cards/settings");
  return { status: "ok", message: "تنظیمات ذخیره شد." };
}

/**
 * Save the Offers & Promotions settings (toggle each gift offer + the
 * cross-promo copy strings shown on the plans page and in the card flow).
 */
export async function saveCardOffersAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const viewer = await requireAdmin();

  const planGrantsCard = formData.get("planGrantsCard") === "on";
  const cardGrantsPlan = formData.get("cardGrantsPlan") === "on";
  const copyPlanIncludesCard = String(
    formData.get("copyPlanIncludesCard") ?? "",
  ).trim();
  const copyCardIncludesPlan = String(
    formData.get("copyCardIncludesPlan") ?? "",
  ).trim();

  if (copyPlanIncludesCard.length > 200 || copyCardIncludesPlan.length > 200) {
    return { status: "error", message: "متن تبلیغی بیش از حد بلند است." };
  }

  await Promise.all([
    setSetting(
      "cards.offer_plan_grants_card_enabled",
      planGrantsCard,
      viewer.user.id,
    ),
    setSetting(
      "cards.offer_card_grants_plan_enabled",
      cardGrantsPlan,
      viewer.user.id,
    ),
    setSetting(
      "cards.copy_plan_includes_card",
      copyPlanIncludesCard,
      viewer.user.id,
    ),
    setSetting(
      "cards.copy_card_includes_plan",
      copyCardIncludesPlan,
      viewer.user.id,
    ),
  ]);

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "card.settings_updated",
    metadata: { section: "offers" },
  });

  revalidatePath("/admin/cards/offers");
  return { status: "ok", message: "پیشنهادها ذخیره شد." };
}
