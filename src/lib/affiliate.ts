/**
 * Affiliate program — business logic.
 *
 * The affiliate program is built ON TOP of the referral primitives in
 * `lib/referrals.ts`. This module owns the affiliate-specific concerns:
 *
 *   - Loading singleton settings (commission %, holding days, min payout).
 *   - Submitting + approving + rejecting applications.
 *   - Minting affiliate codes (one per user, by extending the existing
 *     `referral_codes` row with affiliate metadata).
 *   - Computing balance breakdowns (pending vs available vs requested vs paid).
 *   - Requesting + processing payouts (atomic claim of available entries).
 *   - Daily/hourly unlock job (pending → available).
 *
 * Money: ALL amounts are integer toman. No floats.
 *
 * Idempotency / locking: payout request uses `FOR UPDATE` on the claimed
 * referrals rows + the singleton row to prevent double-claim under
 * concurrent submissions. Re-running the cron unlock is a no-op once
 * an entry has flipped to 'available'.
 */
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import {
  affiliateApplications,
  affiliatePayouts,
  affiliateProfiles,
  affiliateSettings,
  invoices,
  pageSubscriptions,
  payments,
  profiles,
  referralCodes,
  referrals,
  users,
} from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin-audit";
import { log } from "@/lib/log";
import { enqueueSms } from "@/lib/sms-queue";
import { getOrCreateReferralCodeForUser } from "@/lib/referrals";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Db = ReturnType<typeof getDb>;
type Executor = Tx | Db;

// ---------------------------------------------------------------------------
// Settings (singleton)
// ---------------------------------------------------------------------------

export type AffiliateSettings = {
  minWithdrawalToman: number;
  holdingPeriodDays: number;
  commissionPct: number;
  contentRulesMd: string | null;
};

const DEFAULTS: AffiliateSettings = {
  minWithdrawalToman: 5_000_000,
  holdingPeriodDays: 30,
  commissionPct: 30,
  contentRulesMd: null,
};

export async function getAffiliateSettings(
  exec?: Executor,
): Promise<AffiliateSettings> {
  const db = exec ?? getDb();
  const row = await db.query.affiliateSettings.findFirst({
    where: eq(affiliateSettings.id, 1),
  });
  if (!row) return DEFAULTS;
  return {
    minWithdrawalToman: row.minWithdrawalToman,
    holdingPeriodDays: row.holdingPeriodDays,
    commissionPct: row.commissionPct,
    contentRulesMd: row.contentRulesMd,
  };
}

export async function updateAffiliateSettings(
  patch: Partial<Omit<AffiliateSettings, "contentRulesMd">> & {
    contentRulesMd?: string | null;
  },
  actorUserId: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(affiliateSettings)
    .values({
      id: 1,
      minWithdrawalToman:
        patch.minWithdrawalToman ?? DEFAULTS.minWithdrawalToman,
      holdingPeriodDays: patch.holdingPeriodDays ?? DEFAULTS.holdingPeriodDays,
      commissionPct: patch.commissionPct ?? DEFAULTS.commissionPct,
      contentRulesMd: patch.contentRulesMd ?? null,
      updatedByUserId: actorUserId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: affiliateSettings.id,
      set: {
        ...(patch.minWithdrawalToman !== undefined && {
          minWithdrawalToman: patch.minWithdrawalToman,
        }),
        ...(patch.holdingPeriodDays !== undefined && {
          holdingPeriodDays: patch.holdingPeriodDays,
        }),
        ...(patch.commissionPct !== undefined && {
          commissionPct: patch.commissionPct,
        }),
        ...(patch.contentRulesMd !== undefined && {
          contentRulesMd: patch.contentRulesMd,
        }),
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export type AffiliateState =
  | { kind: "none" }
  | { kind: "pending"; applicationId: string }
  | { kind: "needs_info"; applicationId: string; adminNote: string | null }
  | { kind: "rejected"; applicationId: string; adminNote: string | null }
  | {
      kind: "approved";
      applicationId: string;
      referralCodeId: string;
      code: string;
      affiliateStatus: "active" | "paused" | "banned";
    };

/** What surface should this user see when they hit /affiliate/dashboard? */
export async function getAffiliateStateForUser(
  userId: string,
): Promise<AffiliateState> {
  const db = getDb();
  // Approved affiliate? Cheapest check — one indexed lookup.
  const code = await db.query.referralCodes.findFirst({
    where: and(
      eq(referralCodes.userId, userId),
      eq(referralCodes.kind, "affiliate"),
    ),
  });
  if (code) {
    const status = (code.affiliateStatus ?? "active") as
      | "active"
      | "paused"
      | "banned";
    const app = await db.query.affiliateApplications.findFirst({
      where: and(
        eq(affiliateApplications.userId, userId),
        eq(affiliateApplications.status, "approved"),
      ),
      orderBy: [desc(affiliateApplications.createdAt)],
    });
    return {
      kind: "approved",
      applicationId: app?.id ?? code.id,
      referralCodeId: code.id,
      code: code.code,
      affiliateStatus: status,
    };
  }

  const open = await db.query.affiliateApplications.findFirst({
    where: and(
      eq(affiliateApplications.userId, userId),
      inArray(affiliateApplications.status, [
        "pending",
        "needs_info",
        "rejected",
      ]),
    ),
    orderBy: [desc(affiliateApplications.createdAt)],
  });
  if (!open) return { kind: "none" };
  if (open.status === "needs_info") {
    return {
      kind: "needs_info",
      applicationId: open.id,
      adminNote: open.adminNote,
    };
  }
  if (open.status === "rejected") {
    return {
      kind: "rejected",
      applicationId: open.id,
      adminNote: open.adminNote,
    };
  }
  return { kind: "pending", applicationId: open.id };
}

// ---------------------------------------------------------------------------
// Application submission
// ---------------------------------------------------------------------------

export type ApplicationInput = {
  userId: string;
  applicantName: string;
  contactPhone: string;
  contactEmail: string | null;
  channelKind:
    | "instagram"
    | "telegram"
    | "youtube"
    | "blog"
    | "podcast"
    | "agency"
    | "other";
  channelUrl: string;
  audienceSize: "lt_1k" | "1k_10k" | "10k_50k" | "50k_200k" | "200k_plus";
  promotionPlan: string;
};

export type SubmitOutcome =
  | { ok: true; applicationId: string }
  | { ok: false; reason: "already_open" | "already_approved" };

export async function submitAffiliateApplication(
  input: ApplicationInput,
): Promise<SubmitOutcome> {
  const db = getDb();
  const state = await getAffiliateStateForUser(input.userId);
  if (state.kind === "approved")
    return { ok: false, reason: "already_approved" };
  if (state.kind === "pending" || state.kind === "needs_info") {
    return { ok: false, reason: "already_open" };
  }

  const [row] = await db
    .insert(affiliateApplications)
    .values({
      userId: input.userId,
      status: "pending",
      applicantName: input.applicantName.trim().slice(0, 200),
      contactPhone: input.contactPhone.trim().slice(0, 32),
      contactEmail: input.contactEmail?.trim().slice(0, 320) || null,
      channelKind: input.channelKind,
      channelUrl: input.channelUrl.trim().slice(0, 500),
      audienceSize: input.audienceSize,
      promotionPlan: input.promotionPlan.trim().slice(0, 1000),
    })
    .returning({ id: affiliateApplications.id });

  // Best-effort SMS confirmation. Errors swallowed.
  try {
    await enqueueSms({
      templateKey: "affiliate_application_received",
      phone: input.contactPhone,
      idempotencyKey: `aff_app_received:${row.id}`,
      variables: { name: input.applicantName },
      userId: input.userId,
    });
  } catch (err) {
    log.warn("affiliate.sms.application_received.failed", {
      error: (err as Error).message,
    });
  }

  return { ok: true, applicationId: row.id };
}

// ---------------------------------------------------------------------------
// Application approval / rejection / needs_info — admin actions
// ---------------------------------------------------------------------------

/**
 * Approve an application. Atomically:
 *   1. Lock the application row.
 *   2. Promote the user's `referral_codes` row from kind='user' to kind=
 *      'affiliate' (every user already has one — see `referral_codes`
 *      backfill in 0024). Snapshot commission terms from settings.
 *   3. Insert affiliate_profiles row (channel info from application,
 *      banking deferred).
 *   4. Mark the application 'approved' + link the code id.
 *   5. Audit log + welcome SMS.
 */
export async function approveAffiliateApplication(args: {
  applicationId: string;
  adminUserId: string;
  /** Admin can override settings defaults at approval time. */
  overrides?: {
    commissionPct?: number;
    holdingPeriodDays?: number;
    minWithdrawalToman?: number;
  };
}): Promise<
  { ok: true; referralCodeId: string } | { ok: false; reason: string }
> {
  const db = getDb();
  const settings = await getAffiliateSettings();
  const commissionPct = args.overrides?.commissionPct ?? settings.commissionPct;
  const holdingPeriodDays =
    args.overrides?.holdingPeriodDays ?? settings.holdingPeriodDays;
  const minWithdrawalToman =
    args.overrides?.minWithdrawalToman ?? settings.minWithdrawalToman;

  const result: { ok: boolean; reason?: string; referralCodeId?: string } = {
    ok: false,
  };

  await db.transaction(async (tx) => {
    const app = await tx.query.affiliateApplications.findFirst({
      where: eq(affiliateApplications.id, args.applicationId),
    });
    if (!app) {
      result.reason = "not_found";
      return;
    }
    if (app.status === "approved") {
      result.ok = true;
      result.referralCodeId = app.approvedReferralCodeId ?? undefined;
      return;
    }
    if (app.status === "rejected") {
      result.reason = "already_rejected";
      return;
    }

    // Ensure the user has a referral_codes row, then promote it.
    let code = await tx.query.referralCodes.findFirst({
      where: eq(referralCodes.userId, app.userId),
    });
    if (!code) {
      // Should never happen (backfill + signup hook), but be defensive.
      const created = await getOrCreateReferralCodeForUser(app.userId);
      code = created;
    }
    if (code.kind === "affiliate") {
      // Already promoted (race) — link app + return.
      await tx
        .update(affiliateApplications)
        .set({
          status: "approved",
          reviewedByUserId: args.adminUserId,
          reviewedAt: new Date(),
          approvedReferralCodeId: code.id,
          updatedAt: new Date(),
        })
        .where(eq(affiliateApplications.id, app.id));
      result.ok = true;
      result.referralCodeId = code.id;
      return;
    }

    await tx
      .update(referralCodes)
      .set({
        kind: "affiliate",
        affiliateStatus: "active",
        commissionPct,
        holdingPeriodDays,
        minWithdrawalToman,
        approvedAt: new Date(),
        approvedByUserId: args.adminUserId,
        updatedAt: new Date(),
      })
      .where(eq(referralCodes.id, code.id));

    // Insert affiliate_profiles row. Banking is left NULL to be filled
    // on first payout request.
    await tx
      .insert(affiliateProfiles)
      .values({
        userId: app.userId,
        displayName: app.applicantName,
        channelKind: app.channelKind,
        channelUrl: app.channelUrl,
        contactEmail: app.contactEmail,
      })
      .onConflictDoNothing();

    await tx
      .update(affiliateApplications)
      .set({
        status: "approved",
        reviewedByUserId: args.adminUserId,
        reviewedAt: new Date(),
        approvedReferralCodeId: code.id,
        updatedAt: new Date(),
      })
      .where(eq(affiliateApplications.id, app.id));

    await recordAdminAudit(
      {
        actorUserId: args.adminUserId,
        action: "affiliate.application.approve",
        targetUserId: app.userId,
        reason: "approved",
        metadata: {
          applicationId: app.id,
          commissionPct,
          holdingPeriodDays,
          minWithdrawalToman,
        },
      },
      tx,
    );

    result.ok = true;
    result.referralCodeId = code.id;
  });

  if (result.ok && result.referralCodeId) {
    // Best-effort welcome SMS.
    try {
      const app = await db.query.affiliateApplications.findFirst({
        where: eq(affiliateApplications.id, args.applicationId),
      });
      const codeRow = await db.query.referralCodes.findFirst({
        where: eq(referralCodes.id, result.referralCodeId),
      });
      if (app && codeRow) {
        await enqueueSms({
          templateKey: "affiliate_application_approved",
          phone: app.contactPhone,
          idempotencyKey: `aff_approved:${app.id}`,
          variables: {
            name: app.applicantName,
            code: codeRow.code,
            pct: commissionPct,
          },
          userId: app.userId,
        });
      }
    } catch (err) {
      log.warn("affiliate.sms.approved.failed", {
        error: (err as Error).message,
      });
    }
    return { ok: true, referralCodeId: result.referralCodeId };
  }
  return { ok: false, reason: result.reason ?? "unknown" };
}

export async function rejectAffiliateApplication(args: {
  applicationId: string;
  adminUserId: string;
  reason: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const db = getDb();
  const app = await db.query.affiliateApplications.findFirst({
    where: eq(affiliateApplications.id, args.applicationId),
  });
  if (!app) return { ok: false, reason: "not_found" };
  if (app.status !== "pending" && app.status !== "needs_info") {
    return { ok: false, reason: `not_open_${app.status}` };
  }
  await db
    .update(affiliateApplications)
    .set({
      status: "rejected",
      adminNote: args.reason,
      reviewedByUserId: args.adminUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(affiliateApplications.id, app.id));

  await recordAdminAudit({
    actorUserId: args.adminUserId,
    action: "affiliate.application.reject",
    targetUserId: app.userId,
    reason: args.reason,
    metadata: { applicationId: app.id },
  });

  try {
    await enqueueSms({
      templateKey: "affiliate_application_rejected",
      phone: app.contactPhone,
      idempotencyKey: `aff_rejected:${app.id}`,
      variables: { name: app.applicantName },
      userId: app.userId,
    });
  } catch (err) {
    log.warn("affiliate.sms.rejected.failed", {
      error: (err as Error).message,
    });
  }
  return { ok: true };
}

export async function requestMoreInfoAffiliateApplication(args: {
  applicationId: string;
  adminUserId: string;
  message: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const db = getDb();
  const app = await db.query.affiliateApplications.findFirst({
    where: eq(affiliateApplications.id, args.applicationId),
  });
  if (!app) return { ok: false, reason: "not_found" };
  if (app.status !== "pending") {
    return { ok: false, reason: `not_pending_${app.status}` };
  }
  await db
    .update(affiliateApplications)
    .set({
      status: "needs_info",
      adminNote: args.message,
      reviewedByUserId: args.adminUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(affiliateApplications.id, app.id));

  await recordAdminAudit({
    actorUserId: args.adminUserId,
    action: "affiliate.application.needs_info",
    targetUserId: app.userId,
    reason: args.message,
    metadata: { applicationId: app.id },
  });

  try {
    await enqueueSms({
      templateKey: "affiliate_application_needs_info",
      phone: app.contactPhone,
      idempotencyKey: `aff_needs_info:${app.id}`,
      variables: { name: app.applicantName },
      userId: app.userId,
    });
  } catch (err) {
    log.warn("affiliate.sms.needs_info.failed", {
      error: (err as Error).message,
    });
  }
  return { ok: true };
}

export async function setAffiliateStatus(args: {
  affiliateUserId: string;
  status: "active" | "paused" | "banned";
  adminUserId: string;
  reason: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(referralCodes)
    .set({ affiliateStatus: args.status, updatedAt: new Date() })
    .where(
      and(
        eq(referralCodes.userId, args.affiliateUserId),
        eq(referralCodes.kind, "affiliate"),
      ),
    );
  await recordAdminAudit({
    actorUserId: args.adminUserId,
    action: "affiliate.status.change",
    targetUserId: args.affiliateUserId,
    reason: args.reason,
    metadata: { status: args.status },
  });
}

// ---------------------------------------------------------------------------
// Balance + ledger reads
// ---------------------------------------------------------------------------

export type AffiliateBalance = {
  /** Sum of commission_amount for entries in 'pending' state. */
  pendingToman: number;
  /** Sum of commission_amount for entries in 'available' state. */
  availableToman: number;
  /** Sum of commission_amount for entries currently 'requested'. */
  requestedToman: number;
  /** Lifetime sum for 'paid' entries. */
  paidToman: number;
  /** Lifetime sum across all states except rejected/flagged. */
  totalEarnedToman: number;
  /** Click count from referral_codes denormalized counter. */
  clicks: number;
  /** Distinct signups attributed (status >= signed_up). */
  signups: number;
  /** Distinct yearly conversions that earned commission. */
  yearlyConversions: number;
};

export async function getAffiliateBalance(
  userId: string,
): Promise<AffiliateBalance> {
  const db = getDb();

  const code = await db.query.referralCodes.findFirst({
    where: and(
      eq(referralCodes.userId, userId),
      eq(referralCodes.kind, "affiliate"),
    ),
    columns: { id: true, clicksCount: true },
  });

  if (!code) {
    return {
      pendingToman: 0,
      availableToman: 0,
      requestedToman: 0,
      paidToman: 0,
      totalEarnedToman: 0,
      clicks: 0,
      signups: 0,
      yearlyConversions: 0,
    };
  }

  const rows = await db
    .select({
      status: referrals.commissionStatus,
      total: sql<number>`coalesce(sum(${referrals.commissionAmountToman}),0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(referrals)
    .where(eq(referrals.referrerUserId, userId))
    .groupBy(referrals.commissionStatus);

  let pending = 0,
    available = 0,
    requested = 0,
    paid = 0,
    yearly = 0;
  for (const r of rows) {
    if (r.status === "pending") {
      pending = r.total;
      yearly += r.n;
    } else if (r.status === "available") {
      available = r.total;
      yearly += r.n;
    } else if (r.status === "requested") {
      requested = r.total;
      yearly += r.n;
    } else if (r.status === "paid") {
      paid = r.total;
      yearly += r.n;
    }
  }

  // Signups: any referral row past 'clicked'.
  const [{ n: signups }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(referrals)
    .where(
      and(
        eq(referrals.referrerUserId, userId),
        sql`${referrals.status} != 'clicked'`,
      ),
    );

  return {
    pendingToman: pending,
    availableToman: available,
    requestedToman: requested,
    paidToman: paid,
    totalEarnedToman: pending + available + requested + paid,
    clicks: code.clicksCount,
    signups,
    yearlyConversions: yearly,
  };
}

export type LedgerEntry = {
  id: string;
  refereeMaskedHandle: string;
  refereeMaskedPhone: string;
  billingCycle: "monthly" | "annual" | null;
  netAmountToman: number | null;
  commissionToman: number | null;
  commissionStatus:
    | "pending"
    | "available"
    | "requested"
    | "paid"
    | "rejected"
    | "flagged"
    | null;
  unlockAt: Date | null;
  rewardedAt: Date | null;
  payoutId: string | null;
};

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  const last4 = phone.slice(-4);
  return `••• ${last4}`;
}
function maskSlug(slug: string | null): string {
  if (!slug) return "—";
  if (slug.length <= 2) return slug[0] + "•";
  return slug[0] + "•".repeat(Math.min(slug.length - 2, 6)) + slug.slice(-1);
}

export async function listAffiliateLedger(
  userId: string,
  limit = 100,
): Promise<LedgerEntry[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: referrals.id,
      refereePhone: users.phone,
      refereeSlug: profiles.slug,
      billingCycle: referrals.commissionBillingCycle,
      netAmount: referrals.commissionNetAmountToman,
      commission: referrals.commissionAmountToman,
      status: referrals.commissionStatus,
      unlockAt: referrals.commissionUnlockAt,
      rewardedAt: referrals.rewardedAt,
      payoutId: referrals.affiliatePayoutId,
    })
    .from(referrals)
    .leftJoin(users, eq(users.id, referrals.refereeUserId))
    .leftJoin(profiles, eq(profiles.id, referrals.convertingPageId))
    .where(
      and(
        eq(referrals.referrerUserId, userId),
        sql`${referrals.commissionStatus} IS NOT NULL`,
      ),
    )
    .orderBy(desc(referrals.rewardedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    refereeMaskedHandle: maskSlug(r.refereeSlug),
    refereeMaskedPhone: maskPhone(r.refereePhone),
    billingCycle: (r.billingCycle as "monthly" | "annual" | null) ?? null,
    netAmountToman: r.netAmount,
    commissionToman: r.commission,
    commissionStatus: (r.status as LedgerEntry["commissionStatus"]) ?? null,
    unlockAt: r.unlockAt ?? null,
    rewardedAt: r.rewardedAt ?? null,
    payoutId: r.payoutId ?? null,
  }));
}

export type AdminLedgerEntry = LedgerEntry & {
  affiliateUserId: string;
  affiliateName: string;
  affiliatePhone: string;
};

/**
 * Cross-affiliate commission ledger for admin reconciliation.
 * Returns every referral row that ever earned commission, optionally
 * filtered by affiliate, status, or rewarded-date range.
 */
export async function listAdminLedger(
  filter: {
    affiliateUserId?: string;
    status?: LedgerEntry["commissionStatus"];
    limit?: number;
  } = {},
): Promise<AdminLedgerEntry[]> {
  const db = getDb();
  const limit = filter.limit ?? 500;
  const conditions = [sql`${referrals.commissionStatus} IS NOT NULL`];
  if (filter.affiliateUserId) {
    conditions.push(eq(referrals.referrerUserId, filter.affiliateUserId));
  }
  if (filter.status) {
    conditions.push(eq(referrals.commissionStatus, filter.status));
  }
  const refereeUsers = alias(users, "referee_user");
  const rows = await db
    .select({
      id: referrals.id,
      affiliateUserId: referrals.referrerUserId,
      affiliatePhone: users.phone,
      affiliateName: affiliateProfiles.displayName,
      refereePhone: refereeUsers.phone,
      refereeSlug: profiles.slug,
      billingCycle: referrals.commissionBillingCycle,
      netAmount: referrals.commissionNetAmountToman,
      commission: referrals.commissionAmountToman,
      status: referrals.commissionStatus,
      unlockAt: referrals.commissionUnlockAt,
      rewardedAt: referrals.rewardedAt,
      payoutId: referrals.affiliatePayoutId,
    })
    .from(referrals)
    .innerJoin(users, eq(users.id, referrals.referrerUserId))
    .leftJoin(
      affiliateProfiles,
      eq(affiliateProfiles.userId, referrals.referrerUserId),
    )
    .leftJoin(refereeUsers, eq(refereeUsers.id, referrals.refereeUserId))
    .leftJoin(profiles, eq(profiles.id, referrals.convertingPageId))
    .where(and(...conditions))
    .orderBy(desc(referrals.rewardedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    affiliateUserId: r.affiliateUserId,
    affiliateName: r.affiliateName ?? r.affiliatePhone,
    affiliatePhone: r.affiliatePhone,
    refereeMaskedHandle: maskSlug(r.refereeSlug),
    refereeMaskedPhone: maskPhone(r.refereePhone),
    billingCycle: (r.billingCycle as "monthly" | "annual" | null) ?? null,
    netAmountToman: r.netAmount,
    commissionToman: r.commission,
    commissionStatus: (r.status as LedgerEntry["commissionStatus"]) ?? null,
    unlockAt: r.unlockAt ?? null,
    rewardedAt: r.rewardedAt ?? null,
    payoutId: r.payoutId ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Payout request (affiliate-side)
// ---------------------------------------------------------------------------

export type PayoutRequestInput = {
  userId: string;
  /** New banking info if the affiliate wants to update before requesting. */
  shebaNumber?: string;
  accountHolderName?: string;
  nationalId?: string;
};

export type PayoutRequestOutcome =
  | { ok: true; payoutId: string; amount: number }
  | {
      ok: false;
      reason:
        | "not_affiliate"
        | "below_threshold"
        | "no_available"
        | "missing_banking";
      details?: { availableToman: number; minToman: number };
    };

export async function requestAffiliatePayout(
  input: PayoutRequestInput,
): Promise<PayoutRequestOutcome> {
  const db = getDb();

  const code = await db.query.referralCodes.findFirst({
    where: and(
      eq(referralCodes.userId, input.userId),
      eq(referralCodes.kind, "affiliate"),
    ),
  });
  if (!code) return { ok: false, reason: "not_affiliate" };
  if (code.affiliateStatus === "banned") {
    return { ok: false, reason: "not_affiliate" };
  }

  const minToman = code.minWithdrawalToman ?? 5_000_000;

  // Update banking info on the profile if provided.
  if (input.shebaNumber || input.accountHolderName || input.nationalId) {
    await db
      .insert(affiliateProfiles)
      .values({
        userId: input.userId,
        displayName: "—",
        channelKind: "other",
        channelUrl: "",
        shebaNumber: input.shebaNumber ?? null,
        accountHolderName: input.accountHolderName ?? null,
        nationalId: input.nationalId ?? null,
      })
      .onConflictDoUpdate({
        target: affiliateProfiles.userId,
        set: {
          ...(input.shebaNumber !== undefined && {
            shebaNumber: input.shebaNumber,
          }),
          ...(input.accountHolderName !== undefined && {
            accountHolderName: input.accountHolderName,
          }),
          ...(input.nationalId !== undefined && {
            nationalId: input.nationalId,
          }),
          updatedAt: new Date(),
        },
      });
  }

  const profile = await db.query.affiliateProfiles.findFirst({
    where: eq(affiliateProfiles.userId, input.userId),
  });
  if (!profile?.shebaNumber || !profile.accountHolderName) {
    return { ok: false, reason: "missing_banking" };
  }

  const outcome: { value: PayoutRequestOutcome | null } = { value: null };

  await db.transaction(async (tx) => {
    // Lock all available entries for this user. SELECT FOR UPDATE so a
    // racing payout submission can't claim the same rows.
    const lockedRowsRaw = (await tx.execute(sql`
      SELECT "id", "commission_amount_toman" AS amount
        FROM "referrals"
        WHERE "referrer_user_id" = ${input.userId}::uuid
          AND "commission_status" = 'available'
          AND "affiliate_payout_id" IS NULL
        ORDER BY "rewarded_at" ASC
        FOR UPDATE
    `)) as unknown as
      | Array<{ id: string; amount: number }>
      | { rows?: Array<{ id: string; amount: number }> };
    const lockedRows = Array.isArray(lockedRowsRaw)
      ? lockedRowsRaw
      : (lockedRowsRaw.rows ?? []);

    if (lockedRows.length === 0) {
      outcome.value = { ok: false, reason: "no_available" };
      return;
    }

    const totalAvailable = lockedRows.reduce(
      (sum, r) => sum + (r.amount ?? 0),
      0,
    );
    if (totalAvailable < minToman) {
      outcome.value = {
        ok: false,
        reason: "below_threshold",
        details: { availableToman: totalAvailable, minToman },
      };
      return;
    }

    // Insert the payout row first to get its id.
    const [payout] = await tx
      .insert(affiliatePayouts)
      .values({
        userId: input.userId,
        requestedAmountToman: totalAvailable,
        status: "requested",
        shebaSnapshot: profile.shebaNumber!,
        holderNameSnapshot: profile.accountHolderName!,
        nationalIdSnapshot: profile.nationalId,
      })
      .returning({ id: affiliatePayouts.id });

    // Claim all locked rows by flipping status + setting payout id.
    await tx
      .update(referrals)
      .set({
        commissionStatus: "requested",
        affiliatePayoutId: payout.id,
        updatedAt: new Date(),
      })
      .where(
        inArray(
          referrals.id,
          lockedRows.map((r) => r.id),
        ),
      );

    outcome.value = {
      ok: true,
      payoutId: payout.id,
      amount: totalAvailable,
    };
  });

  if (outcome.value?.ok) {
    try {
      const u = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
        columns: { phone: true },
      });
      if (u?.phone) {
        await enqueueSms({
          templateKey: "affiliate_payout_requested",
          phone: u.phone,
          idempotencyKey: `aff_payout_req:${outcome.value.payoutId}`,
          variables: { amount: outcome.value.amount },
          userId: input.userId,
        });
      }
    } catch (err) {
      log.warn("affiliate.sms.payout_requested.failed", {
        error: (err as Error).message,
      });
    }
  }

  return outcome.value ?? { ok: false, reason: "no_available" };
}

// ---------------------------------------------------------------------------
// Payout processing (admin-side)
// ---------------------------------------------------------------------------

export async function markPayoutProcessing(args: {
  payoutId: string;
  adminUserId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .update(affiliatePayouts)
    .set({
      status: "processing",
      processedByUserId: args.adminUserId,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(affiliatePayouts.id, args.payoutId));
  await recordAdminAudit({
    actorUserId: args.adminUserId,
    action: "affiliate.payout.processing",
    metadata: { payoutId: args.payoutId },
  });
}

export async function markPayoutPaid(args: {
  payoutId: string;
  adminUserId: string;
  transactionRef: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const db = getDb();
  let userId: string | null = null;
  let amount: number | null = null;
  let phone: string | null = null;

  await db.transaction(async (tx) => {
    const payout = await tx.query.affiliatePayouts.findFirst({
      where: eq(affiliatePayouts.id, args.payoutId),
    });
    if (!payout) return;
    if (payout.status === "paid") {
      userId = payout.userId;
      amount = payout.requestedAmountToman;
      return;
    }
    if (payout.status === "rejected") {
      return;
    }
    await tx
      .update(affiliatePayouts)
      .set({
        status: "paid",
        transactionRef: args.transactionRef,
        processedByUserId: args.adminUserId,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(affiliatePayouts.id, payout.id));
    await tx
      .update(referrals)
      .set({ commissionStatus: "paid", updatedAt: new Date() })
      .where(eq(referrals.affiliatePayoutId, payout.id));
    userId = payout.userId;
    amount = payout.requestedAmountToman;

    await recordAdminAudit(
      {
        actorUserId: args.adminUserId,
        action: "affiliate.payout.paid",
        targetUserId: payout.userId,
        metadata: {
          payoutId: payout.id,
          transactionRef: args.transactionRef,
          amount: payout.requestedAmountToman,
        },
      },
      tx,
    );
  });

  if (userId && amount) {
    try {
      const u = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { phone: true },
      });
      phone = u?.phone ?? null;
      if (phone) {
        await enqueueSms({
          templateKey: "affiliate_payout_paid",
          phone,
          idempotencyKey: `aff_payout_paid:${args.payoutId}`,
          variables: { amount, ref: args.transactionRef },
          userId,
        });
      }
    } catch (err) {
      log.warn("affiliate.sms.payout_paid.failed", {
        error: (err as Error).message,
      });
    }
    return { ok: true };
  }
  return { ok: false, reason: "not_found_or_terminal" };
}

export async function rejectPayout(args: {
  payoutId: string;
  adminUserId: string;
  reason: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const db = getDb();
  let userId: string | null = null;

  await db.transaction(async (tx) => {
    const payout = await tx.query.affiliatePayouts.findFirst({
      where: eq(affiliatePayouts.id, args.payoutId),
    });
    if (!payout) return;
    if (payout.status === "paid" || payout.status === "rejected") return;

    await tx
      .update(affiliatePayouts)
      .set({
        status: "rejected",
        rejectedReason: args.reason,
        processedByUserId: args.adminUserId,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(affiliatePayouts.id, payout.id));

    // Re-open the claimed entries: NULL the payout id, return to 'available'.
    await tx
      .update(referrals)
      .set({
        commissionStatus: "available",
        affiliatePayoutId: null,
        updatedAt: new Date(),
      })
      .where(eq(referrals.affiliatePayoutId, payout.id));
    userId = payout.userId;

    await recordAdminAudit(
      {
        actorUserId: args.adminUserId,
        action: "affiliate.payout.reject",
        targetUserId: payout.userId,
        reason: args.reason,
        metadata: { payoutId: payout.id },
      },
      tx,
    );
  });

  if (userId) {
    try {
      const u = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { phone: true },
      });
      if (u?.phone) {
        await enqueueSms({
          templateKey: "affiliate_payout_rejected",
          phone: u.phone,
          idempotencyKey: `aff_payout_rej:${args.payoutId}`,
          variables: { reason: args.reason },
          userId,
        });
      }
    } catch (err) {
      log.warn("affiliate.sms.payout_rejected.failed", {
        error: (err as Error).message,
      });
    }
    return { ok: true };
  }
  return { ok: false, reason: "not_found_or_terminal" };
}

// ---------------------------------------------------------------------------
// Cron: pending → available transition
// ---------------------------------------------------------------------------

/**
 * Flip every `pending` referral whose `unlock_at` has passed to
 * `available`. Idempotent. Run hourly from `/api/cron/affiliate-unlock`.
 */
export async function unlockMaturedCommissions(now = new Date()): Promise<{
  unlocked: number;
}> {
  const db = getDb();
  const result = (await db.execute(sql`
    UPDATE "referrals"
      SET "commission_status" = 'available', "updated_at" = now()
      WHERE "commission_status" = 'pending'
        AND "commission_unlock_at" IS NOT NULL
        AND "commission_unlock_at" <= ${now}
      RETURNING "id"
  `)) as unknown as Array<{ id: string }> | { rows?: Array<{ id: string }> };
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return { unlocked: rows.length };
}

// ---------------------------------------------------------------------------
// Admin: list views
// ---------------------------------------------------------------------------

export type AdminApplicationRow = {
  id: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "needs_info";
  applicantName: string;
  contactPhone: string;
  contactEmail: string | null;
  channelKind: string;
  channelUrl: string;
  audienceSize: string;
  promotionPlan: string;
  adminNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export async function listAdminApplications(
  filter: {
    status?: "pending" | "approved" | "rejected" | "needs_info";
    limit?: number;
  } = {},
): Promise<AdminApplicationRow[]> {
  const db = getDb();
  const limit = filter.limit ?? 100;
  const where = filter.status
    ? eq(affiliateApplications.status, filter.status)
    : undefined;
  const rows = await db.query.affiliateApplications.findMany({
    where,
    orderBy: [desc(affiliateApplications.createdAt)],
    limit,
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    status: r.status as AdminApplicationRow["status"],
    applicantName: r.applicantName,
    contactPhone: r.contactPhone,
    contactEmail: r.contactEmail,
    channelKind: r.channelKind,
    channelUrl: r.channelUrl,
    audienceSize: r.audienceSize,
    promotionPlan: r.promotionPlan,
    adminNote: r.adminNote,
    reviewedAt: r.reviewedAt,
    createdAt: r.createdAt,
  }));
}

export type AdminAffiliateRow = {
  userId: string;
  phone: string;
  displayName: string;
  channelKind: string;
  channelUrl: string;
  affiliateStatus: "active" | "paused" | "banned";
  code: string;
  approvedAt: Date | null;
  totalEarnedToman: number;
  pendingToman: number;
  availableToman: number;
  paidToman: number;
  yearlyConversions: number;
  clicks: number;
};

export async function listAdminAffiliates(): Promise<AdminAffiliateRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: referralCodes.userId,
      phone: users.phone,
      code: referralCodes.code,
      affiliateStatus: referralCodes.affiliateStatus,
      approvedAt: referralCodes.approvedAt,
      clicks: referralCodes.clicksCount,
      displayName: affiliateProfiles.displayName,
      channelKind: affiliateProfiles.channelKind,
      channelUrl: affiliateProfiles.channelUrl,
    })
    .from(referralCodes)
    .innerJoin(users, eq(users.id, referralCodes.userId))
    .leftJoin(
      affiliateProfiles,
      eq(affiliateProfiles.userId, referralCodes.userId),
    )
    .where(eq(referralCodes.kind, "affiliate"))
    .orderBy(desc(referralCodes.approvedAt));

  // Aggregate commission stats per affiliate in one go.
  const stats = await db
    .select({
      userId: referrals.referrerUserId,
      status: referrals.commissionStatus,
      total: sql<number>`coalesce(sum(${referrals.commissionAmountToman}),0)::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(referrals)
    .where(sql`${referrals.commissionStatus} IS NOT NULL`)
    .groupBy(referrals.referrerUserId, referrals.commissionStatus);

  const statsByUser = new Map<
    string,
    {
      pending: number;
      available: number;
      requested: number;
      paid: number;
      n: number;
    }
  >();
  for (const s of stats) {
    const cur = statsByUser.get(s.userId) ?? {
      pending: 0,
      available: 0,
      requested: 0,
      paid: 0,
      n: 0,
    };
    if (s.status === "pending") cur.pending = s.total;
    else if (s.status === "available") cur.available = s.total;
    else if (s.status === "requested") cur.requested = s.total;
    else if (s.status === "paid") cur.paid = s.total;
    cur.n += s.n;
    statsByUser.set(s.userId, cur);
  }

  return rows.map((r) => {
    const s = statsByUser.get(r.userId) ?? {
      pending: 0,
      available: 0,
      requested: 0,
      paid: 0,
      n: 0,
    };
    return {
      userId: r.userId,
      phone: r.phone,
      displayName: r.displayName ?? "—",
      channelKind: r.channelKind ?? "—",
      channelUrl: r.channelUrl ?? "",
      affiliateStatus: (r.affiliateStatus ?? "active") as
        | "active"
        | "paused"
        | "banned",
      code: r.code,
      approvedAt: r.approvedAt,
      totalEarnedToman: s.pending + s.available + s.requested + s.paid,
      pendingToman: s.pending,
      availableToman: s.available,
      paidToman: s.paid,
      yearlyConversions: s.n,
      clicks: r.clicks,
    };
  });
}

export type AdminPayoutRow = {
  id: string;
  userId: string;
  affiliateName: string;
  affiliatePhone: string;
  amountToman: number;
  status: "requested" | "processing" | "paid" | "rejected";
  shebaSnapshot: string;
  holderNameSnapshot: string;
  nationalIdSnapshot: string | null;
  transactionRef: string | null;
  rejectedReason: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

export async function listAdminPayouts(
  filter: {
    status?: "requested" | "processing" | "paid" | "rejected";
    limit?: number;
  } = {},
): Promise<AdminPayoutRow[]> {
  const db = getDb();
  const limit = filter.limit ?? 200;
  const rows = await db
    .select({
      id: affiliatePayouts.id,
      userId: affiliatePayouts.userId,
      amount: affiliatePayouts.requestedAmountToman,
      status: affiliatePayouts.status,
      sheba: affiliatePayouts.shebaSnapshot,
      holder: affiliatePayouts.holderNameSnapshot,
      nationalId: affiliatePayouts.nationalIdSnapshot,
      ref: affiliatePayouts.transactionRef,
      rejected: affiliatePayouts.rejectedReason,
      createdAt: affiliatePayouts.createdAt,
      paidAt: affiliatePayouts.paidAt,
      phone: users.phone,
      displayName: affiliateProfiles.displayName,
    })
    .from(affiliatePayouts)
    .innerJoin(users, eq(users.id, affiliatePayouts.userId))
    .leftJoin(
      affiliateProfiles,
      eq(affiliateProfiles.userId, affiliatePayouts.userId),
    )
    .where(
      filter.status ? eq(affiliatePayouts.status, filter.status) : undefined,
    )
    .orderBy(desc(affiliatePayouts.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    affiliateName: r.displayName ?? r.phone,
    affiliatePhone: r.phone,
    amountToman: r.amount,
    status: r.status as AdminPayoutRow["status"],
    shebaSnapshot: r.sheba,
    holderNameSnapshot: r.holder,
    nationalIdSnapshot: r.nationalId,
    transactionRef: r.ref,
    rejectedReason: r.rejected,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
  }));
}

export type AdminAffiliateDetail = {
  user: { id: string; phone: string };
  code: { id: string; code: string };
  status: "active" | "paused" | "banned";
  approvedAt: Date | null;
  commissionPct: number;
  holdingPeriodDays: number;
  minWithdrawalToman: number;
  profile: {
    displayName: string;
    channelKind: string;
    channelUrl: string;
    shebaNumber: string | null;
    accountHolderName: string | null;
    nationalId: string | null;
    contactEmail: string | null;
    adminNotes: string | null;
  } | null;
  balance: AffiliateBalance;
  ledger: LedgerEntry[];
  payouts: AdminPayoutRow[];
};

export async function getAdminAffiliateDetail(
  userId: string,
): Promise<AdminAffiliateDetail | null> {
  const db = getDb();
  const code = await db.query.referralCodes.findFirst({
    where: and(
      eq(referralCodes.userId, userId),
      eq(referralCodes.kind, "affiliate"),
    ),
  });
  if (!code) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, phone: true },
  });
  if (!user) return null;
  const profile = await db.query.affiliateProfiles.findFirst({
    where: eq(affiliateProfiles.userId, userId),
  });
  const [balance, ledger, payouts] = await Promise.all([
    getAffiliateBalance(userId),
    listAffiliateLedger(userId, 200),
    listAdminPayouts({ limit: 100 }).then((rows) =>
      rows.filter((r) => r.userId === userId),
    ),
  ]);
  return {
    user,
    code: { id: code.id, code: code.code },
    status: (code.affiliateStatus ?? "active") as
      | "active"
      | "paused"
      | "banned",
    approvedAt: code.approvedAt,
    commissionPct: code.commissionPct ?? 30,
    holdingPeriodDays: code.holdingPeriodDays ?? 30,
    minWithdrawalToman: code.minWithdrawalToman ?? 5_000_000,
    profile: profile
      ? {
          displayName: profile.displayName,
          channelKind: profile.channelKind,
          channelUrl: profile.channelUrl,
          shebaNumber: profile.shebaNumber,
          accountHolderName: profile.accountHolderName,
          nationalId: profile.nationalId,
          contactEmail: profile.contactEmail,
          adminNotes: profile.adminNotes,
        }
      : null,
    balance,
    ledger,
    payouts,
  };
}

export async function updateAffiliateBanking(args: {
  userId: string;
  shebaNumber?: string | null;
  accountHolderName?: string | null;
  nationalId?: string | null;
  contactEmail?: string | null;
}): Promise<void> {
  const db = getDb();
  // Ensure a profile row exists.
  await db
    .insert(affiliateProfiles)
    .values({
      userId: args.userId,
      displayName: "—",
      channelKind: "other",
      channelUrl: "",
      shebaNumber: args.shebaNumber ?? null,
      accountHolderName: args.accountHolderName ?? null,
      nationalId: args.nationalId ?? null,
      contactEmail: args.contactEmail ?? null,
    })
    .onConflictDoUpdate({
      target: affiliateProfiles.userId,
      set: {
        ...(args.shebaNumber !== undefined && {
          shebaNumber: args.shebaNumber,
        }),
        ...(args.accountHolderName !== undefined && {
          accountHolderName: args.accountHolderName,
        }),
        ...(args.nationalId !== undefined && {
          nationalId: args.nationalId,
        }),
        ...(args.contactEmail !== undefined && {
          contactEmail: args.contactEmail,
        }),
        updatedAt: new Date(),
      },
    });
}

/**
 * Admin-only: write the admin_notes field on the affiliate's profile.
 * Used for off-platform context (call notes, special arrangements, etc).
 */
export async function updateAffiliateAdminNotes(args: {
  userId: string;
  notes: string | null;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(affiliateProfiles)
    .values({
      userId: args.userId,
      displayName: "—",
      channelKind: "other",
      channelUrl: "",
      adminNotes: args.notes,
    })
    .onConflictDoUpdate({
      target: affiliateProfiles.userId,
      set: {
        adminNotes: args.notes,
        updatedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// Helpers used by `lib/referrals.ts` conversion branch.
// ---------------------------------------------------------------------------

/**
 * Look up the affiliate metadata on a referral_codes row. Returns null
 * if the code is a regular user code (so the conversion handler runs
 * the existing free-month path).
 */
export type AffiliateCodeMeta = {
  referralCodeId: string;
  affiliateUserId: string;
  affiliateStatus: "active" | "paused" | "banned";
  commissionPct: number;
  holdingPeriodDays: number;
  minWithdrawalToman: number;
};

export async function loadAffiliateMetaForCode(
  exec: Executor,
  referralCodeId: string,
): Promise<AffiliateCodeMeta | null> {
  const row = await exec.query.referralCodes.findFirst({
    where: eq(referralCodes.id, referralCodeId),
  });
  if (!row || row.kind !== "affiliate") return null;
  return {
    referralCodeId: row.id,
    affiliateUserId: row.userId,
    affiliateStatus: (row.affiliateStatus ?? "active") as
      | "active"
      | "paused"
      | "banned",
    commissionPct: row.commissionPct ?? 30,
    holdingPeriodDays: row.holdingPeriodDays ?? 30,
    minWithdrawalToman: row.minWithdrawalToman ?? 5_000_000,
  };
}

/**
 * Helpers for the dashboard hero / OG / public page. Returns the
 * affiliate's display info from `affiliate_profiles`.
 */
export async function getAffiliatePublicInfo(userId: string): Promise<{
  displayName: string;
  channelKind: string;
  channelUrl: string;
  code: string;
} | null> {
  const db = getDb();
  const code = await db.query.referralCodes.findFirst({
    where: and(
      eq(referralCodes.userId, userId),
      eq(referralCodes.kind, "affiliate"),
    ),
  });
  if (!code) return null;
  const profile = await db.query.affiliateProfiles.findFirst({
    where: eq(affiliateProfiles.userId, userId),
  });
  return {
    displayName: profile?.displayName ?? "—",
    channelKind: profile?.channelKind ?? "other",
    channelUrl: profile?.channelUrl ?? "",
    code: code.code,
  };
}

export async function getAffiliatePayoutHistory(
  userId: string,
  limit = 50,
): Promise<AdminPayoutRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: affiliatePayouts.id,
      amount: affiliatePayouts.requestedAmountToman,
      status: affiliatePayouts.status,
      sheba: affiliatePayouts.shebaSnapshot,
      holder: affiliatePayouts.holderNameSnapshot,
      nationalId: affiliatePayouts.nationalIdSnapshot,
      ref: affiliatePayouts.transactionRef,
      rejected: affiliatePayouts.rejectedReason,
      createdAt: affiliatePayouts.createdAt,
      paidAt: affiliatePayouts.paidAt,
    })
    .from(affiliatePayouts)
    .where(eq(affiliatePayouts.userId, userId))
    .orderBy(desc(affiliatePayouts.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    userId,
    affiliateName: "",
    affiliatePhone: "",
    amountToman: r.amount,
    status: r.status as AdminPayoutRow["status"],
    shebaSnapshot: r.sheba,
    holderNameSnapshot: r.holder,
    nationalIdSnapshot: r.nationalId,
    transactionRef: r.ref,
    rejectedReason: r.rejected,
    createdAt: r.createdAt,
    paidAt: r.paidAt,
  }));
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isYearly(cycle: string | null | undefined): boolean {
  return cycle === "annual";
}

// Quiet "unused import" complaints for re-use surface area.
void asc;
void isNull;
void invoices;
void payments;
void lt;
