/**
 * Phase 7 — subscription state machine.
 *
 * `transitionForToday(now)` is the only entry point. It walks every
 * non-Free `page_subscriptions` row in `(active, trialing,
 * pending_renewal, grace)` and decides which transition events fire on
 * the calendar day represented by `now`. Pure read+decide logic lives in
 * `evaluateTransitions`; side effects (DB mutation, invoice generation,
 * SMS enqueue, entitlement rebuild) live in `applyTransition`.
 *
 * Idempotency model
 * -----------------
 *
 * Each transition is keyed by `(pageId, transitionType, keyDate)`:
 *
 *   - keyDate is a `date` derived from a subscription column
 *     (trial_ends_at::date or current_period_end::date) — never from
 *     `now()`. This collapses time-of-day into a single per-day claim.
 *   - The `billing_transitions_log` PK + ON CONFLICT DO NOTHING is the
 *     per-transition lock. If a competing worker already inserted the
 *     row, our INSERT returns 0 rows and we skip the side effects.
 *   - The cron route also takes a `pg_advisory_lock` to serialize the
 *     scan itself (so we don't waste IO on twin scans), but per-row
 *     idempotency is what guarantees correctness if the lock ever races.
 *
 * Transitions
 * -----------
 *
 *   trial_ending_in_3d            SMS reminder.
 *   trial_ending_today            Generate unpaid invoice + SMS.
 *   period_ending_in_5d / _1d     SMS reminders for paid renewal.
 *   period_ended_to_grace         status='grace' (kept on plan, no entitlement
 *                                  change yet — Free perks won't kick in until
 *                                  expiry); enqueue grace_period_started SMS.
 *   grace_ended_to_expired        status='expired', plan→Free, sentinel period
 *                                  end, rebuildEntitlements, SMS expired.
 *   cancel_at_period_end_applied  cancelAtPeriodEnd=true at period boundary →
 *                                  status='canceled', plan→Free, sentinel,
 *                                  rebuildEntitlements, SMS cancellation.
 *   pending_plan_change_applied   pendingPlanChangePlanId set + boundary
 *                                  reached, downgrade-to-free path: switch
 *                                  plan to free, status='active', sentinel,
 *                                  rebuildEntitlements, SMS plan_changed.
 *
 * Free-plan filtering
 * -------------------
 *
 * Free subscriptions use a `now() + 100 years` sentinel for
 * `current_period_end` (see drizzle/0017 header). The query below
 * excludes them with `plans.key <> 'free'` so the sentinel never trips a
 * spurious transition.
 *
 * Money
 * -----
 *
 * The trial-end invoice uses the same `computeBillingTotals` +
 * `allocateInvoiceNumber` helpers as the checkout route. We do NOT call
 * Zarinpal — the invoice sits `unpaid` until the user manually pays it
 * via the dashboard (Phase 9/12). The cron is intentionally never the
 * code path that talks to a payment gateway.
 */

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  billingTransitionsLog,
  invoices,
  pageSubscriptions,
  plans as plansTable,
} from "@/db/schema";
import { getAllSettings } from "@/lib/app-settings";
import {
  computeBillingTotals,
  computePeriodEnd,
  type BillingCycle,
} from "@/lib/billing-pricing";
import { rebuildEntitlements } from "@/lib/entitlements";
import { allocateInvoiceNumber } from "@/lib/invoice-numbering";
import { invalidateProfileCacheById } from "@/lib/cache/profile-cache";
import { log } from "@/lib/log";
import { enqueueSms, type SmsTemplateKey } from "@/lib/sms-queue";

/**
 * Compile-time fallback when no config is passed (tests, ad-hoc calls).
 * Production callers go through `transitionForToday` which loads the
 * runtime config from `app_settings`.
 */
export const GRACE_PERIOD_DAYS = 7;
/** Days before `current_period_end` at which paid-renewal SMS reminders fire. */
export const PERIOD_REMINDER_OFFSETS_DAYS: readonly number[] = [5, 1];
/** Days before `trial_ends_at` at which the trial-ending reminder fires. */
export const TRIAL_REMINDER_OFFSET_DAYS = 3;

export type BillingConfig = {
  gracePeriodDays: number;
  periodReminderOffsetsDays: readonly number[];
  trialReminderOffsetDays: number;
  vatRate: number;
};

const DEFAULT_CONFIG: BillingConfig = {
  gracePeriodDays: GRACE_PERIOD_DAYS,
  periodReminderOffsetsDays: PERIOD_REMINDER_OFFSETS_DAYS,
  trialReminderOffsetDays: TRIAL_REMINDER_OFFSET_DAYS,
  vatRate: 0,
};

async function loadBillingConfig(): Promise<BillingConfig> {
  const s = await getAllSettings();
  return {
    gracePeriodDays: s["billing.grace_period_days"],
    periodReminderOffsetsDays: s["billing.reminder_offsets_days"],
    trialReminderOffsetDays: s["billing.trial_reminder_offset_days"],
    vatRate: s["billing.vat_rate"],
  };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TransitionType =
  | "trial_ending_in_3d"
  | "trial_ending_today"
  | "period_ending_in_5d"
  | "period_ending_in_1d"
  | "period_ended_to_grace"
  | "grace_ended_to_expired"
  | "cancel_at_period_end_applied"
  | "pending_plan_change_applied";

export type AppliedTransition = {
  pageId: string;
  type: TransitionType;
  keyDate: string; // ISO yyyy-mm-dd
};

export type TransitionForTodayResult = {
  scanned: number;
  applied: AppliedTransition[];
  skipped: AppliedTransition[];
  errors: { pageId: string; type: TransitionType; error: string }[];
};

type SubRow = {
  id: string;
  pageId: string;
  planId: string;
  billingCycle: BillingCycle;
  status:
    | "active"
    | "trialing"
    | "pending_renewal"
    | "grace"
    | "expired"
    | "canceled";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanChangePlanId: string | null;
  planKey: "free" | "pro" | "business";
  planNameFa: string;
  priceMonthlyToman: number;
  priceAnnualToman: number;
  userId: string;
  phone: string;
};

type CandidateTransition = {
  type: TransitionType;
  keyDate: Date;
};

function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function isoDate(d: Date): string {
  return utcDayStart(d).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (negative if `to < from`). */
function diffDays(from: Date, to: Date): number {
  const ms = utcDayStart(to).getTime() - utcDayStart(from).getTime();
  return Math.round(ms / MS_PER_DAY);
}

/**
 * Pure decision function. Given a subscription row + an instant, return
 * the list of transitions that should fire today. Stateless — does not
 * read the idempotency log; the caller is responsible for claiming each
 * transition row. Exported for unit testing.
 */
export function evaluateTransitions(
  sub: SubRow,
  now: Date,
  config: BillingConfig = DEFAULT_CONFIG,
): CandidateTransition[] {
  const out: CandidateTransition[] = [];

  // ---- Trialing branch ------------------------------------------------
  if (sub.status === "trialing" && sub.trialEndsAt) {
    const daysUntilTrialEnd = diffDays(now, sub.trialEndsAt);

    if (daysUntilTrialEnd === config.trialReminderOffsetDays) {
      out.push({ type: "trial_ending_in_3d", keyDate: sub.trialEndsAt });
    }
    if (daysUntilTrialEnd === 0) {
      out.push({ type: "trial_ending_today", keyDate: sub.trialEndsAt });
    }
    // Trial fully elapsed: transition off trialing.
    if (now >= sub.trialEndsAt) {
      // Order matters: we evaluate cancel + pending-change first so a
      // user who scheduled "downgrade at trial end" doesn't dip through
      // grace.
      if (sub.cancelAtPeriodEnd) {
        out.push({
          type: "cancel_at_period_end_applied",
          keyDate: sub.trialEndsAt,
        });
      } else if (sub.pendingPlanChangePlanId) {
        out.push({
          type: "pending_plan_change_applied",
          keyDate: sub.trialEndsAt,
        });
      } else {
        out.push({
          type: "period_ended_to_grace",
          keyDate: sub.trialEndsAt,
        });
      }
    }
    return out;
  }

  // ---- Paid (active / pending_renewal) branch -------------------------
  if (sub.status === "active" || sub.status === "pending_renewal") {
    const daysUntilEnd = diffDays(now, sub.currentPeriodEnd);

    if (
      daysUntilEnd > 0 &&
      config.periodReminderOffsetsDays.includes(daysUntilEnd)
    ) {
      // Map offset → existing transition type. We keep two specific
      // transitions (5d / 1d) so the idempotency log keys remain stable
      // and the SMS template keys (`renewal_reminder_5d` / `_1d`) line
      // up. Any offset outside {5,1} is silently ignored — admins who
      // want a 7d reminder need a new transition + SMS template first.
      if (daysUntilEnd === 5) {
        out.push({
          type: "period_ending_in_5d",
          keyDate: sub.currentPeriodEnd,
        });
      } else if (daysUntilEnd === 1) {
        out.push({
          type: "period_ending_in_1d",
          keyDate: sub.currentPeriodEnd,
        });
      }
    }
    if (now >= sub.currentPeriodEnd) {
      if (sub.cancelAtPeriodEnd) {
        out.push({
          type: "cancel_at_period_end_applied",
          keyDate: sub.currentPeriodEnd,
        });
      } else if (sub.pendingPlanChangePlanId) {
        out.push({
          type: "pending_plan_change_applied",
          keyDate: sub.currentPeriodEnd,
        });
      } else {
        out.push({
          type: "period_ended_to_grace",
          keyDate: sub.currentPeriodEnd,
        });
      }
    }
    return out;
  }

  // ---- Grace branch ---------------------------------------------------
  if (sub.status === "grace") {
    const daysSinceEnd = diffDays(sub.currentPeriodEnd, now);
    if (daysSinceEnd >= config.gracePeriodDays) {
      out.push({
        type: "grace_ended_to_expired",
        keyDate: sub.currentPeriodEnd,
      });
    }
    return out;
  }

  return out;
}

/**
 * Cron entry point. Loads candidates, evaluates each, and applies fired
 * transitions inside per-transition transactions so a single bad row
 * cannot poison the whole run.
 */
export async function transitionForToday(
  now: Date = new Date(),
): Promise<TransitionForTodayResult> {
  const db = getDb();
  const config = await loadBillingConfig();

  // Resolve the Free plan once — needed for downgrade-to-free targets.
  const freePlan = await db.query.plans.findFirst({
    where: eq(plansTable.key, "free"),
  });
  if (!freePlan) {
    throw new Error("billing-state: free plan missing from registry");
  }

  // We pull only what we need; joining `users` for phone keeps the SMS
  // enqueue inside the same TX without a follow-up lookup.
  //
  // Phase 5: LEFT JOIN `subscription_price_locks` and let the lock's
  // prices win when present. This keeps the trial-end invoice and any
  // other price-derived field consistent with the rest of the renewal
  // pipeline.
  const rows = (await db.execute(sql`
    SELECT
      s."id"                              AS "id",
      s."page_id"                         AS "pageId",
      s."plan_id"                         AS "planId",
      s."billing_cycle"                   AS "billingCycle",
      s."status"                          AS "status",
      s."current_period_start"            AS "currentPeriodStart",
      s."current_period_end"              AS "currentPeriodEnd",
      s."trial_ends_at"                   AS "trialEndsAt",
      s."cancel_at_period_end"            AS "cancelAtPeriodEnd",
      s."pending_plan_change_plan_id"     AS "pendingPlanChangePlanId",
      p."key"                             AS "planKey",
      p."name_fa"                         AS "planNameFa",
      coalesce(l."locked_monthly_toman", p."price_monthly_toman")
                                          AS "priceMonthlyToman",
      coalesce(l."locked_annual_toman", p."price_annual_toman")
                                          AS "priceAnnualToman",
      pr."user_id"                        AS "userId",
      u."phone"                           AS "phone"
    FROM "page_subscriptions" s
    JOIN "plans"    p  ON p."id"  = s."plan_id"
    JOIN "profiles" pr ON pr."id" = s."page_id"
    JOIN "users"    u  ON u."id"  = pr."user_id"
    LEFT JOIN "subscription_price_locks" l
      ON l."page_id" = s."page_id" AND l."plan_id" = s."plan_id"
    WHERE s."plan_key" <> 'free'
      AND s."status" IN ('active','trialing','pending_renewal','grace')
  `)) as unknown as SubRow[];

  const result: TransitionForTodayResult = {
    scanned: rows.length,
    applied: [],
    skipped: [],
    errors: [],
  };

  for (const sub of rows) {
    const candidates = evaluateTransitions(sub, now, config);
    for (const c of candidates) {
      try {
        const fired = await applyTransition(sub, c, now, freePlan.id, config);
        const entry: AppliedTransition = {
          pageId: sub.pageId,
          type: c.type,
          keyDate: isoDate(c.keyDate),
        };
        if (fired) {
          result.applied.push(entry);
          // Plan/entitlement changes happen inside `applyTransition`. The
          // public page renderer's view depends on entitlements, so drop
          // the cache here so the next visit reflects the new state
          // instead of waiting for the 5-min TTL. SMS-only transitions
          // (reminders, no plan change) also flow through here — the
          // extra DEL is cheap (O(1) Redis op) and keeps the rule
          // simple: "every fired transition invalidates".
          await invalidateProfileCacheById(sub.pageId);
        } else {
          result.skipped.push(entry);
        }
      } catch (err) {
        log.error("billing.cron.transition_failed", {
          pageId: sub.pageId,
          type: c.type,
          error: (err as Error).message,
        });
        result.errors.push({
          pageId: sub.pageId,
          type: c.type,
          error: (err as Error).message,
        });
      }
    }
  }

  return result;
}

/**
 * Claim the transition's idempotency row, then apply side effects in the
 * same TX. Returns true if we fired, false if a previous run already did.
 */
async function applyTransition(
  sub: SubRow,
  candidate: CandidateTransition,
  now: Date,
  freePlanId: string,
  config: BillingConfig,
): Promise<boolean> {
  const db = getDb();
  const keyDateStr = isoDate(candidate.keyDate);

  return await db.transaction(async (tx) => {
    // Claim. ON CONFLICT DO NOTHING returns zero rows when another
    // worker beat us to it; we abort cleanly with no side effects.
    const claimRows = (await tx.execute(sql`
      INSERT INTO "billing_transitions_log"
        ("page_id", "transition_type", "key_date", "metadata")
      VALUES (
        ${sub.pageId}::uuid,
        ${candidate.type},
        ${keyDateStr}::date,
        ${JSON.stringify({
          subscriptionId: sub.id,
          status: sub.status,
          planKey: sub.planKey,
          billingCycle: sub.billingCycle,
        })}::jsonb
      )
      ON CONFLICT ("page_id", "transition_type", "key_date") DO NOTHING
      RETURNING 1 AS "claimed"
    `)) as unknown as Array<{ claimed: number }>;

    if (claimRows.length === 0) {
      return false;
    }

    switch (candidate.type) {
      case "trial_ending_in_3d": {
        await enqueueSms({
          templateKey: "trial_ending_soon",
          phone: sub.phone,
          idempotencyKey: `trial_ending_soon:${sub.id}:${keyDateStr}`,
          variables: {
            plan: sub.planNameFa,
            daysLeft: config.trialReminderOffsetDays,
          },
        });
        return true;
      }

      case "trial_ending_today": {
        // Generate the unpaid invoice the user will be asked to pay to
        // continue on the paid plan. The user is NOT charged
        // automatically (no auto-charge per product rules); they pay it
        // via the dashboard before grace ends.
        const totals = computeBillingTotals({
          plan: {
            priceMonthlyToman: sub.priceMonthlyToman,
            priceAnnualToman: sub.priceAnnualToman,
          },
          billingCycle: sub.billingCycle,
          discountAmountToman: 0,
          vatRate: config.vatRate,
        });

        const { number } = await allocateInvoiceNumber(tx, now);
        const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        await tx.insert(invoices).values({
          number,
          userId: sub.userId,
          pageId: sub.pageId,
          planId: sub.planId,
          billingCycle: sub.billingCycle,
          subtotalToman: totals.subtotalToman,
          discountAmountToman: totals.discountAmountToman,
          vatToman: totals.vatToman,
          totalToman: totals.totalToman,
          status: "unpaid",
          dueAt,
          metadata: {
            source: "trial_ending_today",
            subscriptionId: sub.id,
          },
        });

        await enqueueSms({
          templateKey: "trial_ended_invoice_due",
          phone: sub.phone,
          idempotencyKey: `trial_ended_invoice_due:${sub.id}:${keyDateStr}`,
          variables: {
            plan: sub.planNameFa,
            invoice: number,
            amount: totals.totalToman,
          },
        });
        return true;
      }

      case "period_ending_in_5d":
      case "period_ending_in_1d": {
        const daysLeft = candidate.type === "period_ending_in_5d" ? 5 : 1;
        const templateKey: SmsTemplateKey =
          daysLeft === 5 ? "renewal_reminder_5d" : "renewal_reminder_1d";
        await enqueueSms({
          templateKey,
          phone: sub.phone,
          idempotencyKey: `${templateKey}:${sub.id}:${keyDateStr}`,
          variables: {
            plan: sub.planNameFa,
            daysLeft,
          },
        });
        return true;
      }

      case "period_ended_to_grace": {
        // For a trialing sub, anchor `current_period_end` to
        // `trial_ends_at` so the grace window is computed off a single
        // column going forward.
        await tx
          .update(pageSubscriptions)
          .set({
            status: "grace",
            currentPeriodEnd:
              sub.status === "trialing" && sub.trialEndsAt
                ? sub.trialEndsAt
                : sub.currentPeriodEnd,
          })
          .where(eq(pageSubscriptions.id, sub.id));

        await enqueueSms({
          templateKey: "grace_period_started",
          phone: sub.phone,
          idempotencyKey: `grace_period_started:${sub.id}:${keyDateStr}`,
          variables: {
            plan: sub.planNameFa,
            graceDays: config.gracePeriodDays,
          },
        });
        return true;
      }

      case "grace_ended_to_expired": {
        // Drop to Free. Sentinel period_end matches the convention from
        // 0017 so the cron never picks this row up again.
        const sentinel = computeFreePlanSentinel(now);
        await tx
          .update(pageSubscriptions)
          .set({
            planId: freePlanId,
            planKey: "free",
            billingCycle: "monthly",
            status: "expired",
            currentPeriodStart: now,
            currentPeriodEnd: sentinel,
            trialEndsAt: null,
            cancelAtPeriodEnd: false,
            pendingPlanChangePlanId: null,
          })
          .where(eq(pageSubscriptions.id, sub.id));

        await rebuildEntitlements(tx, sub.pageId);

        await enqueueSms({
          templateKey: "subscription_expired",
          phone: sub.phone,
          idempotencyKey: `subscription_expired:${sub.id}:${keyDateStr}`,
          variables: { plan: sub.planNameFa },
        });
        return true;
      }

      case "cancel_at_period_end_applied": {
        const sentinel = computeFreePlanSentinel(now);
        await tx
          .update(pageSubscriptions)
          .set({
            planId: freePlanId,
            planKey: "free",
            billingCycle: "monthly",
            status: "canceled",
            currentPeriodStart: now,
            currentPeriodEnd: sentinel,
            trialEndsAt: null,
            cancelAtPeriodEnd: false,
            pendingPlanChangePlanId: null,
          })
          .where(eq(pageSubscriptions.id, sub.id));

        await rebuildEntitlements(tx, sub.pageId);

        await enqueueSms({
          templateKey: "cancellation_confirmed",
          phone: sub.phone,
          idempotencyKey: `cancellation_confirmed:${sub.id}:${keyDateStr}`,
          variables: { plan: sub.planNameFa },
        });
        return true;
      }

      case "pending_plan_change_applied": {
        // Only the downgrade-to-Free case can be applied without a fresh
        // payment. Upgrades to a paid plan require the user to pay an
        // invoice — those are handled by the checkout/callback path,
        // not here. If a paid pending change reaches us, treat it as a
        // grace transition and let the user's next checkout sort it
        // out (still log the transition so we don't loop).
        if (sub.pendingPlanChangePlanId === freePlanId) {
          const sentinel = computeFreePlanSentinel(now);
          await tx
            .update(pageSubscriptions)
            .set({
              planId: freePlanId,
              planKey: "free",
              billingCycle: "monthly",
              status: "active",
              currentPeriodStart: now,
              currentPeriodEnd: sentinel,
              trialEndsAt: null,
              cancelAtPeriodEnd: false,
              pendingPlanChangePlanId: null,
            })
            .where(eq(pageSubscriptions.id, sub.id));

          await rebuildEntitlements(tx, sub.pageId);

          await enqueueSms({
            templateKey: "plan_changed",
            phone: sub.phone,
            idempotencyKey: `plan_changed:${sub.id}:${keyDateStr}`,
            variables: {
              plan: "Free",
            },
          });
        } else {
          // Paid pending change at a boundary the user didn't pay
          // through: drop to grace and clear the pending intent so the
          // user can re-elect from billing settings.
          await tx
            .update(pageSubscriptions)
            .set({
              status: "grace",
              pendingPlanChangePlanId: null,
            })
            .where(eq(pageSubscriptions.id, sub.id));

          await enqueueSms({
            templateKey: "grace_period_started",
            phone: sub.phone,
            idempotencyKey: `grace_period_started:${sub.id}:${keyDateStr}`,
            variables: {
              plan: sub.planNameFa,
              graceDays: config.gracePeriodDays,
            },
          });
        }
        return true;
      }
    }

    return true;
  });
}

/**
 * Mirror the 100-year `current_period_end` sentinel used on Free plans
 * (see drizzle/0017 header). Computed in JS so we don't have to pass
 * `tx` here just to call `now() + interval '100 years'`.
 */
function computeFreePlanSentinel(now: Date): Date {
  // Reuse `computePeriodEnd` semantics so any future change to period
  // arithmetic stays in one place. 100 calendar years is the
  // documented sentinel; nothing depends on the exact value past
  // "way in the future".
  let d = now;
  for (let i = 0; i < 100; i++) {
    d = computePeriodEnd(d, "annual");
  }
  return d;
}
