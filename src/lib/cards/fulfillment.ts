import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { cardOrders, cards } from "@/db/schema";
import { invalidateCardCache } from "@/lib/cards/card-resolve";
import { invalidateProfileCacheById } from "@/lib/cache/profile-cache";
import { log } from "@/lib/log";

/**
 * Phase 4 — fulfillment.
 *
 * `assignCardToOrder` links a physical inventory card to a paid order and,
 * for PURCHASED orders, pre-binds it to the order's page (no user activation
 * step). For GIFT orders the card is linked but left UNASSIGNED so the user
 * activates-on-tap (`activateCardAction`).
 *
 * NFC write/verify/lock is tracked per card via the checklist helpers; the
 * actual chip writing happens on external hardware (out of app scope).
 */

export type AssignResult =
  | { ok: true; preBound: boolean }
  | { ok: false; error: string };

/**
 * Assign inventory card `cardId` to order `orderId`.
 *
 * - Order must be `paid` (or further) and not already have a card.
 * - Card must be `unassigned` and not already linked to another order.
 * - Purchased order → set `cards.page_id = order.page_id`, status `assigned`,
 *   invalidate caches. Gift order → leave card unassigned (activation-on-tap).
 * - Advances the order to `processing`.
 */
export async function assignCardToOrder(
  orderId: string,
  cardId: string,
): Promise<AssignResult> {
  const db = getDb();

  const order = await db.query.cardOrders.findFirst({
    where: eq(cardOrders.id, orderId),
  });
  if (!order) return { ok: false, error: "order_not_found" };
  if (order.cardId) return { ok: false, error: "order_already_assigned" };
  if (!order.paidAt && order.status !== "paid") {
    return { ok: false, error: "order_not_paid" };
  }

  const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  if (!card) return { ok: false, error: "card_not_found" };
  if (card.status !== "unassigned" || card.pageId) {
    return { ok: false, error: "card_unavailable" };
  }

  const isPurchased = order.source === "purchased";

  await db.transaction(async (tx) => {
    // Link the physical card to the order + advance the order.
    await tx
      .update(cardOrders)
      .set({ cardId, status: "processing" })
      .where(eq(cardOrders.id, orderId));

    if (isPurchased) {
      // Pre-bind: the target page is known at checkout.
      await tx
        .update(cards)
        .set({
          pageId: order.pageId,
          status: "assigned",
          claimedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    }
    // Gift: leave the card unassigned — the user binds it via activation-on-tap.
  });

  if (isPurchased) {
    await invalidateCardCache(cardId);
    await invalidateProfileCacheById(order.pageId);
  }

  log.info("card_order.card_assigned", {
    orderId,
    cardId,
    preBound: isPurchased,
  });
  return { ok: true, preBound: isPurchased };
}

/** Mark an NFC checklist step done (write or lock). Idempotent. */
export async function markNfcStep(
  cardId: string,
  step: "written" | "locked",
): Promise<boolean> {
  const db = getDb();
  const patch =
    step === "written"
      ? { nfcWrittenAt: new Date() }
      : { nfcLockedAt: new Date() };
  const updated = await db
    .update(cards)
    .set(patch)
    .where(eq(cards.id, cardId))
    .returning({ id: cards.id });
  return updated.length > 0;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "shipped"
  | "fulfilled"
  | "cancelled";

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, "shippedAt" | "fulfilledAt">> =
  {
    shipped: "shippedAt",
    fulfilled: "fulfilledAt",
  };

/** Advance an order's status (admin). Stamps the matching timestamp. */
export async function advanceOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<boolean> {
  const db = getDb();
  const patch: Record<string, unknown> = { status };
  const ts = STATUS_TIMESTAMP[status];
  if (ts) patch[ts] = new Date();
  const updated = await db
    .update(cardOrders)
    .set(patch)
    .where(eq(cardOrders.id, orderId))
    .returning({ id: cardOrders.id });
  if (updated.length > 0) {
    log.info("card_order.status_advanced", { orderId, status });
  }
  return updated.length > 0;
}

/**
 * Re-point an ASSIGNED card to a different page (owner-initiated). The chip/QR
 * never change — only `cards.page_id`. Ownership of the new page is the
 * caller's responsibility to verify before calling.
 */
export async function repointCard(
  cardId: string,
  newPageId: string,
): Promise<boolean> {
  const db = getDb();
  const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
  if (!card) return false;
  const oldPageId = card.pageId;

  const updated = await db
    .update(cards)
    .set({ pageId: newPageId, status: "assigned" })
    .where(and(eq(cards.id, cardId), eq(cards.status, "assigned")))
    .returning({ id: cards.id });
  if (updated.length === 0) return false;

  await invalidateCardCache(cardId);
  if (oldPageId) await invalidateProfileCacheById(oldPageId);
  await invalidateProfileCacheById(newPageId);
  log.info("card.repointed", { cardId, oldPageId, newPageId });
  return true;
}

/** Disable a card (admin: lost/stolen/revoked). */
export async function adminDisableCard(cardId: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(cards)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(cards.id, cardId))
    .returning({ id: cards.id });
  if (updated.length > 0) {
    await invalidateCardCache(cardId);
    log.info("card.disabled", { cardId });
  }
  return updated.length > 0;
}
