"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import {
  deleteEvent,
  saveEvent,
  setEventStatus,
} from "@/lib/events/event-service";
import type { EventFormInput } from "@/lib/events/validations";
import { getOwnedPageById } from "@/lib/pages";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { idleState, type ActionState } from "@/lib/action-state";

/**
 * Resolve and authorize the host's current page for an event mutation.
 * Returns the page or throws/redirects. Events are Business-gated, so we also
 * confirm the entitlement — a downgraded page can't create new events.
 */
async function requireEventPage(pageIdField?: string) {
  const viewer = await requireCompletedProfile();
  const page = pageIdField
    ? await getOwnedPageById(pageIdField, viewer.user.id)
    : await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) redirect("/me");
  const granted = await pageHasFeature(page.id, "business_events");
  if (!granted) redirect("/me");
  return { viewer, page };
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
  const bool = (k: string) => formData.get(k) === "on" || formData.get(k) === "true";
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
    capacity: formData.get("capacity")
      ? Number(formData.get("capacity"))
      : null,
    priceType: (formData.get("priceType") as "free" | "paid") ?? "free",
    priceToman: Number(formData.get("priceToman") ?? 0),
    approvalRequired: bool("approvalRequired"),
    receiptUploadEnabled: bool("receiptUploadEnabled"),
    waitlistEnabled: bool("waitlistEnabled"),
    status: (formData.get("status") as EventFormInput["status"]) ?? "draft",
    questions: parseJsonArray(formData.get("questions")),
    discountCodes: parseJsonArray(formData.get("discountCodes")),
  };
}

export async function saveEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = formData.get("eventId")
    ? String(formData.get("eventId"))
    : undefined;
  const pageIdField = formData.get("pageId")
    ? String(formData.get("pageId"))
    : undefined;

  const { viewer, page } = await requireEventPage(pageIdField);

  const cover = formData.get("cover");
  const result = await saveEvent(buildInput(formData), {
    pageId: page.id,
    pageSlug: page.slug,
    createdByUserId: viewer.user.id,
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

  revalidatePath("/my-events");
  redirect(
    `/my-events/${result.eventId}/manage` as unknown as Parameters<
      typeof redirect
    >[0],
  );
}

export async function setEventStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const status = formData.get("status") as
    | "draft"
    | "published"
    | "cancelled";
  const { page } = await requireEventPage();

  const result = await setEventStatus(eventId, page.id, page.slug, status);
  if (!result.ok) {
    return { ...idleState, status: "error", message: result.message };
  }
  revalidatePath("/my-events");
  revalidatePath(`/my-events/${eventId}/manage`);
  return { ...idleState, status: "success" };
}

export async function deleteEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const { page } = await requireEventPage();

  const result = await deleteEvent(eventId, page.id, page.slug);
  if (!result.ok) {
    return { ...idleState, status: "error", message: result.message };
  }
  revalidatePath("/my-events");
  redirect("/my-events");
}
