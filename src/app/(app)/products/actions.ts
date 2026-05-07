"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { idleState, type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { blockKindToFeatureKey } from "@/lib/block-features";
import { getPageEntitlementLimit, pageHasFeature } from "@/lib/entitlements";
import {
  createProductBlockForUser,
  deleteProductBlockForUser,
  setProductBlockActiveForUser,
  updateProductBlockForUser,
} from "@/lib/product-service";
import { uploadPublicImage } from "@/lib/storage";
import { productBlockInputSchema } from "@/lib/validations";

void idleState;

function parsePayload(formData: FormData) {
  const raw = String(formData.get("payload") || "");
  try {
    return productBlockInputSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message ?? "ورودی نامعتبر است.");
    }
    throw new Error("ورودی نامعتبر است.");
  }
}

/**
 * Server-side resolution of the per-block items cap. The limit lives on
 * the page's effective entitlement; we read it once per action call.
 *
 * Returns `null` for "no cap configured" — the service layer falls back
 * to the absolute hard cap (300) in that case.
 */
async function resolveItemsLimit(pageId: string): Promise<number | null> {
  const limit = await getPageEntitlementLimit(
    pageId,
    "products_max_items_per_block",
  );
  if (limit === null) return null;
  // bigint → number is safe here (limits are small).
  return Number(limit);
}

async function ensureGranted(pageId: string) {
  const featureKey = blockKindToFeatureKey("product");
  if (featureKey === null) return true;
  return pageHasFeature(pageId, featureKey);
}

export async function createProductBlockAction(
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
  const limit = await resolveItemsLimit(viewer.profile.id);
  const result = await createProductBlockForUser(
    viewer.user.id,
    payload,
    limit,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "بلوک ساخته شد.", id: result.id };
}

export async function updateProductBlockAction(
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
  const limit = await resolveItemsLimit(viewer.profile.id);
  const result = await updateProductBlockForUser(
    viewer.user.id,
    blockId,
    payload,
    limit,
  );
  if (!result.ok) {
    return { status: "error", message: result.message };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "ذخیره شد." };
}

export async function deleteProductBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const result = await deleteProductBlockForUser(viewer.user.id, blockId);
  if (!result.ok) {
    return { status: "error", message: result.message ?? "حذف نشد." };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success" };
}

export async function toggleProductBlockActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const isActive = String(formData.get("isActive") || "false") === "true";
  const result = await setProductBlockActiveForUser(
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
 * Upload an image attached to a single product item. Returns the public
 * URL the editor can drop into the item's `imageUrl` before save.
 *
 * The actual association with the item happens on save (the URL is
 * embedded in the payload), keeping this action stateless and reusable
 * across both new and existing items.
 */
export async function uploadProductItemImageAction(
  _prev: ActionState & { url?: string | null },
  formData: FormData,
): Promise<ActionState & { url?: string | null }> {
  await requireCompletedProfile();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "فایل تصویر ارسال نشد.", url: null };
  }
  try {
    const uploaded = await uploadPublicImage(file, "products");
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
