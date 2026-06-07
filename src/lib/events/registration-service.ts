import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import {
  eventCheckins,
  eventDiscountCodes,
  eventQuestions,
  eventRegistrations,
  events,
} from "@/db/schema";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { computeDiscountedAmount } from "@/lib/events/discount";
import {
  decideInitialStatus,
  SPOT_STATUSES,
  type RegistrationStatus,
} from "@/lib/events/state";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type { RegistrationStatus };

export type RegisterResult =
  | { ok: true; status: RegistrationStatus; registrationId: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Count confirmed spots for an event INSIDE a transaction. Caller must have
 * already locked the event row (`FOR UPDATE`) so the count→decision→write is
 * race-safe against concurrent registrations/approvals.
 */
async function countSpots(tx: Tx, eventId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.status, [...SPOT_STATUSES]),
      ),
    );
  return Number(row?.n ?? 0);
}

/** Lock the event row for the rest of the transaction (capacity guard). */
async function lockEvent(tx: Tx, eventId: string) {
  const rows = (await tx.execute(
    sql`SELECT id, capacity, status, approval_required, receipt_upload_enabled,
               waitlist_enabled, price_type, price_toman
        FROM events WHERE id = ${eventId} FOR UPDATE`,
  )) as unknown as Array<{
    id: string;
    capacity: number | null;
    status: "draft" | "published" | "cancelled";
    approval_required: boolean;
    receipt_upload_enabled: boolean;
    waitlist_enabled: boolean;
    price_type: "free" | "paid";
    price_toman: number;
  }>;
  return rows[0] ?? null;
}

/**
 * Register the authenticated `userId` for `eventId`. Enforces:
 *  - event is published,
 *  - required custom questions answered,
 *  - capacity (race-safe via FOR UPDATE on the event row) — covers the
 *    instant-approval path,
 *  - one registration per (event,user) (unique index; re-register returns the
 *    existing row's status).
 *
 * Applies an optional discount code (validates + bumps usedCount in-tx).
 */
export async function registerForEvent(
  eventId: string,
  userId: string,
  input: {
    answers?: Record<string, string | string[]>;
    discountCode?: string | null;
  },
  pageSlug: string,
): Promise<RegisterResult> {
  const db = getDb();

  const result = await db.transaction(async (tx): Promise<RegisterResult> => {
    const ev = await lockEvent(tx, eventId);
    if (!ev || ev.status !== "published") {
      return { ok: false, message: "این رویداد در دسترس نیست." };
    }

    // Idempotency: existing registration → return its current status.
    const existing = await tx.query.eventRegistrations.findFirst({
      where: and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, userId),
      ),
    });
    if (existing && existing.status !== "cancelled") {
      return {
        ok: true,
        status: existing.status,
        registrationId: existing.id,
      };
    }

    // Validate required questions.
    const questions = await tx
      .select()
      .from(eventQuestions)
      .where(eq(eventQuestions.eventId, eventId));
    const answers = input.answers ?? {};
    for (const q of questions) {
      if (!q.required) continue;
      const a = answers[q.id];
      const empty =
        a == null ||
        (typeof a === "string" && a.trim() === "") ||
        (Array.isArray(a) && a.length === 0);
      if (empty) {
        return {
          ok: false,
          message: "لطفاً به سؤال‌های اجباری پاسخ دهید.",
          fieldErrors: { [q.id]: ["این سؤال اجباری است."] },
        };
      }
    }

    const confirmedSpots = await countSpots(tx, eventId);
    const decision = decideInitialStatus(
      {
        approvalRequired: ev.approval_required,
        receiptUploadEnabled: ev.receipt_upload_enabled,
        waitlistEnabled: ev.waitlist_enabled,
        priceType: ev.price_type,
        capacity: ev.capacity,
      },
      confirmedSpots,
    );
    if ("full" in decision) {
      return {
        ok: false,
        message: "ظرفیت این رویداد تکمیل شده است.",
      };
    }

    // Discount: validate + (atomically) bump usedCount when paid.
    let expectedToman = ev.price_type === "paid" ? ev.price_toman : 0;
    let appliedCode: string | null = null;
    if (ev.price_type === "paid" && input.discountCode) {
      const code = await tx.query.eventDiscountCodes.findFirst({
        where: and(
          eq(eventDiscountCodes.eventId, eventId),
          sql`lower(${eventDiscountCodes.code}) = ${input.discountCode
            .trim()
            .toLowerCase()}`,
        ),
      });
      const valid =
        code &&
        code.isActive &&
        (!code.expiresAt || code.expiresAt.getTime() >= Date.now()) &&
        (code.usageLimit == null || code.usedCount < code.usageLimit);
      if (valid) {
        const { amountToman } = computeDiscountedAmount(
          ev.price_toman,
          code.type,
          code.value,
        );
        expectedToman = amountToman;
        appliedCode = code.code;
        await tx
          .update(eventDiscountCodes)
          .set({ usedCount: code.usedCount + 1 })
          .where(eq(eventDiscountCodes.id, code.id));
      }
      // Invalid codes are silently ignored at register time — the public page
      // validates live before submit, so this only races a just-expired code.
    }

    if (existing) {
      // Re-register a previously cancelled row in place.
      const [row] = await tx
        .update(eventRegistrations)
        .set({
          status: decision.status,
          answers,
          discountCode: appliedCode,
          expectedToman,
          decidedAt: null,
          cancelledAt: null,
        })
        .where(eq(eventRegistrations.id, existing.id))
        .returning({ id: eventRegistrations.id });
      return { ok: true, status: decision.status, registrationId: row.id };
    }

    const [row] = await tx
      .insert(eventRegistrations)
      .values({
        eventId,
        userId,
        status: decision.status,
        answers,
        discountCode: appliedCode,
        expectedToman,
      })
      .returning({ id: eventRegistrations.id });
    return { ok: true, status: decision.status, registrationId: row.id };
  });

  if (result.ok) await invalidateProfileCacheBySlug(pageSlug);
  return result;
}

/**
 * Attendee cancels their own upcoming registration (frees a spot). Only legal
 * from non-terminal statuses; `attended` and already-`cancelled` are no-ops.
 */
export async function cancelOwnRegistration(
  eventId: string,
  userId: string,
  pageSlug: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = getDb();
  const updated = await db
    .update(eventRegistrations)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, userId),
        inArray(eventRegistrations.status, [
          "pending_approval",
          "payment_pending",
          "payment_submitted",
          "approved",
          "waitlisted",
        ]),
      ),
    )
    .returning({ id: eventRegistrations.id });
  if (!updated.length) {
    return { ok: false, message: "ثبت‌نام قابل لغو پیدا نشد." };
  }
  await invalidateProfileCacheBySlug(pageSlug);
  return { ok: true };
}

/**
 * Attendee submits a payment receipt (key from a private upload). Moves
 * payment_pending → payment_submitted. Caller uploads the file and passes the
 * stored key.
 */
export async function submitReceipt(
  eventId: string,
  userId: string,
  receiptKey: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = getDb();
  const updated = await db
    .update(eventRegistrations)
    .set({ status: "payment_submitted", receiptKey })
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, userId),
        inArray(eventRegistrations.status, [
          "payment_pending",
          "payment_submitted",
        ]),
      ),
    )
    .returning({ id: eventRegistrations.id });
  if (!updated.length) {
    return { ok: false, message: "ثبت‌نام در وضعیت پرداخت نیست." };
  }
  // Receipt status doesn't change public rendering — no cache invalidation.
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Host actions (used by the management view, Increment 8). Kept here so the
// state machine + capacity guard live in one place.
// ---------------------------------------------------------------------------

/**
 * Approve a registration. Race-safe: locks the event row, re-counts spots, and
 * refuses if approving would exceed capacity. Legal from pending_approval /
 * payment_submitted / waitlisted. Caller MUST have verified page ownership.
 */
export async function approveRegistration(
  registrationId: string,
  pageId: string,
  pageSlug: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const reg = await tx.query.eventRegistrations.findFirst({
      where: eq(eventRegistrations.id, registrationId),
      with: { event: { columns: { id: true, pageId: true, capacity: true } } },
    });
    if (!reg || reg.event.pageId !== pageId) {
      return { ok: false, message: "ثبت‌نام پیدا نشد." };
    }
    if (
      !["pending_approval", "payment_submitted", "waitlisted"].includes(
        reg.status,
      )
    ) {
      return { ok: false, message: "این ثبت‌نام قابل تأیید نیست." };
    }
    // Lock event + capacity recheck (the approve path can oversell too).
    await lockEvent(tx, reg.event.id);
    const spots = await countSpots(tx, reg.event.id);
    if (reg.event.capacity != null && spots >= reg.event.capacity) {
      return { ok: false, message: "ظرفیت تکمیل است؛ تأیید ممکن نیست." };
    }
    await tx
      .update(eventRegistrations)
      .set({ status: "approved", decidedAt: new Date() })
      .where(eq(eventRegistrations.id, registrationId));
    return { ok: true };
  });
  if (result.ok) await invalidateProfileCacheBySlug(pageSlug);
  return result;
}

/** Reject a registration. Legal from any non-terminal status. */
export async function rejectRegistration(
  registrationId: string,
  pageId: string,
  pageSlug: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = getDb();
  const reg = await db.query.eventRegistrations.findFirst({
    where: eq(eventRegistrations.id, registrationId),
    with: { event: { columns: { pageId: true } } },
  });
  if (!reg || reg.event.pageId !== pageId) {
    return { ok: false, message: "ثبت‌نام پیدا نشد." };
  }
  await db
    .update(eventRegistrations)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(eq(eventRegistrations.id, registrationId));
  await invalidateProfileCacheBySlug(pageSlug);
  return { ok: true };
}

/**
 * Manually mark a registrant attended (host taps "حاضر شد" without scanning).
 * Approves first if needed (door override), then writes the idempotent check-in
 * audit row. Race-safe on the event row when an approval is required.
 */
export async function markAttendedManually(
  eventId: string,
  registrationId: string,
  pageId: string,
  hostUserId: string,
  pageSlug: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const reg = await tx.query.eventRegistrations.findFirst({
      where: eq(eventRegistrations.id, registrationId),
      with: { event: { columns: { id: true, pageId: true, capacity: true } } },
    });
    if (!reg || reg.event.pageId !== pageId || reg.event.id !== eventId) {
      return { ok: false, message: "ثبت‌نام پیدا نشد." };
    }
    if (reg.status === "rejected" || reg.status === "cancelled") {
      return { ok: false, message: "این ثبت‌نام لغو یا رد شده است." };
    }

    // Promote to approved if not already confirmed (capacity recheck inline).
    if (reg.status !== "approved" && reg.status !== "attended") {
      await lockEvent(tx, reg.event.id);
      const spots = await countSpots(tx, reg.event.id);
      if (reg.event.capacity != null && spots >= reg.event.capacity) {
        return { ok: false, message: "ظرفیت تکمیل است؛ تأیید ممکن نیست." };
      }
    }

    // Idempotent check-in row.
    const existing = await tx.query.eventCheckins.findFirst({
      where: eq(eventCheckins.registrationId, registrationId),
    });
    if (!existing) {
      await tx.insert(eventCheckins).values({
        eventId,
        registrationId,
        userId: reg.userId,
        scannedByUserId: hostUserId,
      });
    }
    await tx
      .update(eventRegistrations)
      .set({ status: "attended", decidedAt: reg.decidedAt ?? new Date() })
      .where(eq(eventRegistrations.id, registrationId));
    return { ok: true };
  });
  if (result.ok) await invalidateProfileCacheBySlug(pageSlug);
  return result;
}

/**
 * Host removes a registrant entirely (frees a spot). Sets status `rejected`,
 * which is the terminal "not coming" state; the audit row (if any) stays for
 * history. Legal from any status.
 */
export async function removeRegistrant(
  registrationId: string,
  pageId: string,
  pageSlug: string,
): Promise<{ ok: boolean; message?: string }> {
  const db = getDb();
  const reg = await db.query.eventRegistrations.findFirst({
    where: eq(eventRegistrations.id, registrationId),
    with: { event: { columns: { pageId: true } } },
  });
  if (!reg || reg.event.pageId !== pageId) {
    return { ok: false, message: "ثبت‌نام پیدا نشد." };
  }
  await db
    .update(eventRegistrations)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(eq(eventRegistrations.id, registrationId));
  await invalidateProfileCacheBySlug(pageSlug);
  return { ok: true };
}

/** Re-export the table for callers that need raw access. */
export { events };
