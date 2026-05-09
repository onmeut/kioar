/**
 * Phase 6 — `GET /api/billing/callback`.
 *
 * Zarinpal redirects the user here after they complete (or cancel) at the
 * gateway. Query params:
 *
 *   ?invoice={uuid}      // we set this on `callback_url` at request time
 *   ?Authority={token}   // echoed by Zarinpal
 *   ?Status=OK|NOK       // user-facing outcome flag
 *
 * Idempotency:
 *   Zarinpal can hit this URL twice (user double-clicks, gateway retries).
 *   We resolve the `payments` row by `authority` (UNIQUE) and check its
 *   `status`:
 *     - `verified` ⇒ 2nd hit, no-op, redirect with `?already=1`.
 *     - `failed`   ⇒ no-op, redirect with `?status=failed`.
 *     - `initiated` ⇒ first hit, run verify + apply.
 *
 *   Verify itself is also idempotent on Zarinpal's side (code 101 = "already
 *   verified") so even if our `status` flip races with another callback, the
 *   gateway tells us so and we still finish the apply.
 *
 * On successful verify the entire apply runs in ONE transaction:
 *
 *   1. Flip payment to `verified` + capture `ref_id`.
 *   2. Flip invoice to `paid`.
 *   3. Advance `page_subscriptions` (planId, cycle, period start/end,
 *      clear `cancelAtPeriodEnd`, clear `pendingPlanChangePlanId`).
 *   4. Rebuild entitlements.
 *   5. Outside the TX (best-effort): enqueue `payment_received` SMS.
 */
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { invoices, payments, plans } from "@/db/schema";
import { applyVerifiedPayment } from "@/lib/billing-apply";
import { log } from "@/lib/log";
import { absoluteUrl } from "@/lib/site";
import { enqueueSms } from "@/lib/sms-queue";
import { verifyPayment } from "@/lib/zarinpal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(path: string) {
  return NextResponse.redirect(absoluteUrl(path));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const invoiceId = url.searchParams.get("invoice");
  const authority = url.searchParams.get("Authority");
  const gatewayStatus = url.searchParams.get("Status");

  if (!invoiceId || !authority) {
    return redirect("/dashboard?billing=invalid");
  }

  const db = getDb();

  const payment = await db.query.payments.findFirst({
    where: eq(payments.authority, authority),
  });
  if (!payment) {
    log.warn("billing.callback.unknown_authority", { authority, invoiceId });
    return redirect("/dashboard?billing=unknown");
  }

  // Already-applied: idempotent short-circuit. We still need the invoice
  // to build the dashboard redirect target, but no DB writes happen.
  if (payment.status === "verified") {
    const prior = await db.query.invoices.findFirst({
      where: eq(invoices.id, payment.invoiceId),
      columns: { pageId: true, number: true },
    });
    return redirect(
      prior
        ? `/dashboard/pages/${prior.pageId}/billing?paid=${prior.number}&already=1`
        : "/dashboard?billing=already",
    );
  }
  if (payment.status === "failed") {
    return redirect("/dashboard?billing=failed");
  }

  // User-cancel flag from Zarinpal. Mark failed and bail; do NOT call
  // verify (it will return a non-100/101 code anyway).
  if (gatewayStatus !== "OK") {
    await db
      .update(payments)
      .set({
        status: "failed",
        rawResponse: { gatewayStatus },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));
    return redirect("/dashboard?billing=cancelled");
  }

  // Verify on Zarinpal. Network failure here = bail; do NOT mark failed
  // because the user may legitimately retry the same authority later.
  let verifyResult;
  try {
    verifyResult = await verifyPayment({
      authority,
      amountToman: payment.amountToman,
    });
  } catch (err) {
    log.error("billing.callback.verify_threw", {
      authority,
      error: (err as Error).message,
    });
    return redirect("/dashboard?billing=retry");
  }

  if (verifyResult.status === "failed") {
    await db
      .update(payments)
      .set({
        status: "failed",
        rawResponse: verifyResult.raw as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));
    log.info("billing.callback.verify_failed", {
      authority,
      code: verifyResult.code,
      message: verifyResult.message,
    });
    return redirect("/dashboard?billing=failed");
  }

  // Verified — apply atomically.
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, payment.invoiceId),
  });
  if (!invoice) {
    log.error("billing.callback.invoice_missing", {
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
    });
    return redirect("/dashboard?billing=unknown");
  }

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, invoice.planId),
  });
  if (!plan) {
    log.error("billing.callback.plan_missing", {
      invoiceId: invoice.id,
      planId: invoice.planId,
    });
    return redirect("/dashboard?billing=unknown");
  }

  const now = new Date();
  const refId = verifyResult.refId;

  await applyVerifiedPayment({
    payment: { id: payment.id, invoiceId: payment.invoiceId },
    invoice: {
      id: invoice.id,
      pageId: invoice.pageId,
      planId: invoice.planId,
      billingCycle: invoice.billingCycle,
      metadata: invoice.metadata,
    },
    planKey: plan.key,
    refId,
    rawResponse: verifyResult.raw as Record<string, unknown>,
    now,
  });

  // Best-effort SMS — failures here MUST NOT roll back the apply.
  try {
    // Resolve owner phone for the SMS without blocking the redirect on a
    // join we already paid for at TX time. Cheap: indexed pk lookup.
    const owner = await db.query.users.findFirst({
      where: (u, { eq: eq2 }) => eq2(u.id, invoice.userId),
      columns: { phone: true },
    });
    if (owner?.phone) {
      await enqueueSms({
        templateKey: "payment_received",
        phone: owner.phone,
        idempotencyKey: `payment_received:${invoice.id}`,
        variables: {
          invoice: invoice.number,
          plan: plan.nameFa,
          ref: refId,
        },
      });

      // Phase 11 — confirm discount application after payment success.
      // Idempotent on the invoice id so a re-fired callback collapses.
      if (invoice.discountCodeId && invoice.discountAmountToman > 0) {
        await enqueueSms({
          templateKey: "discount_applied",
          phone: owner.phone,
          idempotencyKey: `discount_applied:${invoice.id}`,
          variables: {
            invoice: invoice.number,
            amount: invoice.discountAmountToman,
          },
        });
      }
    }
  } catch (err) {
    log.warn("billing.callback.sms_enqueue_failed", {
      invoiceId: invoice.id,
      error: (err as Error).message,
    });
  }

  // Referral conversion (best-effort, never blocks). Only proration-free
  // first conversions matter for reward issuance — the helper itself
  // is idempotent so re-firing is safe in any case.
  try {
    const { processReferralConversion, fireConversionNotifications } =
      await import("@/lib/referrals");
    const { getClientIp } = await import("@/lib/request-ip");
    const owner2 = await db.query.users.findFirst({
      where: (u, { eq: eq2 }) => eq2(u.id, invoice.userId),
      columns: { phone: true },
    });
    if (owner2?.phone) {
      const outcome = await processReferralConversion({
        refereeUserId: invoice.userId,
        refereePhone: owner2.phone,
        paidPageId: invoice.pageId,
        invoiceId: invoice.id,
        zarinpalRaw: verifyResult.raw as Record<string, unknown>,
        clientIp: await getClientIp(),
        billingCycle: invoice.billingCycle as "monthly" | "annual",
        netAmountToman: invoice.totalToman,
      });
      await fireConversionNotifications({
        outcome,
        refereePhone: owner2.phone,
        invoiceId: invoice.id,
      });
    }
  } catch (err) {
    log.warn("billing.callback.referral_hook_failed", {
      invoiceId: invoice.id,
      error: (err as Error).message,
    });
  }

  return redirect(
    `/dashboard/pages/${invoice.pageId}/billing?paid=${invoice.number}&ref=${refId}`,
  );
}
