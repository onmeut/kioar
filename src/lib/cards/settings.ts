import "server-only";

import { getAllSettings } from "@/lib/app-settings";

export type CardMaterial = "colorful" | "metal";

export type CardColorOption = { value: string; label: string };

export type CardStudioSettings = {
  prices: Record<CardMaterial, number>;
  colors: Record<CardMaterial, CardColorOption[]>;
  materialEnabled: Record<CardMaterial, boolean>;
  copyCardIncludesPlan: string;
  copyPlanIncludesCard: string;
  purchaseGrantsPlan: "free" | "pro" | "business";
  planGrantsMaterial: { pro: CardMaterial; business: CardMaterial };
  offerPlanGrantsCard: boolean;
  offerCardGrantsPlan: boolean;
  shippingCost: number;
};

/**
 * One-shot loader for everything the card studio / checkout / gifting need,
 * read from the `app_settings` registry. No hardcoded prices/tiers/materials
 * anywhere in product code — all gift logic and pricing read from here.
 */
export async function getCardStudioSettings(): Promise<CardStudioSettings> {
  const s = await getAllSettings();
  return {
    prices: {
      colorful: s["cards.price_colorful_toman"],
      metal: s["cards.price_metal_toman"],
    },
    colors: {
      colorful: s["cards.colors"].colorful,
      metal: s["cards.colors"].metal,
    },
    materialEnabled: {
      colorful: s["cards.material_enabled"].colorful,
      metal: s["cards.material_enabled"].metal,
    },
    copyCardIncludesPlan: s["cards.copy_card_includes_plan"],
    copyPlanIncludesCard: s["cards.copy_plan_includes_card"],
    purchaseGrantsPlan: s["cards.purchase_grants_plan"],
    planGrantsMaterial: s["cards.plan_grants_material"],
    offerPlanGrantsCard: s["cards.offer_plan_grants_card_enabled"],
    offerCardGrantsPlan: s["cards.offer_card_grants_plan_enabled"],
    shippingCost: s["cards.shipping_cost_toman"],
  };
}
