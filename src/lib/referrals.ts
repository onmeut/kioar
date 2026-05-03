/**
 * Referral / invitation system core.
 *
 * All decision logic lives in this one module so the API surface stays
 * narrow and the fraud rules are easy to audit / tune. Centralized
 * here:
 *
 *   - `getOrCreateReferralCodeForUser(userId)` — idempotent, called on
 *     first sign-in for new users (the migration backfilled existing
 *     ones). Format: 4 random lowercase letters (e.g. `xqfm`,
 *     `btzk`). Pure random — no slug derivation, no numeric suffix,
 *     no dictionary. Code is permanent; never regenerated.
 *
 *   - `createClickRecord({ code, ip, userAgent })` — `/r/:code` writes
 *     this. Resolves both the primary `referral_codes.code_normalized`
 *     and the `referral_code_aliases` table so previously-shared
 *     links keep working forever. Returns the cookie id to set, or
 *     `null` for unknown codes.
 *
 *   - `attachReferralOnSignup(refereeUserId, refereePhone)` — looks up
 *     the click row by cookie, attaches the referee. Hard-rejects
 *     self-referrals (same userId, same phone).
 *
 *   - `processReferralConversion(tx, ctx)` — invoked after a Zarinpal
 *     verify commits. Idempotent on `referrals.status`. Runs fraud
 *     checks, applies referee bonus (+30 days on the paid page), and
 *     issues the referrer credit.
 *
 *   - `getReferralStats(userId)` — dashboard read model.
 *
 *   - `redeemCredit({ userId, pageId })` — atomic redemption: consumes
 *     one earned credit (oldest-first FIFO) and pushes
 *     `currentPeriodEnd` forward by 30 days on the chosen page.
 *
 * Money-side primitives (period end advance, plan, etc.) come from
 * `lib/billing-pricing.ts` / `lib/pages.ts`. We do NOT duplicate those.
 */
import { randomInt, randomUUID } from "node:crypto";

import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  invoices,
  pageSubscriptions,
  payments,
  plans,
  profiles,
  referralCodeAliases,
  referralCodes,
  referralCredits,
  referrals,
  users,
} from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin-audit";
import { log } from "@/lib/log";
import { enqueueSms } from "@/lib/sms-queue";

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const REFERRER_BALANCE_CAP = 12; // months
const REFEREE_BONUS_DAYS = 30;
const REFERRER_CREDIT_MONTHS = 1;
const FLAG_THRESHOLD = 2;
const VELOCITY_WINDOW_HOURS = 24;
const VELOCITY_MAX_CONVERSIONS = 5;
/** Length of a freshly-generated referral code. 26^4 ≈ 457k codes. */
const CODE_LENGTH = 4;

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Db = ReturnType<typeof getDb>;
type Executor = Tx | Db;

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/**
 * Generate `length` random lowercase ASCII letters. Pure random — no
 * dictionary check, no ambiguous-character filter, no derivation from
 * the user's slug or phone. The code is opaque on purpose so it can
 * be used both as a link slug (`kioar.com/r/xqfm`) and verbally /
 * in printed media without revealing any user identity.
 */
function generateCandidateCode(length = CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    // randomInt(26) maps cleanly onto a-z without modulo bias.
    out += String.fromCharCode(97 + randomInt(0, 26));
  }
  return out;
}

/**
 * Idempotent — returns the existing row if present, otherwise inserts
 * one with retry on collisions. Failure here MUST NOT break the auth
 * flow that called us; callers wrap with try/catch.
 *
 * Collision resolution: we check both `referral_codes.code_normalized`
 * AND `referral_code_aliases.code_normalized` so a freshly-minted code
 * never shadows a legacy alias. The 4-letter space (≈457k) is wide
 * enough that a handful of retries is overwhelmingly sufficient; we
 * keep a generous attempts budget anyway.
 */
export async function getOrCreateReferralCodeForUser(
  userId: string,
): Promise<typeof referralCodes.$inferSelect> {
  const db = getDb();
  const existing = await db.query.referralCodes.findFirst({
    where: eq(referralCodes.userId, userId),
  });
  if (existing) return existing;

  for (let attempts = 0; attempts < 32; attempts += 1) {
    const candidate = generateCandidateCode();
    // Pre-check both namespaces. Not strictly required (the unique
    // index on referral_codes.code_normalized will catch collisions),
    // but checking aliases up-front avoids burning an INSERT on a
    // candidate we already know is taken.
    const aliasHit = await db.query.referralCodeAliases.findFirst({
      where: eq(referralCodeAliases.codeNormalized, candidate),
      columns: { id: true },
    });
    if (aliasHit) continue;
    try {
      const [inserted] = await db
        .insert(referralCodes)
        .values({ userId, code: candidate, codeNormalized: candidate })
        .returning();
      return inserted;
    } catch (err) {
      const msg = (err as Error).message ?? "";
      // Two collision modes: (1) code_normalized collision, (2) per-user
      // UNIQUE — meaning a concurrent caller beat us to it. In case (2)
      // the row now exists; just read it.
      if (msg.includes("referral_codes_user_id_idx")) {
        const winner = await db.query.referralCodes.findFirst({
          where: eq(referralCodes.userId, userId),
        });
        if (winner) return winner;
      }
      if (!msg.includes("referral_codes_code_normalized_idx")) throw err;
    }
  }
  throw new Error(
    `getOrCreateReferralCodeForUser: collision budget exhausted for ${userId}`,
  );
}

/**
 * Resolve a public code (primary or alias) to its canonical
 * `referral_codes` row. Returns `null` for unknown codes.
 */
async function resolveCodeRow(
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

// ---------------------------------------------------------------------------
// Click attribution
// ---------------------------------------------------------------------------

export type ClickRecordInput = {
  code: string;
  ip: string | null;
  userAgent: string | null;
};

export type ClickRecordResult = {
  cookieId: string;
  referrerUserId: string;
};

/**
 * Resolve a public referral code, write a `referrals` row, return the
 * opaque cookie token to set. Returns `null` on unknown code so the
 * caller can 404 cleanly.
 */
export async function createClickRecord(
  input: ClickRecordInput,
): Promise<ClickRecordResult | null> {
  const db = getDb();
  const normalized = input.code.trim().toLowerCase();
  if (!normalized) return null;

  // Resolve via primary code OR a permanent alias so links shared
  // before the 4-letter rebuild keep working.
  const code = await resolveCodeRow(db, normalized);
  if (!code) return null;

  const cookieId = randomUUID();
  await db.transaction(async (tx) => {
    await tx
      .update(referralCodes)
      .set({
        clicksCount: sql`${referralCodes.clicksCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(referralCodes.id, code.id));

    await tx.insert(referrals).values({
      referrerUserId: code.userId,
      referralCodeId: code.id,
      cookieId,
      status: "clicked",
      clickIp: input.ip,
      // Cap the UA to keep the row small; 512 chars is plenty.
      clickUserAgent: input.userAgent?.slice(0, 512) ?? null,
    });
  });

  return { cookieId, referrerUserId: code.userId };
}

export async function getReferrerByCode(code: string): Promise<{
  code: typeof referralCodes.$inferSelect;
  referrer: { id: string; phone: string };
} | null> {
  const db = getDb();
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  const row = await resolveCodeRow(db, normalized);
  if (!row) return null;
  const referrer = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
    columns: { id: true, phone: true },
  });
  if (!referrer) return null;
  return { code: row, referrer };
}

// ---------------------------------------------------------------------------
// Signup attribution
// ---------------------------------------------------------------------------

/**
 * Read the referral cookie, look up the matching `referrals` row, and
 * attach `refereeUserId` to it. Hard-rejects self-referrals.
 *
 * Idempotent: if the row is already past `clicked`, we leave it alone
 * (covers users who bounce between signup and the landing page). If
 * the cookie is missing/invalid, this is a no-op.
 *
 * Returns `true` when attribution was attached, `false` otherwise.
 * Errors are swallowed — failure here MUST NOT break sign-in.
 */
export async function attachReferralOnSignup(args: {
  cookieId: string | null;
  refereeUserId: string;
  refereePhone: string;
}): Promise<boolean> {
  if (!args.cookieId) return false;
  try {
    const db = getDb();
    const row = await db.query.referrals.findFirst({
      where: eq(referrals.cookieId, args.cookieId),
      with: {
        referrer: { columns: { id: true, phone: true } },
      },
    });
    if (!row) return false;
    if (row.status !== "clicked" && row.refereeUserId !== args.refereeUserId) {
      // Cookie already burned by a different signup — ignore.
      return false;
    }

    // Hard guards. We REJECT and stop here — these are unambiguous.
    let rejectionReason: string | null = null;
    if (row.referrer.id === args.refereeUserId) {
      rejectionReason = "self_referral_user_id";
    } else if (row.referrer.phone === args.refereePhone) {
      rejectionReason = "self_referral_phone";
    }

    await db
      .update(referrals)
      .set({
        refereeUserId: args.refereeUserId,
        signedUpAt: new Date(),
        status: rejectionReason ? "rejected" : "signed_up",
        rejectionReason,
        updatedAt: new Date(),
      })
      .where(eq(referrals.id, row.id));

    return rejectionReason === null;
  } catch (err) {
    log.warn("referrals.attach_on_signup.failed", {
      error: (err as Error).message,
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Conversion (post-payment)
// ---------------------------------------------------------------------------

export type ConversionContext = {
  refereeUserId: string;
  refereePhone: string;
  paidPageId: string;
  invoiceId: string;
  /** Zarinpal rawResponse blob — we look for `card_pan` in here. */
  zarinpalRaw: Record<string, unknown> | null;
  /** Best-effort client IP at conversion time. May be `"unknown"`. */
  clientIp: string | null;
  /**
   * Billing cycle of the paid invoice. Used by the affiliate branch:
   *  - `annual`  → referee gets 3 free months, affiliate earns 30%
   *    cash commission on `netAmountToman` (held for 30 days).
   *  - `monthly` → attribution only, no bonus, no commission.
   * Optional so the regular user-to-user path keeps working.
   */
  billingCycle?: "monthly" | "annual";
  /**
   * Pre-VAT (or total) toman amount used as the commission base on
   * yearly affiliate conversions. Required when `billingCycle === "annual"`
   * AND the referral code is an affiliate code.
   */
  netAmountToman?: number;
};

type FraudResult = {
  signals: string[]; // stable identifiers, also written to flag_signals
};

async function runFraudChecks(
  exec: Executor,
  referrerUserId: string,
  ctx: ConversionContext,
): Promise<FraudResult> {
  const signals: string[] = [];

  // (1) IP match: does the referrer share a signed-in IP with the referee?
  // We compare against any IP the click row captured AND the IP at
  // conversion. Cheap proxy for "same household / same person".
  if (ctx.clientIp && ctx.clientIp !== "unknown") {
    const click = await exec.query.referrals.findFirst({
      where: and(
        eq(referrals.referrerUserId, referrerUserId),
        eq(referrals.refereeUserId, ctx.refereeUserId),
      ),
      columns: { clickIp: true },
    });
    if (click?.clickIp && click.clickIp === ctx.clientIp) {
      signals.push("ip_match_click_conversion");
    }
  }

  // (2) Card PAN match: did the referrer ever pay with the same card
  // (last 4 of `card_pan`) within the last 90 days? A shared card is a
  // very strong signal for fake-funnel attempts.
  const pan = extractCardPan(ctx.zarinpalRaw);
  if (pan) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const referrerPaymentsRows = await exec
      .select({ raw: payments.rawResponse })
      .from(payments)
      .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
      .where(
        and(
          eq(invoices.userId, referrerUserId),
          eq(payments.status, "verified"),
          gt(payments.verifiedAt, ninetyDaysAgo),
        ),
      )
      .limit(20);
    for (const r of referrerPaymentsRows) {
      if (extractCardPan(r.raw as Record<string, unknown>) === pan) {
        signals.push("card_pan_match");
        break;
      }
    }
  }

  // (3) Velocity: more than VELOCITY_MAX_CONVERSIONS in the last 24h
  // for this referrer is suspicious.
  const since = new Date(Date.now() - VELOCITY_WINDOW_HOURS * 60 * 60 * 1000);
  const [{ recent }] = await exec
    .select({ recent: count() })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, referrerUserId),
        inArray(referrals.status, ["converted", "rewarded", "flagged"]),
        gt(referrals.convertedAt, since),
      ),
    );
  if ((recent ?? 0) > VELOCITY_MAX_CONVERSIONS) {
    signals.push("velocity_24h");
  }

  return { signals };
}

function extractCardPan(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null;
  const direct = raw["card_pan"] ?? raw["cardPan"];
  if (typeof direct === "string" && direct.length > 0) return direct;
  // Some Zarinpal envelopes nest the data under `data`.
  const nested = raw["data"];
  if (nested && typeof nested === "object") {
    const v = (nested as Record<string, unknown>)["card_pan"];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

/**
 * Idempotent — re-running the verify path is a no-op once we hit any
 * terminal state. Side effects:
 *
 *   - Period extend (30d) on the referee's paid page.
 *   - One `referral_credits` row (`kind='earned'`, +1 month) for the
 *     referrer, gated on the 12-month balance cap.
 *   - Two best-effort SMS messages enqueued post-commit (caller fires).
 *
 * Returns the outcome so the caller can fire SMS + audit hooks.
 */
export type ConversionOutcome =
  | { kind: "noop"; reason: string }
  | {
      kind: "rewarded";
      referralId: string;
      referrerUserId: string;
      refereeBonusDays: number;
      referrerCreditedMonths: number;
      referrerNewBalance: number;
      flaggedSignal: string | null;
    }
  | {
      kind: "rejected";
      referralId: string;
      referrerUserId: string;
      reason: string;
      signals: string[];
    };

export async function processReferralConversion(
  ctx: ConversionContext,
): Promise<ConversionOutcome> {
  const db = getDb();

  // Locate by referee. We lock the row inside the transaction below.
  const candidate = await db.query.referrals.findFirst({
    where: eq(referrals.refereeUserId, ctx.refereeUserId),
  });
  if (!candidate) return { kind: "noop", reason: "no_referral_row" };
  if (
    candidate.status === "rewarded" ||
    candidate.status === "rejected" ||
    candidate.status === "flagged"
  ) {
    return { kind: "noop", reason: `terminal_${candidate.status}` };
  }
  if (candidate.status === "clicked") {
    // The cookie was attached but signup didn't write the row — odd
    // but not fatal. Treat it as effectively `signed_up` and move on.
    log.info("referrals.conversion.click_status_recovered", {
      referralId: candidate.id,
    });
  }

  // Holder for the transaction's decision. Wrapped in an object because
  // TS doesn't propagate assignments performed inside async callbacks
  // when narrowing a bare `let` — the indirection keeps the type as
  // `ConversionOutcome | null` after the await.
  const outcomeRef: { value: ConversionOutcome | null } = { value: null };

  await db.transaction(async (tx) => {
    // Re-read inside the TX with row lock so a racing callback can't
    // double-apply. Postgres `SELECT ... FOR UPDATE` via raw exec.
    const lockedRows = (await tx.execute(sql`
      SELECT "id","status","referrer_user_id"
        FROM "referrals"
        WHERE "id" = ${candidate.id}
        FOR UPDATE
    `)) as unknown as
      | Array<{ id: string; status: string; referrer_user_id: string }>
      | {
          rows?: Array<{
            id: string;
            status: string;
            referrer_user_id: string;
          }>;
        };
    const locked = Array.isArray(lockedRows)
      ? lockedRows[0]
      : lockedRows.rows?.[0];
    if (!locked) {
      outcomeRef.value = { kind: "noop", reason: "vanished" };
      return;
    }
    if (
      locked.status === "rewarded" ||
      locked.status === "rejected" ||
      locked.status === "flagged"
    ) {
      outcomeRef.value = { kind: "noop", reason: `terminal_${locked.status}` };
      return;
    }

    const referrerUserId = locked.referrer_user_id;
    const now = new Date();

    // Mark converted before fraud checks so a crash leaves an
    // observable in-flight state we can audit.
    await tx
      .update(referrals)
      .set({
        status: "converted",
        convertedAt: now,
        convertingPageId: ctx.paidPageId,
        convertingInvoiceId: ctx.invoiceId,
        updatedAt: now,
      })
      .where(eq(referrals.id, candidate.id));

    const fraud = await runFraudChecks(tx, referrerUserId, ctx);

    if (fraud.signals.length >= FLAG_THRESHOLD) {
      await tx
        .update(referrals)
        .set({
          status: "flagged",
          flagSignals: fraud.signals,
          updatedAt: new Date(),
        })
        .where(eq(referrals.id, candidate.id));
      outcomeRef.value = {
        kind: "rejected",
        referralId: candidate.id,
        referrerUserId,
        reason: "fraud_flagged",
        signals: fraud.signals,
      };
      return;
    }

    // -------------------------------------------------------------
    // Affiliate branch.
    //
    // If this referral was attributed to a `kind='affiliate'` code we
    // diverge here:
    //   * yearly conversions → 3 months free for the referee + a held
    //     commission row for the affiliate. No referrer-credit ledger
    //     entry (affiliates earn cash, not free months).
    //   * monthly conversions → attribution only. No bonus, no
    //     commission. The referral row is still rewarded so we never
    //     reprocess it.
    // Banned affiliates collapse to "attribution only" too.
    // -------------------------------------------------------------
    const { loadAffiliateMetaForCode } = await import("@/lib/affiliate");
    const affMeta = await loadAffiliateMetaForCode(
      tx,
      candidate.referralCodeId,
    );

    if (affMeta) {
      const isYearly = ctx.billingCycle === "annual";
      const isPayable = isYearly && affMeta.affiliateStatus === "active";

      if (isYearly) {
        // Referee bonus: 3 months on yearly, regardless of affiliate
        // status (the user we attracted shouldn't be punished if their
        // affiliate is later banned).
        await tx
          .update(pageSubscriptions)
          .set({
            currentPeriodEnd: sql`${pageSubscriptions.currentPeriodEnd} + interval '90 days'`,
            updatedAt: new Date(),
          })
          .where(eq(pageSubscriptions.pageId, ctx.paidPageId));
      }

      let commissionToman = 0;
      let unlockAt: Date | null = null;
      if (isPayable && (ctx.netAmountToman ?? 0) > 0) {
        const net = ctx.netAmountToman as number;
        commissionToman = Math.floor((net * affMeta.commissionPct) / 100);
        unlockAt = new Date(
          now.getTime() + affMeta.holdingPeriodDays * 24 * 60 * 60 * 1000,
        );
      }

      await tx
        .update(referrals)
        .set({
          status: "rewarded",
          rewardedAt: new Date(),
          flagSignals: fraud.signals,
          commissionBillingCycle: ctx.billingCycle ?? null,
          commissionNetAmountToman: ctx.netAmountToman ?? null,
          commissionAmountToman: commissionToman > 0 ? commissionToman : null,
          commissionStatus: commissionToman > 0 ? "pending" : null,
          commissionUnlockAt: unlockAt,
          updatedAt: new Date(),
        })
        .where(eq(referrals.id, candidate.id));

      outcomeRef.value = {
        kind: "rewarded",
        referralId: candidate.id,
        referrerUserId,
        refereeBonusDays: isYearly ? 90 : 0,
        referrerCreditedMonths: 0,
        referrerNewBalance: 0,
        flaggedSignal: fraud.signals[0] ?? null,
      };
      return;
    }

    // Apply referee bonus: extend the paid page's currentPeriodEnd by
    // REFEREE_BONUS_DAYS. Use a Postgres interval so we operate on the
    // existing column value (no read-then-write race).
    await tx
      .update(pageSubscriptions)
      .set({
        currentPeriodEnd: sql`${pageSubscriptions.currentPeriodEnd} + interval '${sql.raw(
          String(REFEREE_BONUS_DAYS),
        )} days'`,
        updatedAt: new Date(),
      })
      .where(eq(pageSubscriptions.pageId, ctx.paidPageId));

    // Issue referrer credit, gated on balance cap.
    const balance = await computeReferrerBalanceTx(tx, referrerUserId);
    let creditedMonths = 0;
    if (balance + REFERRER_CREDIT_MONTHS <= REFERRER_BALANCE_CAP) {
      await tx
        .insert(referralCredits)
        .values({
          userId: referrerUserId,
          kind: "earned",
          months: REFERRER_CREDIT_MONTHS,
          referralId: candidate.id,
        })
        .onConflictDoNothing();
      creditedMonths = REFERRER_CREDIT_MONTHS;
    } else {
      // Cap reached — record an audit row so ops can notice. The
      // referee still gets their bonus (their reward is independent).
      await recordAdminAudit(
        {
          actorUserId: referrerUserId,
          action: "subscription.extend_period",
          targetUserId: referrerUserId,
          reason: "referral_balance_cap_reached",
          metadata: {
            referralId: candidate.id,
            balance,
            cap: REFERRER_BALANCE_CAP,
          },
        },
        tx,
      );
    }

    await tx
      .update(referrals)
      .set({
        status: "rewarded",
        rewardedAt: new Date(),
        flagSignals: fraud.signals,
        updatedAt: new Date(),
      })
      .where(eq(referrals.id, candidate.id));

    outcomeRef.value = {
      kind: "rewarded",
      referralId: candidate.id,
      referrerUserId,
      refereeBonusDays: REFEREE_BONUS_DAYS,
      referrerCreditedMonths: creditedMonths,
      referrerNewBalance: balance + creditedMonths,
      flaggedSignal: fraud.signals[0] ?? null,
    };
  });

  // Single-signal soft flag: still rewarded, but log for review.
  const outcome = outcomeRef.value;
  if (outcome && outcome.kind === "rewarded" && outcome.flaggedSignal) {
    try {
      await recordAdminAudit({
        actorUserId: outcome.referrerUserId,
        action: "subscription.extend_period",
        targetUserId: outcome.referrerUserId,
        reason: "referral_single_signal",
        metadata: {
          referralId: outcome.referralId,
          signal: outcome.flaggedSignal,
        },
      });
    } catch (err) {
      log.warn("referrals.audit.single_signal_failed", {
        error: (err as Error).message,
      });
    }
  }

  return outcome ?? { kind: "noop", reason: "tx_unset" };
}

async function computeReferrerBalanceTx(
  exec: Executor,
  userId: string,
): Promise<number> {
  const rows = await exec
    .select({
      kind: referralCredits.kind,
      total: sql<number>`coalesce(sum(${referralCredits.months}),0)::int`,
    })
    .from(referralCredits)
    .where(eq(referralCredits.userId, userId))
    .groupBy(referralCredits.kind);
  let earned = 0;
  let redeemed = 0;
  for (const r of rows) {
    if (r.kind === "earned") earned = r.total ?? 0;
    if (r.kind === "redeemed") redeemed = r.total ?? 0;
  }
  return earned - redeemed;
}

// ---------------------------------------------------------------------------
// Post-conversion notifications (caller fires from outside the TX)
// ---------------------------------------------------------------------------

export async function fireConversionNotifications(args: {
  outcome: ConversionOutcome;
  refereePhone: string;
  invoiceId: string;
}): Promise<void> {
  if (args.outcome.kind !== "rewarded") return;
  const { referrerUserId, refereeBonusDays, referrerNewBalance } = args.outcome;
  try {
    const db = getDb();
    const referrer = await db.query.users.findFirst({
      where: eq(users.id, referrerUserId),
      columns: { phone: true },
    });
    const referee = await db.query.users.findFirst({
      where: eq(users.phone, args.refereePhone),
      columns: { id: true },
    });
    const refereePage = referee
      ? await db.query.profiles.findFirst({
          where: eq(profiles.userId, referee.id),
          orderBy: [asc(profiles.createdAt)],
          columns: { fullName: true },
        })
      : null;

    // Check whether this conversion was attributed to an affiliate code.
    // Affiliate conversions get a different SMS pair; monthly affiliate
    // conversions get NO bonus SMS at all (referee is attributed but
    // not rewarded, no commission earned).
    const referralRow = await db.query.referrals.findFirst({
      where: eq(referrals.id, args.outcome.referralId),
      columns: {
        commissionStatus: true,
        commissionAmountToman: true,
        commissionBillingCycle: true,
      },
    });
    const isAffiliateConversion = referralRow?.commissionBillingCycle != null;
    const refereeName = refereePage?.fullName ?? "دوست شما";

    if (isAffiliateConversion) {
      // Monthly affiliate conversions: no bonus, no commission, no SMS.
      if (referralRow?.commissionBillingCycle !== "annual") return;
      // Yearly: 3-month referee bonus + commission earned for affiliate.
      await enqueueSms({
        templateKey: "affiliate_referee_rewarded",
        phone: args.refereePhone,
        idempotencyKey: `affiliate_referee:${args.invoiceId}`,
        variables: { months: 3 },
      });
      if (referrer?.phone) {
        await enqueueSms({
          templateKey: "affiliate_commission_earned",
          phone: referrer.phone,
          idempotencyKey: `affiliate_commission:${args.outcome.referralId}`,
          variables: {
            refereeName,
            commission: referralRow?.commissionAmountToman ?? 0,
          },
        });
      }
      return;
    }

    await enqueueSms({
      templateKey: "referral_referee_rewarded",
      phone: args.refereePhone,
      idempotencyKey: `referral_referee:${args.invoiceId}`,
      variables: { months: Math.round(refereeBonusDays / 30) },
    });
    if (referrer?.phone) {
      await enqueueSms({
        templateKey: "referral_referrer_rewarded",
        phone: referrer.phone,
        idempotencyKey: `referral_referrer:${args.outcome.referralId}`,
        variables: {
          refereeName,
          balance: referrerNewBalance,
        },
      });
    }
  } catch (err) {
    log.warn("referrals.notifications.failed", {
      error: (err as Error).message,
    });
  }
}

// ---------------------------------------------------------------------------
// Dashboard read model
// ---------------------------------------------------------------------------

export type ReferralFeedRow = {
  id: string;
  status: string;
  refereeName: string | null;
  refereeSlug: string | null;
  refereeAvatarUrl: string | null;
  refereeAvatarSeed: string | null;
  refereeDomain: string | null;
  refereePlanKey: "free" | "pro" | "business" | null;
  clickedAt: Date;
  signedUpAt: Date | null;
  convertedAt: Date | null;
  rewardedAt: Date | null;
};

export type ReferralStats = {
  code: typeof referralCodes.$inferSelect;
  clicks: number;
  signups: number;
  conversions: number;
  monthsEarned: number;
  monthsRedeemed: number;
  monthsAvailable: number;
  cap: number;
  /** Latest `rewardedAt` across all referrals — drives the in-app toast. */
  latestRewardedAt: Date | null;
  recentReferrals: ReferralFeedRow[];
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await getOrCreateReferralCodeForUser(userId);
  const db = getDb();

  const [{ signups }] = await db
    .select({ signups: count() })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, userId),
        inArray(referrals.status, [
          "signed_up",
          "converted",
          "rewarded",
          "flagged",
        ]),
      ),
    );
  const [{ conversions }] = await db
    .select({ conversions: count() })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, userId),
        inArray(referrals.status, ["rewarded"]),
      ),
    );

  const balanceRows = await db
    .select({
      kind: referralCredits.kind,
      total: sql<number>`coalesce(sum(${referralCredits.months}),0)::int`,
    })
    .from(referralCredits)
    .where(eq(referralCredits.userId, userId))
    .groupBy(referralCredits.kind);
  let monthsEarned = 0;
  let monthsRedeemed = 0;
  for (const r of balanceRows) {
    if (r.kind === "earned") monthsEarned = r.total ?? 0;
    if (r.kind === "redeemed") monthsRedeemed = r.total ?? 0;
  }

  const recentRows = await db
    .select({
      id: referrals.id,
      status: referrals.status,
      clickedAt: referrals.clickedAt,
      signedUpAt: referrals.signedUpAt,
      convertedAt: referrals.convertedAt,
      rewardedAt: referrals.rewardedAt,
      refereeName: profiles.fullName,
      refereeSlug: profiles.slug,
      refereeAvatarUrl: profiles.avatarUrl,
      refereeAvatarSeed: profiles.avatarSeed,
      refereeDomain: profiles.domain,
      refereePlanKey: plans.key,
    })
    .from(referrals)
    .leftJoin(profiles, eq(profiles.userId, referrals.refereeUserId))
    .leftJoin(pageSubscriptions, eq(pageSubscriptions.pageId, profiles.id))
    .leftJoin(plans, eq(plans.id, pageSubscriptions.planId))
    .where(eq(referrals.referrerUserId, userId))
    .orderBy(desc(referrals.clickedAt))
    .limit(20);

  // Latest rewarded_at — drives the in-app reward toast on next dashboard view.
  const [latestRewardRow] = await db
    .select({ at: referrals.rewardedAt })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, userId),
        eq(referrals.status, "rewarded"),
      ),
    )
    .orderBy(desc(referrals.rewardedAt))
    .limit(1);

  return {
    code,
    clicks: code.clicksCount,
    signups: signups ?? 0,
    conversions: conversions ?? 0,
    monthsEarned,
    monthsRedeemed,
    monthsAvailable: monthsEarned - monthsRedeemed,
    cap: REFERRER_BALANCE_CAP,
    latestRewardedAt: latestRewardRow?.at ?? null,
    recentReferrals: recentRows.map((r) => ({
      id: r.id,
      status: r.status,
      refereeName: r.refereeName ?? null,
      refereeSlug: r.refereeSlug ?? null,
      refereeAvatarUrl: r.refereeAvatarUrl ?? null,
      refereeAvatarSeed: r.refereeAvatarSeed ?? null,
      refereeDomain: r.refereeDomain ?? null,
      refereePlanKey:
        (r.refereePlanKey as "free" | "pro" | "business" | null) ?? null,
      clickedAt: r.clickedAt,
      signedUpAt: r.signedUpAt,
      convertedAt: r.convertedAt,
      rewardedAt: r.rewardedAt,
    })),
  };
}

/**
 * Lightweight sidebar/badge query — just the available months for a
 * user, no extra rows. Returns 0 on any failure so the nav never breaks.
 */
export async function getReferralAvailableMonths(
  userId: string,
): Promise<number> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        kind: referralCredits.kind,
        total: sql<number>`coalesce(sum(${referralCredits.months}),0)::int`,
      })
      .from(referralCredits)
      .where(eq(referralCredits.userId, userId))
      .groupBy(referralCredits.kind);
    let earned = 0;
    let redeemed = 0;
    for (const r of rows) {
      if (r.kind === "earned") earned = r.total ?? 0;
      if (r.kind === "redeemed") redeemed = r.total ?? 0;
    }
    return Math.max(0, earned - redeemed);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Credit redemption
// ---------------------------------------------------------------------------

export type RedeemOutcome =
  | { ok: true; pageId: string; newPeriodEnd: Date }
  | {
      ok: false;
      errorCode:
        | "no_credit"
        | "page_not_owned"
        | "subscription_missing"
        | "free_plan";
    };

/**
 * Apply one earned credit to the chosen page. Atomic — claims the
 * oldest unredeemed credit (FIFO) and pushes `currentPeriodEnd`
 * forward by `months × 30 days`. Free-plan pages are rejected: a
 * sentinel period_end is essentially infinite, so the bonus would be
 * meaningless. Users must upgrade or trial first.
 */
export async function redeemCredit(args: {
  userId: string;
  pageId: string;
}): Promise<RedeemOutcome> {
  const db = getDb();
  let result: RedeemOutcome | null = null;

  await db.transaction(async (tx) => {
    const balance = await computeReferrerBalanceTx(tx, args.userId);
    if (balance < 1) {
      result = { ok: false, errorCode: "no_credit" };
      return;
    }

    // Ownership check inside the TX so we can't race against a page
    // transfer (we don't ship page transfer in V1, but this is cheap).
    const page = await tx.query.profiles.findFirst({
      where: and(
        eq(profiles.id, args.pageId),
        eq(profiles.userId, args.userId),
      ),
      columns: { id: true },
    });
    if (!page) {
      result = { ok: false, errorCode: "page_not_owned" };
      return;
    }

    const sub = await tx.query.pageSubscriptions.findFirst({
      where: eq(pageSubscriptions.pageId, args.pageId),
      with: { plan: { columns: { key: true } } },
    });
    if (!sub) {
      result = { ok: false, errorCode: "subscription_missing" };
      return;
    }
    if (sub.plan.key === "free") {
      result = { ok: false, errorCode: "free_plan" };
      return;
    }

    // Push period end forward by 30 days. Locking on the row ensures
    // a concurrent renewal/proration callback can't read a stale value.
    const updated = await tx
      .update(pageSubscriptions)
      .set({
        currentPeriodEnd: sql`${pageSubscriptions.currentPeriodEnd} + interval '${sql.raw(
          String(REFEREE_BONUS_DAYS),
        )} days'`,
        updatedAt: new Date(),
      })
      .where(eq(pageSubscriptions.id, sub.id))
      .returning({ currentPeriodEnd: pageSubscriptions.currentPeriodEnd });

    await tx.insert(referralCredits).values({
      userId: args.userId,
      kind: "redeemed",
      months: 1,
      redeemedOnPageId: args.pageId,
      redeemedOnSubscriptionId: sub.id,
    });

    result = {
      ok: true,
      pageId: args.pageId,
      newPeriodEnd: updated[0].currentPeriodEnd,
    };
  });

  return result ?? { ok: false, errorCode: "no_credit" };
}
