/**
 * `POST /api/cards/checkout` — initiate a physical card order.
 *
 * Body (JSON):
 *   {
 *     "pageId":     uuid,                  // page the card points to (must be owned)
 *     "material":   "colorful" | "metal",
 *     "color":      string,               // must be an available color for the material
 *     "nameOnCard": string,               // Latin name printed on the card
 *     "province":   string,
 *     "city":       string,
 *     "address":    string,
 *     "postalCode": string,
 *     "entitlementId": uuid               // optional — redeem a free gift card
 *   }
 *
 * Two paths, mirroring `/api/billing/checkout`:
 *   - Free redemption (entitlementId present + valid + unredeemed) → create a
 *     `card_orders` row already `paid`, mark the entitlement redeemed, return a
 *     redirect to the orders page. No Zarinpal.
 *   - Paid purchase → create a `pending_payment` order carrying the Zarinpal
 *     `authority`, return the gateway redirect URL. The callback verifies.
 *
 * Card orders are intentionally decoupled from `invoices` — they are not plan
 * purchases. Pricing/colors/materials come from `app_settings` (no hardcoding).
 */
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { cardEntitlements, cardOrders } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { getCardStudioSettings } from "@/lib/cards/settings";
import { isValidProvince } from "@/lib/cards/iran-geo";
import { log } from "@/lib/log";
import { getOwnedPageById } from "@/lib/pages";
import { absoluteUrl } from "@/lib/site";
import { requestPayment } from "@/lib/zarinpal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pageId: z.string().uuid(),
  material: z.enum(["colorful", "metal"]),
  color: z.string().trim().min(1).max(40),
  nameOnCard: z.string().trim().min(1).max(40),
  province: z.string().trim().min(1).max(40),
  city: z.string().trim().min(1).max(60),
  address: z.string().trim().min(5).max(400),
  postalCode: z.string().trim().regex(/^\d{10}$/, "postal code must be 10 digits"),
  entitlementId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const viewer = await requireUser();

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_body", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const page = await getOwnedPageById(parsed.pageId, viewer.user.id);
  if (!page) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!isValidProvince(parsed.province)) {
    return NextResponse.json({ error: "invalid_province" }, { status: 400 });
  }

  const settings = await getCardStudioSettings();

  if (!settings.materialEnabled[parsed.material]) {
    return NextResponse.json({ error: "material_unavailable" }, { status: 400 });
  }

  // Color must be in the available set for the material.
  const validColor = settings.colors[parsed.material].some(
    (c) => c.value === parsed.color,
  );
  if (!validColor) {
    return NextResponse.json({ error: "invalid_color" }, { status: 400 });
  }

  const db = getDb();

  // ---- Free gift-card redemption ------------------------------------------
  if (parsed.entitlementId) {
    const ent = await db.query.cardEntitlements.findFirst({
      where: and(
        eq(cardEntitlements.id, parsed.entitlementId),
        eq(cardEntitlements.userId, viewer.user.id),
      ),
    });
    if (!ent || ent.redeemedAt) {
      return NextResponse.json(
        { error: "entitlement_unavailable" },
        { status: 400 },
      );
    }
    // The redeemed material is fixed by the entitlement (Pro→colorful, etc).
    if (ent.material !== parsed.material) {
      return NextResponse.json(
        { error: "material_mismatch" },
        { status: 400 },
      );
    }

    const order = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(cardOrders)
        .values({
          pageId: page.id,
          userId: viewer.user.id,
          color: parsed.color,
          material: parsed.material,
          nameOnCard: parsed.nameOnCard,
          province: parsed.province,
          city: parsed.city,
          address: parsed.address,
          postalCode: parsed.postalCode,
          status: "paid",
          source: ent.source,
          amountToman: 0,
          paidAt: new Date(),
        })
        .returning({ id: cardOrders.id });

      // Mark the entitlement redeemed — guard on still-unredeemed so a
      // double-submit can't redeem twice.
      const redeemed = await tx
        .update(cardEntitlements)
        .set({ redeemedAt: new Date(), redeemedOrderId: created!.id })
        .where(
          and(
            eq(cardEntitlements.id, ent.id),
            isNull(cardEntitlements.redeemedAt),
          ),
        )
        .returning({ id: cardEntitlements.id });

      if (redeemed.length === 0) {
        // Lost the race — roll back the order.
        throw new Error("entitlement_already_redeemed");
      }
      return created!;
    });

    log.info("card_order.gift_redeemed", {
      orderId: order.id,
      pageId: page.id,
      entitlementId: ent.id,
    });

    return NextResponse.json({
      ok: true,
      free: true,
      redirectUrl: absoluteUrl(`/cards/orders?placed=${order.id}`),
    });
  }

  // ---- Paid purchase ------------------------------------------------------
  const amountToman = settings.prices[parsed.material];
  if (!amountToman || amountToman <= 0) {
    return NextResponse.json({ error: "price_unavailable" }, { status: 400 });
  }

  // Create the pending order first so the callback always has a row.
  const order = await db
    .insert(cardOrders)
    .values({
      pageId: page.id,
      userId: viewer.user.id,
      color: parsed.color,
      material: parsed.material,
      nameOnCard: parsed.nameOnCard,
      province: parsed.province,
      city: parsed.city,
      address: parsed.address,
      postalCode: parsed.postalCode,
      status: "pending_payment",
      source: "purchased",
      amountToman,
    })
    .returning({ id: cardOrders.id });

  const orderId = order[0]!.id;

  // Test mode: on localhost, skip the payment gateway and mark the order paid
  // immediately. Never runs in production (NODE_ENV check + no ZARINPAL_MERCHANT).
  const isLocalhost =
    process.env.NODE_ENV === "development" &&
    !process.env.ZARINPAL_MERCHANT_ID;
  if (isLocalhost) {
    await db
      .update(cardOrders)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(cardOrders.id, orderId));
    log.info("card_order.test_mode_paid", { orderId });
    return NextResponse.json({
      ok: true,
      free: false,
      redirectUrl: absoluteUrl(`/cards/orders?placed=${orderId}`),
    });
  }

  let zarinpal;
  try {
    zarinpal = await requestPayment({
      amountToman,
      callbackUrl: absoluteUrl(`/api/cards/callback?order=${orderId}`),
      description: `کارت ${parsed.material === "metal" ? "فلزی" : "رنگی"} کی‌یو‌آر`,
      mobile: viewer.user.phone.startsWith("98")
        ? `0${viewer.user.phone.slice(2)}`
        : viewer.user.phone,
      metadata: { card_order: orderId, page_id: page.id },
    });
  } catch (err) {
    log.warn("card_order.zarinpal_request_failed", {
      orderId,
      error: (err as Error).message,
    });
    await db
      .update(cardOrders)
      .set({ status: "cancelled" })
      .where(eq(cardOrders.id, orderId));
    return NextResponse.json({ error: "gateway_unavailable" }, { status: 502 });
  }

  // Persist the authority on the order (the order IS the payment record here).
  await db
    .update(cardOrders)
    .set({ paymentAuthority: zarinpal.authority })
    .where(eq(cardOrders.id, orderId));

  return NextResponse.json({
    ok: true,
    free: false,
    redirectUrl: zarinpal.redirectUrl,
  });
}
