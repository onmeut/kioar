"use server";

import { revalidatePath } from "next/cache";

import { idleState, type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import {
  deleteEvent,
  saveEvent,
  setEventStatus,
} from "@/lib/events/event-service";
import type { EventFormInput } from "@/lib/events/validations";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { getOwnedPageById, resolveCurrentPageForOwner } from "@/lib/pages";

void idleState;

/**
 * Editor-facing event actions for the unified blocks list on /me. They mirror
 * the form/product block actions: return an {@link ActionState} (never
 * redirect — the block builder lives inline in a dialog) and revalidate /me +
 * the public page. The standalone /my-events actions keep redirecting; these
 * are the inline-editor counterparts.
 */

async function requireEventPage(pageIdField?: string) {
  const viewer = await requireCompletedProfile();
  const page = pageIdField
    ? await getOwnedPageById(pageIdField, viewer.user.id)
    : await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) return { ok: false as const, message: "صفحه پیدا نشد." };
  const granted = await pageHasFeature(page.id, "business_events");
  if (!granted) return { ok: false as const, message: "این قابلیت در پلن شما فعال نیست." };
  return { ok: true as const, viewer, page };
}

function parseJsonArray<T>(raw: FormDataEntryValue | null): T[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function buildInput(formData: FormData): EventFormInput {
  const bool = (k: string) =>
    formData.get(k) === "on" || formData.get(k) === "true";
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    locationType:
      (formData.get("locationType") as "physical" | "online") ?? "physical",
    locationAddress: String(formData.get("locationAddress") ?? ""),
    onlineUrl: String(formData.get("onlineUrl") ?? ""),
    timezone: String(formData.get("timezone") ?? "Asia/Tehran"),
    startDate: String(formData.get("startDate") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
    priceType: (formData.get("priceType") as "free" | "paid") ?? "free",
    priceToman: Number(formData.get("priceToman") ?? 0),
    paymentInstructions: formData.get("paymentInstructions")
      ? String(formData.get("paymentInstructions"))
      : null,
    approvalRequired: bool("approvalRequired"),
    receiptUploadEnabled: bool("receiptUploadEnabled"),
    waitlistEnabled: bool("waitlistEnabled"),
    status: (formData.get("status") as EventFormInput["status"]) ?? "draft",
    questions: parseJsonArray(formData.get("questions")),
    discountCodes: parseJsonArray(formData.get("discountCodes")),
  };
}

/**
 * Inline create/update used by the in-editor event builder dialog. Unlike
 * `saveEventAction` in /my-events/actions.ts, this returns success state +
 * the event id (so the dialog can close and the list resync) instead of
 * redirecting to the manage page.
 */
export async function saveEventBlockAction(
  _prev: ActionState & { id?: string; slug?: string },
  formData: FormData,
): Promise<ActionState & { id?: string; slug?: string }> {
  const eventId = formData.get("eventId")
    ? String(formData.get("eventId"))
    : undefined;
  const pageIdField = formData.get("pageId")
    ? String(formData.get("pageId"))
    : undefined;

  const auth = await requireEventPage(pageIdField);
  if (!auth.ok) return { ...idleState, status: "error", message: auth.message };

  const cover = formData.get("cover");
  const result = await saveEvent(buildInput(formData), {
    pageId: auth.page.id,
    pageSlug: auth.page.slug,
    createdByUserId: auth.viewer.user.id,
    eventId,
    cover: cover instanceof File ? cover : null,
  });

  if (!result.ok) {
    return {
      ...idleState,
      status: "error",
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/me");
  revalidatePath("/my-events");
  revalidatePath(`/${auth.page.slug}`);
  return {
    ...idleState,
    status: "success",
    message: eventId ? "رویداد ذخیره شد." : "رویداد ساخته شد.",
    id: result.eventId,
    slug: result.slug,
  };
}

/**
 * Toggle an event block's `is_active` flag from the row switch. Public
 * visibility still also requires `status === "published"`, so flipping this
 * off hides the event regardless of publish state — same axis as other blocks.
 */
export async function toggleEventBlockActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const isActive = formData.get("isActive") === "true";
  const auth = await requireEventPage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const db = getDb();
  const updated = await db
    .update(events)
    .set({ isActive })
    .where(and(eq(events.id, eventId), eq(events.pageId, auth.page.id)))
    .returning({ id: events.id });
  if (!updated.length) return { status: "error", message: "رویداد پیدا نشد." };

  await invalidateProfileCacheBySlug(auth.page.slug);
  revalidatePath("/me");
  revalidatePath(`/${auth.page.slug}`);
  return { status: "success", message: "ذخیره شد" };
}

/** Publish / unpublish an event block from the editor (status flip). */
export async function setEventBlockStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const status = formData.get("status") as
    | "draft"
    | "published"
    | "cancelled";
  const auth = await requireEventPage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const result = await setEventStatus(eventId, auth.page.id, auth.page.slug, status);
  if (!result.ok) return { status: "error", message: result.message };

  revalidatePath("/me");
  revalidatePath("/my-events");
  revalidatePath(`/${auth.page.slug}`);
  return { status: "success", message: "ذخیره شد" };
}

/** Delete an event block from the editor (cascades registrations/questions). */
export async function deleteEventBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const auth = await requireEventPage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const result = await deleteEvent(eventId, auth.page.id, auth.page.slug);
  if (!result.ok) {
    return { status: "error", message: result.message ?? "حذف ناموفق بود." };
  }
  revalidatePath("/me");
  revalidatePath("/my-events");
  revalidatePath(`/${auth.page.slug}`);
  return { status: "success", message: "رویداد حذف شد." };
}
