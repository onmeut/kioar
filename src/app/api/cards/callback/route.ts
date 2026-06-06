/**
 * `GET /api/cards/callback` — Zarinpal return for a card purchase.
 *
 * Query params:
 *   ?order={uuid}        // set on callback_url at request time
 *   ?Authority={token}   // echoed by Zarinpal
 *   ?Status=OK|NOK
 *
 * Idempotency key is `card_orders.payment_authority` (UNIQUE) — the order row
 * IS the payment record (card orders are decoupled from `invoices`). On a
 * verified payment we flip the order to `paid`, stamp `ref_id`/`paid_at`, and
 * (best-effort, outside the success path) grant the buyer the configured free
 * plan year via the Phase 5 gifting hook.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { cardOrders } from "@/db/schema";
import { grantPlanYearForCardPurchase } from "@/lib/cards/gifting";
import { log } from "@/lib/log";
import { absoluteUrl } from "@/lib/site";
import { verifyPayment } from "@/lib/zarinpal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(path: string) {
  return NextResponse.redirect(absoluteUrl(path));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  const authority = url.searchParams.get("Authority");
  const gatewayStatus = url.searchParams.get("Status");

  if (!orderId || !authority) {
    return redirect("/cards/orders?status=invalid");
  }

  const db = getDb();

  const order = await db.query.cardOrders.findFirst({
    where: eq(cardOrders.paymentAuthority, authority),
  });
  if (!order) {
    log.warn("card_callback.unknown_authority", { authority, orderId });
    return redirect(`/cards/orders?status=unknown`);
  }

  // Idempotent short-circuits.
  if (order.status === "paid" || order.paidAt) {
    return redirect(`/cards/orders?placed=${order.id}&already=1`);
  }
  if (order.status === "cancelled") {
    return redirect(`/cards/orders?status=failed`);
  }

  // User cancelled at the gateway.
  if (gatewayStatus !== "OK") {
    await db
      .update(cardOrders)
      .set({ status: "cancelled" })
      .where(eq(cardOrders.id, order.id));
    return redirect(`/cards/orders?status=cancelled`);
  }

  let verification;
  try {
    verification = await verifyPayment({
      authority,
      amountToman: order.amountToman,
    });
  } catch (err) {
    // Network error — retryable, leave the order pending.
    log.warn("card_callback.verify_error", {
      orderId: order.id,
      error: (err as Error).message,
    });
    return redirect(`/cards/orders?status=retry`);
  }

  if (verification.status !== "verified") {
    await db
      .update(cardOrders)
      .set({ status: "cancelled" })
      .where(eq(cardOrders.id, order.id));
    return redirect(`/cards/orders?status=failed`);
  }

  await db
    .update(cardOrders)
    .set({
      status: "paid",
      paymentRefId: verification.refId,
      paidAt: new Date(),
    })
    .where(eq(cardOrders.id, order.id));

  log.info("card_order.paid", {
    orderId: order.id,
    refId: verification.refId,
  });

  // Best-effort: grant the buyer a free plan year (Phase 5). Never blocks the
  // success redirect; idempotent on the order id.
  try {
    await grantPlanYearForCardPurchase(order.id);
  } catch (err) {
    log.warn("card_order.plan_grant_failed", {
      orderId: order.id,
      error: (err as Error).message,
    });
  }

  return redirect(`/cards/orders?placed=${order.id}&ref=${verification.refId}`);
}
