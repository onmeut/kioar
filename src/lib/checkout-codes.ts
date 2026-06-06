/**
 * Phase 12+ — unified checkout code resolver.
 *
 * One module, one entry point: `resolveCheckoutCode()` takes a raw
 * code string typed at checkout and dispatches it into one of:
 *
 *   - `discount`  → admin-defined promotional code from
 *                   `discount_codes` (existing system, see
 *                   `lib/discounts.ts`).
 *   - `referral`  → regular user code from `referral_codes`
 *                   (`kind='user'`).
 *   - `affiliate` → approved-affiliate code from `referral_codes`
 *                   (`kind='affiliate'`).
 *   - `not_found` → no row matched in any namespace.
 *
 * The resolver MUST NOT scatter logic. For discount codes it calls
 * `validateDiscountCode()` directly. For referral / affiliate codes
 * it shares lookup with `/r/:code` (same `referral_codes` /
 * `referral_code_aliases` tables) and the same conversion downstream
 * logic (`processReferralConversion()` runs unchanged on the Zarinpal
 * callback).
 *
 * The companion helper `attributeReferralAtCheckout()` upserts the
 * `referrals` row for a logged-in user who typed a referral / affiliate
 * code at checkout, so cookie-based attribution (if any) is overridden
 * by the more deliberate manual entry.
 *
 * Money is integer toman throughout. No plan-name comparisons.
 *
 * Stable error codes (UI / tests pivot on these):
 *
 *   not_found           — no such code anywhere
 *   self_referral       — code belongs to the user typing it
 *   first_purchase_only — referral / affiliate codes only apply to a
 *                         user's first paid conversion
 *   affiliate_inactive  — affiliate code exists but is paused / banned
 *   (plus all `DiscountValidationError.errorCode` values when the code
 *    resolved to a discount)
 */
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import {
  affiliateProfiles,
  invoices,
  profiles,
  referralCodeAliases,
  referralCodes,
  referrals,
  users,
} from "@/db/schema";
import { log } from "@/lib/log";
import {
  validateDiscountCode,
  type DiscountValidationOk,
  type DiscountValidationError,
} from "@/lib/discounts";
import { computeBillingTotals } from "@/lib/billing-pricing";
import type { plans as plansTable } from "@/db/schema";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Db = ReturnType<typeof getDb>;
type Executor = Tx | Db;

export type CheckoutCodeInput = {
  code: string;
  userId: string;
  userPhone: string;
  pageId: string;
  planKey: "pro" | "business";
  billingCycle: "monthly" | "annual";
  /** Pre-VAT subtotal for the (plan, cycle) combo. */
  subtotalToman: number;
  plan: typeof plansTable.$inferSelect;
};

export type InviterDisplay = {
  name: string;
  channelKind?: string | null;
  avatarUrl?: string | null;
};

export type CheckoutCodeOk =
  | {
      ok: true;
      kind: "discount";
      code: string;
      nameFa: string;
      discountType: "percent" | "fixed_amount" | "free_months";
      freeMonths: number;
      subtotalToman: number;
      discountAmountToman: number;
      vatToman: number;
      totalToman: number;
    }
  | {
      ok: true;
      kind: "referral";
      code: string;
      referrerUserId: string;
      referralCodeId: string;
      inviter: InviterDisplay;
      /**
       * Whether attribution will actually be honored downstream. False
       * when the user has already had a paid conversion — show the
       * "fa: این کد فقط برای اولین خرید کاربران جدید است" copy.
       */
      eligible: boolean;
      ineligibleReason?: "first_purchase_only";
      /** Persian human-readable summary of the reward terms. */
      rewardSummaryFa: string;
    }
  | {
      ok: true;
      kind: "affiliate";
      code: string;
      affiliateUserId: string;
      referralCodeId: string;
      inviter: InviterDisplay;
      eligible: boolean;
      ineligibleReason?: "first_purchase_only";
      /** True when the user is currently on the monthly cycle —
       *  affiliate bonus only unlocks on annual. */
      monthlyCycleWarning: boolean;
      rewardSummaryFa: string;
    };

export type CheckoutCodeError = {
  ok: false;
  errorCode:
    | "not_found"
    | "self_referral"
    | "affiliate_inactive"
    | DiscountValidationError["errorCode"];
  message: string;
};

export type CheckoutCodeResult = CheckoutCodeOk | CheckoutCodeError;

const ERROR_MESSAGES_FA: Record<
  "not_found" | "self_referral" | "affiliate_inactive",
  string
> = {
  not_found: "کد یافت نشد.",
  self_referral: "نمی‌توانید از کد خودتان استفاده کنید.",
  affiliate_inactive: "این کد همکاری در حال حاضر فعال نیست.",
};

function err(
  errorCode: CheckoutCodeError["errorCode"],
  fallback?: string,
): CheckoutCodeError {
  const message =
    (errorCode in ERROR_MESSAGES_FA
      ? ERROR_MESSAGES_FA[errorCode as keyof typeof ERROR_MESSAGES_FA]
      : null) ??
    fallback ??
    "کد نامعتبر است.";
  return { ok: false, errorCode, message };
}

export function normalizeCheckoutCode(code: string): string {
  return code.trim().toLowerCase();
}

/**
 * Resolve a public referral / affiliate code (primary or alias) to its
 * canonical row. Mirrors the private helper in `lib/referrals.ts` but
 * is exported here so the checkout resolver can share namespace
 * lookups without duplicating SQL.
 */
async function resolveReferralCodeRow(
  exec: Executor,
  normalized: string,
): Promise<typeof referralCodes.$inferSelect | null> {
  if (!normalized) return null;
  const direct = await exec.query.referralCodes.findFirst({
    where: eq(referralCodes.codeNormalized, normalized),
  });
  if (direct) return direct;
  const alias = await exec.query.referralCodeAliases.findFirst({
    where: eq(referralCodeAliases.codeNormalized, normalized),
    columns: { referralCodeId: true },
  });
  if (!alias) return null;
  return (
    (await exec.query.referralCodes.findFirst({
      where: eq(referralCodes.id, alias.referralCodeId),
    })) ?? null
  );
}

/** Has this user ever had a paid invoice? Used for first-purchase gating. */
async function userHasPriorPaidConversion(
  exec: Executor,
  userId: string,
): Promise<boolean> {
  const prior = await exec.query.invoices.findFirst({
    where: and(eq(invoices.userId, userId), eq(invoices.status, "paid")),
    columns: { id: true },
  });
  return !!prior;
}

async function loadInviterDisplay(
  exec: Executor,
  code: typeof referralCodes.$inferSelect,
): Promise<InviterDisplay> {
  if (code.kind === "affiliate") {
    const profile = await exec.query.affiliateProfiles.findFirst({
      where: eq(affiliateProfiles.userId, code.userId),
      columns: { displayName: true, channelKind: true },
    });
    if (profile) {
      return {
        name: profile.displayName,
        channelKind: profile.channelKind,
        avatarUrl: null,
      };
    }
  }

  // User referral or affiliate without a profile row — fall back to
  // their primary page's full name / slug.
  const page = await exec.query.profiles.findFirst({
    where: eq(profiles.userId, code.userId),
    columns: { fullName: true, slug: true, avatarUrl: true },
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  });
  if (page) {
    return {
      name: page.fullName?.trim() || `@${page.slug}`,
      avatarUrl: page.avatarUrl,
    };
  }

  // Last-ditch: bare user phone (masked).
  const u = await exec.query.users.findFirst({
    where: eq(users.id, code.userId),
    columns: { phone: true },
  });
  return {
    name: u?.phone ? `••${u.phone.slice(-4)}` : "کاربر",
  };
}

function rewardSummary(args: {
  kind: "referral" | "affiliate";
  billingCycle: "monthly" | "annual";
  inviterName: string;
  eligible: boolean;
}): string {
  if (!args.eligible) return "این کد فقط برای اولین خرید کاربران جدید است.";
  if (args.kind === "referral") {
    if (args.billingCycle === "annual") {
      return `۳ ماه پرو رایگان با خرید سالانه — به‌مهمان ${args.inviterName}`;
    }
    return `۳ ماه پرو رایگان فقط روی پلن سالانه — به‌مهمان ${args.inviterName}`;
  }
  // affiliate
  if (args.billingCycle === "annual") {
    return `۳ ماه پرو رایگان با خرید سالانه — به‌مهمان ${args.inviterName}`;
  }
  return `۳ ماه پرو رایگان فقط روی پلن سالانه — به‌مهمان ${args.inviterName}`;
}

/**
 * Single source of truth for code resolution at checkout.
 *
 * Resolution order:
 *   1. Try `referral_codes` (primary + alias). If hit, branch on
 *      `kind` for user vs affiliate.
 *   2. Else try `discount_codes` via `validateDiscountCode()`.
 *   3. Else `not_found`.
 *
 * Referral collisions with admin-issued discount codes are theoretically
 * possible (4-letter random vs admin string) but rare; referral wins so
 * that 4-letter codes shared verbally always resolve consistently.
 */
export async function resolveCheckoutCode(
  input: CheckoutCodeInput,
): Promise<CheckoutCodeResult> {
  const db = getDb();
  const normalized = normalizeCheckoutCode(input.code);
  if (!normalized) return err("not_found");

  // 1. Referral / affiliate lookup.
  const refRow = await resolveReferralCodeRow(db, normalized);
  if (refRow) {
    // Self-referral (own code OR same-phone alt account guard).
    if (refRow.userId === input.userId) return err("self_referral");
    const owner = await db.query.users.findFirst({
      where: eq(users.id, refRow.userId),
      columns: { phone: true },
    });
    if (owner?.phone === input.userPhone) return err("self_referral");

    if (refRow.kind === "affiliate") {
      const status = (refRow.affiliateStatus ?? "active") as
        | "active"
        | "paused"
        | "banned";
      if (status !== "active") return err("affiliate_inactive");
    }

    const hadPrior = await userHasPriorPaidConversion(db, input.userId);
    const eligible = !hadPrior;
    const ineligibleReason = hadPrior
      ? ("first_purchase_only" as const)
      : undefined;

    const inviter = await loadInviterDisplay(db, refRow);

    if (refRow.kind === "affiliate") {
      return {
        ok: true,
        kind: "affiliate",
        code: refRow.code,
        affiliateUserId: refRow.userId,
        referralCodeId: refRow.id,
        inviter,
        eligible,
        ineligibleReason,
        monthlyCycleWarning: input.billingCycle === "monthly" && eligible,
        rewardSummaryFa: rewardSummary({
          kind: "affiliate",
          billingCycle: input.billingCycle,
          inviterName: inviter.name,
          eligible,
        }),
      };
    }
    return {
      ok: true,
      kind: "referral",
      code: refRow.code,
      referrerUserId: refRow.userId,
      referralCodeId: refRow.id,
      inviter,
      eligible,
      ineligibleReason,
      rewardSummaryFa: rewardSummary({
        kind: "referral",
        billingCycle: input.billingCycle,
        inviterName: inviter.name,
        eligible,
      }),
    };
  }

  // 2. Discount code fallback.
  const validation = await validateDiscountCode({
    code: input.code,
    userId: input.userId,
    pageId: input.pageId,
    planKey: input.planKey,
    billingCycle: input.billingCycle,
    subtotalToman: input.subtotalToman,
  });

  if (!validation.ok) {
    // Map all discount error codes through (already Persian-localized).
    return validation as CheckoutCodeError;
  }

  return discountToOk(validation, input);
}

function discountToOk(
  v: DiscountValidationOk,
  input: CheckoutCodeInput,
): CheckoutCodeOk {
  const totals = computeBillingTotals({
    plan: input.plan,
    billingCycle: input.billingCycle,
    discountAmountToman: v.discountAmountToman,
  });
  return {
    ok: true,
    kind: "discount",
    code: v.codeRow.code,
    nameFa: v.codeRow.nameFa,
    discountType: v.codeRow.discountType as
      | "percent"
      | "fixed_amount"
      | "free_months",
    freeMonths: v.freeMonths,
    subtotalToman: totals.subtotalToman,
    discountAmountToman: totals.discountAmountToman,
    vatToman: totals.vatToman,
    totalToman: totals.totalToman,
  };
}

// ---------------------------------------------------------------------------
// Manual referral attribution at checkout
// ---------------------------------------------------------------------------

export type AttributionOutcome =
  | { ok: true; attributed: true; replacedPrior: boolean }
  | { ok: true; attributed: false; reason: "ineligible" | "self_referral" }
  | { ok: false; errorCode: "not_found" | "affiliate_inactive" };

/**
 * Upsert a `referrals` row for the logged-in user, attributing them to
 * the referrer of `code`. This is the "manual entry overrides cookie"
 * path: any prior cookie-based attribution row for this user is updated
 * in-place, not stacked. Conversion downstream (the Zarinpal callback's
 * `processReferralConversion`) honors whichever code is on the row at
 * payment time.
 *
 * Idempotent and safe to call before the user actually pays — we only
 * write the attribution; the reward is gated on conversion.
 *
 * Errors are non-fatal for the caller: a `false` outcome means the
 * attribution didn't happen but the checkout itself can proceed (the
 * resolver already filtered most cases; this is a defensive last
 * mile).
 */
export async function attributeReferralAtCheckout(args: {
  userId: string;
  userPhone: string;
  code: string;
}): Promise<AttributionOutcome> {
  const db = getDb();
  const normalized = normalizeCheckoutCode(args.code);
  const row = await resolveReferralCodeRow(db, normalized);
  if (!row) return { ok: false, errorCode: "not_found" };

  // Self-referral re-check (resolver should have caught this, but the
  // attribution function is reachable from server actions that may
  // skip the resolver).
  if (row.userId === args.userId) {
    return { ok: true, attributed: false, reason: "self_referral" };
  }
  const owner = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
    columns: { phone: true },
  });
  if (owner?.phone === args.userPhone) {
    return { ok: true, attributed: false, reason: "self_referral" };
  }

  if (row.kind === "affiliate") {
    const status = (row.affiliateStatus ?? "active") as string;
    if (status !== "active") {
      return { ok: false, errorCode: "affiliate_inactive" };
    }
  }

  // First-purchase gate. We check at checkout time so the user sees
  // immediate feedback in the UI; the conversion path also re-checks
  // via fraud + status flow.
  const hadPrior = await userHasPriorPaidConversion(db, args.userId);
  if (hadPrior) {
    return { ok: true, attributed: false, reason: "ineligible" };
  }

  // Locate any existing referrals row for this user.
  const existing = await db.query.referrals.findFirst({
    where: eq(referrals.refereeUserId, args.userId),
  });

  // Terminal states are immutable — once rewarded / rejected / flagged
  // we never overwrite. (`hadPrior` above usually catches this since
  // any rewarded conversion implies a paid invoice; this is defensive.)
  if (
    existing &&
    (existing.status === "rewarded" ||
      existing.status === "rejected" ||
      existing.status === "flagged")
  ) {
    return { ok: true, attributed: false, reason: "ineligible" };
  }

  const now = new Date();
  if (existing) {
    if (
      existing.referrerUserId === row.userId &&
      existing.referralCodeId === row.id
    ) {
      // Same code already attributed — no-op success.
      return { ok: true, attributed: true, replacedPrior: false };
    }
    await db
      .update(referrals)
      .set({
        referrerUserId: row.userId,
        referralCodeId: row.id,
        status:
          existing.status === "converted" ? "converted" : "signed_up",
        signedUpAt: existing.signedUpAt ?? now,
        rejectionReason: null,
        updatedAt: now,
      })
      .where(eq(referrals.id, existing.id));
    log.info("checkout_codes.attribution.replaced", {
      userId: args.userId,
      newReferralCodeId: row.id,
      priorReferralCodeId: existing.referralCodeId,
    });
    return { ok: true, attributed: true, replacedPrior: true };
  }

  // No prior attribution — create one. Synthesize a cookie id so the
  // NOT NULL constraint on `cookie_id` is honored; this cookie is not
  // written to a browser, it's just a stable internal handle.
  await db.insert(referrals).values({
    referrerUserId: row.userId,
    referralCodeId: row.id,
    refereeUserId: args.userId,
    cookieId: randomUUID(),
    status: "signed_up",
    signedUpAt: now,
    clickIp: null,
    clickUserAgent: "manual_checkout_entry",
  });
  log.info("checkout_codes.attribution.created", {
    userId: args.userId,
    referralCodeId: row.id,
  });
  return { ok: true, attributed: true, replacedPrior: false };
}

// Quiet "unused" complaints for re-export surface area.
void sql;
