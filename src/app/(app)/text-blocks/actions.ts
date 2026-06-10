"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { idleState, type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { blockKindToFeatureKey } from "@/lib/block-features";
import { pageHasFeature } from "@/lib/entitlements";
import { uploadPublicImage } from "@/lib/storage";
import {
  createTextBlockForUser,
  deleteTextBlockForUser,
  toggleTextBlockActiveForUser,
  updateTextBlockForUser,
} from "@/lib/text-block-service";
import { textBlockInputSchema } from "@/lib/validations";

void idleState;

function parsePayload(formData: FormData) {
  const raw = String(formData.get("payload") || "");
  try {
    return textBlockInputSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message ?? "ورودی نامعتبر است.");
    }
    throw new Error("ورودی نامعتبر است.");
  }
}

async function ensureGranted(pageId: string) {
  const featureKey = blockKindToFeatureKey("text");
  if (featureKey === null) return true;
  return pageHasFeature(pageId, featureKey);
}

export async function createTextBlockAction(
  _prev: ActionState & { id?: string },
  formData: FormData,
): Promise<ActionState & { id?: string }> {
  const viewer = await requireCompletedProfile();
  if (!(await ensureGranted(viewer.profile.id))) {
    return { status: "error", message: "این قابلیت در پلن فعلی فعال نیست." };
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
  const result = await createTextBlockForUser(viewer.user.id, payload);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "بلوک متن ساخته شد.", id: result.data?.id };
}

export async function updateTextBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  if (!(await ensureGranted(viewer.profile.id))) {
    return { status: "error", message: "این قابلیت در پلن فعلی فعال نیست." };
  }
  const blockId = String(formData.get("blockId") || "");
  if (!blockId) {
    return { status: "error", message: "شناسه بلوک نامعتبر است." };
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
  const result = await updateTextBlockForUser(viewer.user.id, blockId, payload);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "ذخیره شد." };
}

export async function deleteTextBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const result = await deleteTextBlockForUser(viewer.user.id, blockId);
  if (!result.ok) {
    return { status: "error", message: result.message ?? "حذف نشد." };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success" };
}

export async function toggleTextBlockActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const isActive = String(formData.get("isActive") || "false") === "true";
  const result = await toggleTextBlockActiveForUser(
    viewer.user.id,
    blockId,
    isActive,
  );
  if (!result.ok) {
    return { status: "error", message: result.message ?? "تغییر ناموفق بود." };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success" };
}

/**
 * Upload the optional photo for a text block. Returns the public URL the
 * editor drops into the block's `photoUrl` before save — stateless and
 * reusable across new and existing blocks. Reuses the `link-covers` folder
 * since a text-block photo is a block-level cover image.
 */
export async function uploadTextBlockImageAction(
  _prev: ActionState & { url?: string | null },
  formData: FormData,
): Promise<ActionState & { url?: string | null }> {
  await requireCompletedProfile();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "فایل تصویر ارسال نشد.", url: null };
  }
  try {
    const uploaded = await uploadPublicImage(file, "link-covers");
    if (!uploaded?.url) throw new Error("آپلود ناموفق بود.");
    return { status: "success", message: "تصویر آپلود شد", url: uploaded.url };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "آپلود تصویر با خطا مواجه شد.",
      url: null,
    };
  }
}
