"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { requireCompletedProfile } from "@/lib/auth/session";
import { invalidateCardCache } from "@/lib/cards/card-resolve";
import { isValidCardId } from "@/lib/cards/card-id";
import { getOwnedPageById } from "@/lib/pages";
import { log } from "@/lib/log";

export type ActivateState = {
  status: "idle" | "error";
  message?: string;
};

/**
 * Activation-on-tap for an UNASSIGNED (gift) card.
 *
 * The chip is already written + locked to `/c/{id}`; activation only sets the
 * DB binding: `cards.page_id = chosen page`, status → 'assigned'. We guard on
 * `status = 'unassigned'` in the WHERE so a double-submit (or two tabs) can't
 * re-point an already-assigned card here — re-pointing is a separate,
 * deliberate flow (Phase 4.5).
 */
export async function activateCardAction(
  _prev: ActivateState,
  formData: FormData,
): Promise<ActivateState> {
  const viewer = await requireCompletedProfile();
  const cardId = String(formData.get("cardId") ?? "");
  const pageId = String(formData.get("pageId") ?? "");

  if (!isValidCardId(cardId)) {
    return { status: "error", message: "شناسه کارت نامعتبر است." };
  }
  if (!pageId) {
    return { status: "error", message: "یک صفحه را انتخاب کنید." };
  }

  // Ownership check — the chosen page must belong to the viewer.
  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) {
    return { status: "error", message: "این صفحه متعلق به شما نیست." };
  }

  const db = getDb();
  const updated = await db
    .update(cards)
    .set({ pageId, status: "assigned", claimedAt: new Date() })
    .where(and(eq(cards.id, cardId), isNull(cards.pageId), eq(cards.status, "unassigned")))
    .returning({ id: cards.id });

  if (updated.length === 0) {
    return {
      status: "error",
      message: "این کارت قبلاً فعال شده یا قابل فعال‌سازی نیست.",
    };
  }

  await invalidateCardCache(cardId);
  log.info("card.activated", { cardId, pageId, userId: viewer.user.id });

  // Land on the now-live card so the user immediately sees their page.
  redirect(`/c/${cardId}` as Route);
}
