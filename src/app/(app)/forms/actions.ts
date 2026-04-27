"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { idleState, type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import {
  createFormBlockForUser,
  deleteFormBlockForUser,
  deleteSubmission,
  setFormBlockActiveForUser,
  updateFormBlockForUser,
} from "@/lib/form-service";
import { formBlockSchema } from "@/lib/validations";

void idleState;

function parsePayload(formData: FormData) {
  const raw = String(formData.get("payload") || "");
  try {
    return formBlockSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message ?? "ورودی نامعتبر است.");
    }
    throw new Error("ورودی نامعتبر است.");
  }
}

export async function createFormBlockAction(
  _prev: ActionState & { id?: string },
  formData: FormData,
): Promise<ActionState & { id?: string }> {
  const viewer = await requireCompletedProfile();
  let payload;
  try {
    payload = parsePayload(formData);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "ورودی نامعتبر است.",
    };
  }
  const result = await createFormBlockForUser(viewer.user.id, payload);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/dashboard/links");
  revalidatePath("/dashboard/forms");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "فرم ساخته شد.", id: result.id };
}

export async function updateFormBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  if (!blockId) {
    return { status: "error", message: "شناسه فرم نامعتبر است." };
  }
  let payload;
  try {
    payload = parsePayload(formData);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "ورودی نامعتبر است.",
    };
  }
  const result = await updateFormBlockForUser(viewer.user.id, blockId, payload);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/dashboard/links");
  revalidatePath("/dashboard/forms");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "ذخیره شد." };
}

export async function deleteFormBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const result = await deleteFormBlockForUser(viewer.user.id, blockId);
  if (!result.ok) {
    return { status: "error", message: result.message ?? "حذف نشد." };
  }
  revalidatePath("/dashboard/links");
  revalidatePath("/dashboard/forms");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success" };
}

export async function toggleFormBlockActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const isActive = String(formData.get("isActive") || "false") === "true";
  const result = await setFormBlockActiveForUser(
    viewer.user.id,
    blockId,
    isActive,
  );
  if (!result.ok) {
    return { status: "error", message: result.message ?? "تغییر ناموفق بود." };
  }
  revalidatePath("/dashboard/links");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success" };
}

export async function deleteSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const submissionId = String(formData.get("submissionId") || "");
  const result = await deleteSubmission(viewer.user.id, submissionId);
  if (!result.ok) {
    return { status: "error", message: result.message ?? "حذف نشد." };
  }
  revalidatePath("/dashboard/forms");
  return { status: "success" };
}
