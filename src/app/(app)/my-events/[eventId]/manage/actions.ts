"use server";

import { revalidatePath } from "next/cache";

import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import { getHostEvent } from "@/lib/events/queries";
import {
  approveRegistration,
  markAttendedManually,
  removeRegistrant,
  rejectRegistration,
} from "@/lib/events/registration-service";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { getPrivateObjectSignedUrl } from "@/lib/storage";
import { idleState, type ActionState } from "@/lib/action-state";

/**
 * Authorize the current user as owner of the page owning `eventId`. Returns the
 * page + receipt key access, or null. Every management mutation funnels here.
 */
async function authorize(eventId: string) {
  const viewer = await requireCompletedProfile();
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) return null;
  if (!(await pageHasFeature(page.id, "business_events"))) return null;
  const data = await getHostEvent(eventId, page.id);
  if (!data) return null;
  return { userId: viewer.user.id, pageId: page.id, pageSlug: page.slug };
}

function revalidate(eventId: string) {
  revalidatePath(`/my-events/${eventId}/manage`);
}

export async function approveRegistrationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const ctx = await authorize(eventId);
  if (!ctx) return { ...idleState, status: "error", message: "دسترسی غیرمجاز." };

  const result = await approveRegistration(
    registrationId,
    ctx.pageId,
    ctx.pageSlug,
  );
  if (!result.ok) {
    return { ...idleState, status: "error", message: result.message };
  }
  revalidate(eventId);
  return { ...idleState, status: "success" };
}

export async function rejectRegistrationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const ctx = await authorize(eventId);
  if (!ctx) return { ...idleState, status: "error", message: "دسترسی غیرمجاز." };

  const result = await rejectRegistration(
    registrationId,
    ctx.pageId,
    ctx.pageSlug,
  );
  if (!result.ok) {
    return { ...idleState, status: "error", message: result.message };
  }
  revalidate(eventId);
  return { ...idleState, status: "success" };
}

/** Manual attendance toggle (host marks present without scanning a QR). */
export async function markAttendedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const ctx = await authorize(eventId);
  if (!ctx) return { ...idleState, status: "error", message: "دسترسی غیرمجاز." };

  const result = await markAttendedManually(
    eventId,
    registrationId,
    ctx.pageId,
    ctx.userId,
    ctx.pageSlug,
  );
  if (!result.ok) {
    return { ...idleState, status: "error", message: result.message };
  }
  revalidate(eventId);
  return { ...idleState, status: "success" };
}

/** Remove a registrant (host kicks them — frees a spot). */
export async function removeRegistrantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const registrationId = String(formData.get("registrationId") ?? "");
  const ctx = await authorize(eventId);
  if (!ctx) return { ...idleState, status: "error", message: "دسترسی غیرمجاز." };

  const result = await removeRegistrant(
    registrationId,
    ctx.pageId,
    ctx.pageSlug,
  );
  if (!result.ok) {
    return { ...idleState, status: "error", message: result.message };
  }
  revalidate(eventId);
  return { ...idleState, status: "success" };
}

/**
 * Mint a short-lived signed URL for a registrant's private receipt. Returns
 * null if unauthorized or the registrant has no receipt. Called from the
 * registrant detail to view the uploaded image.
 */
export async function getReceiptUrlAction(
  eventId: string,
  receiptKey: string,
): Promise<{ url: string | null }> {
  const ctx = await authorize(eventId);
  if (!ctx) return { url: null };
  if (!receiptKey) return { url: null };
  const url = await getPrivateObjectSignedUrl(receiptKey);
  return { url };
}
