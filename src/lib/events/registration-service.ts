import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import {
  eventCheckins,
  eventDiscountCodes,
  eventQuestions,
  eventRegistrations,
  eventTicketTypes,
  events,
} from "@/db/schema";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { computeDiscountedAmount } from "@/lib/events/discount";
import {
  decideInitialStatus,
  SPOT_STATUSES,
  ticketSaleState,
  type RegistrationStatus,
} from "@/lib/events/state";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export type { RegistrationStatus };

export type RegisterResult =
  | { ok: true; status: RegistrationStatus; registrationId: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Count confirmed spots INSIDE a transaction. With ticket types, capacity is
 * tracked PER TIER, so pass `ticketTypeId` to count only that tier's confirmed
 * registrations. Caller must have already locked the relevant row (`FOR UPDATE`)
 * so the count→decision→write is race-safe against concurrent registrations.
 */
async function countSpots(
  tx: Tx,
  eventId: string,
  ticketTypeId: string,
): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.ticketTypeId, ticketTypeId),
        inArray(eventRegistrations.status, [...SPOT_STATUSES]),
      ),
    );
  return Number(row?.n ?? 0);
}

/** Lock the event row (validates it's still published / not cancelled). */
async function lockEvent(tx: Tx, eventId: string) {
  const rows = (await tx.execute(
    sql`SELECT id, status, receipt_upload_enabled, price_toman
        FROM events WHERE id = ${eventId} FOR UPDATE`,
  )) as unknown as Array<{
    id: string;
    status: "draft" | "published" | "cancelled";
    receipt_upload_enabled: boolean;
    price_toman: number;
  }>;
  return rows[0] ?? null;
}

/**
 * Lock a ticket-type row for the rest of the transaction (per-tier capacity +
 * pricing guard). Returns null if the tier doesn't belong to `eventId`.
 */
async function lockTicketType(tx: Tx, ticketTypeId: string, eventId: string) {
  const rows = (await tx.execute(
    sql`SELECT id, event_id, price_type, price_toman, approval_required,
               capacity, waitlist_enabled, is_active, available_from,
               available_until
        FROM event_ticket_types
        WHERE id = ${ticketTypeId} AND event_id = ${eventId} FOR UPDATE`,
  )) as unknown as Array<{
    id: string;
    event_id: string;
    price_type: "free" | "paid";
    price_toman: number;
    approval_required: boolean;
    capacity: number | null;
    waitlist_enabled: boolean;
    is_active: boolean;
    available_from: Date | null;
    available_until: Date | null;
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
    ticketTypeId: string;
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

    // Lock the chosen tier; rejects a tier that isn't part of this event.
    const tier = await lockTicketType(tx, input.ticketTypeId, eventId);
    if (!tier) {
      return { ok: false, message: "نوع بلیت انتخاب‌شده معتبر نیست." };
    }

    // Sales window / active check (clock-based, kept out of the pure decision).
    const sale = ticketSaleState(
      {
        isActive: tier.is_active,
        availableFrom: tier.available_from,
        availableUntil: tier.available_until,
      },
      new Date(),
    );
    if (sale !== "open") {
      const msg =
        sale === "not_started"
          ? "فروش این بلیت هنوز آغاز نشده است."
          : sale === "ended"
            ? "مهلت تهیه این بلیت به پایان رسیده است."
            : "این بلیت در دسترس نیست.";
      return { ok: false, message: msg };
    }

    // Idempotency: existing registration → return its current status. One
    // registration per (event, user) — re-picking a tier requires cancelling
    // the current one first.
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

    // Capacity + initial status are decided from the TIER's config.
    const confirmedSpots = await countSpots(tx, eventId, tier.id);
    const decision = decideInitialStatus(
      {
        approvalRequired: tier.approval_required,
        receiptUploadEnabled: ev.receipt_upload_enabled,
        waitlistEnabled: tier.waitlist_enabled,
        priceType: tier.price_type,
        capacity: tier.capacity,
      },
      confirmedSpots,
    );
    if ("full" in decision) {
      return {
        ok: false,
        message: "ظرفیت این بلیت تکمیل شده است.",
      };
    }

    // Discount: validate + (atomically) bump usedCount when the tier is paid.
    let expectedToman = tier.price_type === "paid" ? tier.price_toman : 0;
    let appliedCode: string | null = null;
    if (tier.price_type === "paid" && input.discountCode) {
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
          tier.price_toman,
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
      // Re-register a previously cancelled row in place (possibly a new tier).
      const [row] = await tx
        .update(eventRegistrations)
        .set({
          ticketTypeId: tier.id,
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
        ticketTypeId: tier.id,
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
 * Applies (or removes) a discount code to an existing payment_pending
 * registration. Validates the code, bumps usedCount, and updates expectedToman.
 * Pass null code to remove the currently applied discount.
 */
export async function applyDiscountToRegistration(
  eventId: string,
  userId: string,
  code: string | null,
): Promise<
  | { ok: true; originalToman: number; amountToman: number; discountToman: number }
  | { ok: false; message: string }
> {
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const reg = await tx.query.eventRegistrations.findFirst({
      where: and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, userId),
        eq(eventRegistrations.status, "payment_pending"),
      ),
    });
    if (!reg || !reg.ticketTypeId) {
      return { ok: false as const, message: "ثبت‌نام پیدا نشد." };
    }

    const tier = await tx.query.eventTicketTypes.findFirst({
      where: eq(eventTicketTypes.id, reg.ticketTypeId),
    });
    if (!tier || tier.priceType !== "paid") {
      return { ok: false as const, message: "کد تخفیف برای این بلیت کاربرد ندارد." };
    }

    const originalToman = tier.priceToman;

    // Removing discount
    if (!code) {
      // Undo the previously applied discount if any
      if (reg.discountCode) {
        const prevCode = await tx.query.eventDiscountCodes.findFirst({
          where: and(
            eq(eventDiscountCodes.eventId, eventId),
            sql`lower(${eventDiscountCodes.code}) = ${reg.discountCode.toLowerCase()}`,
          ),
        });
        if (prevCode && prevCode.usedCount > 0) {
          await tx
            .update(eventDiscountCodes)
            .set({ usedCount: prevCode.usedCount - 1 })
            .where(eq(eventDiscountCodes.id, prevCode.id));
        }
      }
      await tx
        .update(eventRegistrations)
        .set({ expectedToman: originalToman, discountCode: null })
        .where(eq(eventRegistrations.id, reg.id));
      return {
        ok: true as const,
        originalToman,
        amountToman: originalToman,
        discountToman: 0,
      };
    }

    // Undo previous discount if switching codes
    if (reg.discountCode && reg.discountCode.toLowerCase() !== code.toLowerCase()) {
      const prevCode = await tx.query.eventDiscountCodes.findFirst({
        where: and(
          eq(eventDiscountCodes.eventId, eventId),
          sql`lower(${eventDiscountCodes.code}) = ${reg.discountCode.toLowerCase()}`,
        ),
      });
      if (prevCode && prevCode.usedCount > 0) {
        await tx
          .update(eventDiscountCodes)
          .set({ usedCount: prevCode.usedCount - 1 })
          .where(eq(eventDiscountCodes.id, prevCode.id));
      }
    }

    const discountRow = await tx.query.eventDiscountCodes.findFirst({
      where: and(
        eq(eventDiscountCodes.eventId, eventId),
        sql`lower(${eventDiscountCodes.code}) = ${code.trim().toLowerCase()}`,
      ),
    });
    const valid =
      discountRow &&
      discountRow.isActive &&
      (!discountRow.expiresAt || discountRow.expiresAt.getTime() >= Date.now()) &&
      (discountRow.usageLimit == null || discountRow.usedCount < discountRow.usageLimit);
    if (!valid) {
      return { ok: false as const, message: "کد تخفیف نامعتبر یا منقضی شده است." };
    }

    const { amountToman, discountToman } = computeDiscountedAmount(
      originalToman,
      discountRow.type,
      discountRow.value,
    );

    await tx
      .update(eventDiscountCodes)
      .set({ usedCount: discountRow.usedCount + 1 })
      .where(eq(eventDiscountCodes.id, discountRow.id));

    await tx
      .update(eventRegistrations)
      .set({ expectedToman: amountToman, discountCode: discountRow.code })
      .where(eq(eventRegistrations.id, reg.id));

    return { ok: true as const, originalToman, amountToman, discountToman };
  });

  return result;
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
 * Per-tier capacity guard, used by the approve/attend paths. Locks the tier row
 * and re-counts its confirmed spots inside the caller's transaction. Returns
 * `{ atCapacity: false }` for legacy registrations with no `ticketTypeId`
 * (those predate the tier model and have no per-tier limit to enforce).
 */
async function tierAtCapacity(
  tx: Tx,
  eventId: string,
  ticketTypeId: string | null,
): Promise<boolean> {
  if (!ticketTypeId) return false;
  const tier = await lockTicketType(tx, ticketTypeId, eventId);
  if (!tier) return false;
  if (tier.capacity == null) return false;
  const spots = await countSpots(tx, eventId, ticketTypeId);
  return spots >= tier.capacity;
}

/**
 * Approve a registration. Race-safe: locks the registration's TIER, re-counts
 * that tier's spots, and refuses if approving would exceed the tier capacity.
 * Legal from pending_approval / payment_submitted / waitlisted. Caller MUST have
 * verified page ownership.
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
      with: { event: { columns: { id: true, pageId: true } } },
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
    // Per-tier capacity recheck (the approve path can oversell too).
    if (await tierAtCapacity(tx, reg.event.id, reg.ticketTypeId)) {
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
      with: { event: { columns: { id: true, pageId: true } } },
    });
    if (!reg || reg.event.pageId !== pageId || reg.event.id !== eventId) {
      return { ok: false, message: "ثبت‌نام پیدا نشد." };
    }
    if (reg.status === "rejected" || reg.status === "cancelled") {
      return { ok: false, message: "این ثبت‌نام لغو یا رد شده است." };
    }

    // Promote to approved if not already confirmed (per-tier capacity recheck).
    if (reg.status !== "approved" && reg.status !== "attended") {
      if (await tierAtCapacity(tx, reg.event.id, reg.ticketTypeId)) {
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
