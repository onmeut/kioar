"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { cardOrders, cards } from "@/db/schema";
import { requireCompletedProfile } from "@/lib/auth/session";
import { repointCard } from "@/lib/cards/fulfillment";
import { getOwnedPageById } from "@/lib/pages";

export type RepointState = { status: "idle" | "error" | "ok"; message?: string };

/**
 * Owner re-points one of their cards to a different page they own. The card
 * must belong (via its order) to the caller, and the target page must be owned
 * by the caller. The chip/QR never change.
 */
export async function repointCardAction(
  _prev: RepointState,
  formData: FormData,
): Promise<RepointState> {
  const viewer = await requireCompletedProfile();
  const cardId = String(formData.get("cardId") ?? "");
  const newPageId = String(formData.get("pageId") ?? "");

  if (!cardId || !newPageId) {
    return { status: "error", message: "اطلاعات ناقص است." };
  }

  const db = getDb();

  // The card must be tied to an order owned by this user.
  const owningOrder = await db.query.cardOrders.findFirst({
    where: and(
      eq(cardOrders.cardId, cardId),
      eq(cardOrders.userId, viewer.user.id),
    ),
  });
  if (!owningOrder) {
    return { status: "error", message: "این کارت متعلق به شما نیست." };
  }

  // The target page must be owned by this user.
  const page = await getOwnedPageById(newPageId, viewer.user.id);
  if (!page) {
    return { status: "error", message: "صفحهٔ مقصد معتبر نیست." };
  }

  // The card must currently be assigned (you can't re-point an unactivated
  // gift card — that goes through activation-on-tap instead).
  const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  if (!card || card.status !== "assigned") {
    return { status: "error", message: "این کارت هنوز فعال نشده است." };
  }

  const ok = await repointCard(cardId, newPageId);
  if (!ok) {
    return { status: "error", message: "تغییر صفحه ناموفق بود." };
  }

  revalidatePath("/cards/orders");
  return { status: "ok", message: "صفحهٔ کارت به‌روزرسانی شد." };
}
