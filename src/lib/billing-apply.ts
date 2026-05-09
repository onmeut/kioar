/**
 * Phase 9 — shared "verified payment → subscription advance" applier.
 *
 * Extracted from `/api/billing/callback` so that admin test tools (and
 * future webhooks / replays) can re-use the exact same atomic apply
 * without copy-pasting the TX. The callback route now becomes a thin
 * shell: validate → verify on Zarinpal → call `applyVerifiedPayment`.
 *
 * Inputs: a verified `payments` row, its `invoices` row, and the plan.
 * The verify side-effects (network call to Zarinpal) live in the caller
 * because we don't want this helper to take a network dependency.
 *
 * The function performs:
 *   1. Mark `payments` verified (idempotent: caller skips if already).
 *   2. Mark `invoices` paid.
 *   3. Advance `page_subscriptions` (plan, cycle, period, clear pending).
 *      For a `kind: "proration"` invoice, the existing period end is
 *      preserved — the user already paid for that period.
 *   4. Rebuild entitlements.
 *
 * SMS / referral hooks remain in the callback (best-effort, outside TX).
 */
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  invoices as invoicesTable,
  pageSubscriptions,
  payments as paymentsTable,
} from "@/db/schema";

type Invoice = typeof invoicesTable.$inferSelect;
type Payment = typeof paymentsTable.$inferSelect;
import { computePeriodEnd } from "@/lib/billing-pricing";
import { invalidateProfileCacheById } from "@/lib/cache/profile-cache";
import { rebuildEntitlements } from "@/lib/entitlements";
import { log } from "@/lib/log";

export type ApplyVerifiedPaymentInput = {
  payment: Pick<Payment, "id" | "invoiceId">;
  invoice: Pick<
    Invoice,
    "id" | "pageId" | "planId" | "billingCycle" | "metadata"
  >;
  /** Denormalized plan key — written to page_subscriptions.plan_key. */
  planKey: string;
  refId: string;
  rawResponse: Record<string, unknown>;
  now?: Date;
};

export type ApplyVerifiedPaymentResult = {
  pageId: string;
  newPeriodStart: Date;
  newPeriodEnd: Date;
};

export async function applyVerifiedPayment(
  input: ApplyVerifiedPaymentInput,
): Promise<ApplyVerifiedPaymentResult> {
  const startedAt = Date.now();
  const db = getDb();
  const now = input.now ?? new Date();
  const { payment, invoice, refId, rawResponse, planKey } = input;

  log.info("billing.apply.start", {
    invoiceId: invoice.id,
    pageId: invoice.pageId,
    planId: invoice.planId,
    planKey,
    billingCycle: invoice.billingCycle,
    paymentId: payment.id,
  });

  // Proration invoices preserve the user's already-paid period.
  const meta = (invoice.metadata ?? {}) as Record<string, unknown>;
  const isProration = meta.kind === "proration";
  const preservedStart =
    isProration && typeof meta.currentPeriodStart === "string"
      ? new Date(meta.currentPeriodStart)
      : null;
  const preservedEnd =
    isProration && typeof meta.currentPeriodEnd === "string"
      ? new Date(meta.currentPeriodEnd)
      : null;

  const newPeriodStart =
    preservedStart && !Number.isNaN(preservedStart.getTime())
      ? preservedStart
      : now;
  const newPeriodEnd =
    preservedEnd && !Number.isNaN(preservedEnd.getTime())
      ? preservedEnd
      : computePeriodEnd(now, invoice.billingCycle);

  await db.transaction(async (tx) => {
    await tx
      .update(paymentsTable)
      .set({
        status: "verified",
        refId,
        verifiedAt: now,
        rawResponse,
        updatedAt: now,
      })
      .where(eq(paymentsTable.id, payment.id));

    await tx
      .update(invoicesTable)
      .set({ status: "paid", paidAt: now })
      .where(eq(invoicesTable.id, invoice.id));

    await tx
      .update(pageSubscriptions)
      .set({
        planId: invoice.planId,
        planKey,
        billingCycle: invoice.billingCycle,
        status: "active",
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        cancelAtPeriodEnd: false,
        pendingPlanChangePlanId: null,
      })
      .where(eq(pageSubscriptions.pageId, invoice.pageId));

    await rebuildEntitlements(tx, invoice.pageId);
  });

  // Plan changed → entitlement set changed → the public page may now
  // render booking/form/product blocks that were previously hidden
  // (or vice versa). Drop the cache so the next visit reflects reality.
  await invalidateProfileCacheById(invoice.pageId);

  log.info("billing.apply.ok", {
    invoiceId: invoice.id,
    pageId: invoice.pageId,
    planKey,
    newPeriodStart: newPeriodStart.toISOString(),
    newPeriodEnd: newPeriodEnd.toISOString(),
    durationMs: Date.now() - startedAt,
  });

  return {
    pageId: invoice.pageId,
    newPeriodStart,
    newPeriodEnd,
  };
}
