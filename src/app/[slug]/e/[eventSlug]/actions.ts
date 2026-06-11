"use server";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { events, eventTicketTypes, profiles } from "@/db/schema";
import { getCurrentViewer } from "@/lib/auth/session";
import { setPendingEventRegistration } from "@/lib/auth/pending-intent";
import { validateDiscountCode } from "@/lib/events/discount";
import {
  applyDiscountToRegistration,
  cancelOwnRegistration,
  registerForEvent,
  submitReceipt,
} from "@/lib/events/registration-service";
import { uploadPrivateImage } from "@/lib/storage";

/** Resolve a published event by page slug + event slug. */
async function resolveEvent(pageSlug: string, eventSlug: string) {
  const db = getDb();
  const row = await db
    .select({
      id: events.id,
      slug: events.slug,
      pageSlug: profiles.slug,
      priceToman: events.priceToman,
      priceType: events.priceType,
      status: events.status,
      receiptUploadEnabled: events.receiptUploadEnabled,
    })
    .from(events)
    .innerJoin(profiles, eq(events.pageId, profiles.id))
    .where(and(eq(events.slug, eventSlug), eq(profiles.slug, pageSlug)))
    .limit(1);
  return row[0] ?? null;
}

export type RegisterActionResult =
  | { ok: true; status: string }
  | { ok: false; message: string; needsAuth?: boolean }
  | { ok: false; redirect: string };

/**
 * Register the current viewer for an event. Enforces account requirement: a
 * logged-out visitor gets a pending-event cookie (carrying their form answers)
 * + a redirect to /auth. After OTP the auth continuation completes the
 * registration server-side and lands them back on this page already
 * registered — no /start detour (see continuePendingEventRegistrationOrRedirect
 * in session.ts).
 */
export async function registerAction(
  pageSlug: string,
  eventSlug: string,
  payload: {
    ticketTypeId: string;
    answers?: Record<string, string | string[]>;
    discountCode?: string | null;
  },
): Promise<RegisterActionResult> {
  const event = await resolveEvent(pageSlug, eventSlug);
  if (!event || event.status !== "published") {
    return { ok: false, message: "این رویداد در دسترس نیست." };
  }
  if (!payload.ticketTypeId) {
    return { ok: false, message: "لطفاً نوع بلیت را انتخاب کنید." };
  }

  const viewer = await getCurrentViewer();
  if (!viewer) {
    await setPendingEventRegistration({
      pageSlug: event.pageSlug,
      eventSlug,
      ticketTypeId: payload.ticketTypeId,
      answers: payload.answers,
      discountCode: payload.discountCode ?? null,
    });
    return { ok: false, redirect: "/auth" };
  }

  const result = await registerForEvent(
    event.id,
    viewer.user.id,
    payload,
    event.pageSlug,
  );
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, status: result.status };
}

export type ApplyDiscountResult =
  | { ok: true; amountToman: number; discountToman: number }
  | { ok: false; message: string };

/**
 * Live discount validation for the register UI (does not bump usedCount).
 * Validates against the SELECTED ticket type's price — a tier may be paid even
 * when other tiers are free. Discount codes remain event-scoped in v1.
 */
export async function applyDiscountAction(
  pageSlug: string,
  eventSlug: string,
  ticketTypeId: string,
  code: string,
): Promise<ApplyDiscountResult> {
  const event = await resolveEvent(pageSlug, eventSlug);
  if (!event) {
    return { ok: false, message: "کد تخفیف برای این رویداد کاربرد ندارد." };
  }
  const db = getDb();
  const [tier] = await db
    .select({
      priceType: eventTicketTypes.priceType,
      priceToman: eventTicketTypes.priceToman,
    })
    .from(eventTicketTypes)
    .where(
      and(
        eq(eventTicketTypes.id, ticketTypeId),
        eq(eventTicketTypes.eventId, event.id),
      ),
    )
    .limit(1);
  if (!tier || tier.priceType !== "paid") {
    return { ok: false, message: "کد تخفیف برای این بلیت کاربرد ندارد." };
  }
  const v = await validateDiscountCode(event.id, code, tier.priceToman);
  if (!v.ok) return { ok: false, message: v.message };
  return {
    ok: true,
    amountToman: v.amountToman,
    discountToman: v.discountToman,
  };
}

export type ApplyDiscountToRegistrationResult =
  | { ok: true; originalToman: number; amountToman: number; discountToman: number }
  | { ok: false; message: string };

/**
 * Apply (or remove) a discount code to an existing payment_pending registration.
 * Pass null to remove the currently applied discount.
 */
export async function applyDiscountToRegistrationAction(
  pageSlug: string,
  eventSlug: string,
  code: string | null,
): Promise<ApplyDiscountToRegistrationResult> {
  const event = await resolveEvent(pageSlug, eventSlug);
  if (!event) return { ok: false, message: "رویداد پیدا نشد." };
  const viewer = await getCurrentViewer();
  if (!viewer) return { ok: false, message: "ابتدا وارد شوید." };
  return applyDiscountToRegistration(event.id, viewer.user.id, code);
}

/** Upload + attach a payment receipt (private storage). */
export async function submitReceiptAction(
  pageSlug: string,
  eventSlug: string,
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const event = await resolveEvent(pageSlug, eventSlug);
  if (!event) return { ok: false, message: "رویداد پیدا نشد." };
  const viewer = await getCurrentViewer();
  if (!viewer) return { ok: false, message: "ابتدا وارد شوید." };

  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "فایل رسید را انتخاب کنید." };
  }
  let key: string | null;
  try {
    key = await uploadPrivateImage(file);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "آپلود رسید ناموفق بود.",
    };
  }
  if (!key) return { ok: false, message: "آپلود رسید ناموفق بود." };

  return submitReceipt(event.id, viewer.user.id, key);
}

/** Attendee cancels their own registration. */
export async function cancelRegistrationAction(
  pageSlug: string,
  eventSlug: string,
): Promise<{ ok: boolean; message?: string }> {
  const event = await resolveEvent(pageSlug, eventSlug);
  if (!event) return { ok: false, message: "رویداد پیدا نشد." };
  const viewer = await getCurrentViewer();
  if (!viewer) return { ok: false, message: "ابتدا وارد شوید." };
  return cancelOwnRegistration(event.id, viewer.user.id, event.pageSlug);
}
