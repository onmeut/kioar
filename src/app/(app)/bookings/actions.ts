"use server";

import { revalidatePath } from "next/cache";

import { type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { cancelBookingForUser } from "@/lib/booking-data";
import {
  createBookingBlockForUser,
  deleteBookingBlockForUser,
  toggleBookingBlockActiveForUser,
  updateBookingBlockForUser,
} from "@/lib/booking-service";

/**
 * Create a new booking block.
 * The wizard serializes its whole state as a JSON string on the `payload`
 * FormData field so we keep a single action signature that plugs into
 * `useActionState`.
 */
export async function createBookingBlockAction(
  _prev: ActionState & { id?: string },
  formData: FormData,
): Promise<ActionState & { id?: string }> {
  const viewer = await requireCompletedProfile();
  const raw = String(formData.get("payload") || "");
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return { status: "error", message: "داده‌ی فرم معتبر نیست." };
  }

  const result = await createBookingBlockForUser(viewer.user.id, input);
  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return {
    status: "success",
    message: "بلوک رزرو ساخته شد.",
    id: result.data?.id,
  };
}

export async function updateBookingBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const raw = String(formData.get("payload") || "");
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return { status: "error", message: "داده‌ی فرم معتبر نیست." };
  }

  const result = await updateBookingBlockForUser(
    viewer.user.id,
    blockId,
    input,
  );
  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "ذخیره شد" };
}

export async function deleteBookingBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  if (!blockId) return { status: "error", message: "شناسه بلوک معتبر نیست." };

  const result = await deleteBookingBlockForUser(viewer.user.id, blockId);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "حذف شد" };
}

export async function toggleBookingBlockActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const isActive = formData.get("isActive") === "true";
  if (!blockId) return { status: "error", message: "شناسه بلوک معتبر نیست." };

  const result = await toggleBookingBlockActiveForUser(
    viewer.user.id,
    blockId,
    isActive,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: isActive ? "فعال شد" : "غیرفعال شد" };
}

/**
 * Cancel a single booking. Allowed for either the host (owner of the
 * block) or the guest (matched by email). Used from the dashboard
 * bookings list.
 */
export async function cancelBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const bookingId = String(formData.get("bookingId") || "");
  if (!bookingId) {
    return { status: "error", message: "شناسه رزرو معتبر نیست." };
  }

  const result = await cancelBookingForUser({
    bookingId,
    userId: viewer.user.id,
    userEmail: viewer.profile.email ?? null,
  });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/bookings");
  return { status: "success", message: "رزرو لغو شد." };
}
