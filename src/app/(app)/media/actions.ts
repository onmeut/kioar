"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { idleState, type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { blockKindToFeatureKey } from "@/lib/block-features";
import { getPageEntitlementLimit, pageHasFeature } from "@/lib/entitlements";
import {
  createMediaBlockForUser,
  deleteMediaBlockForUser,
  toggleMediaBlockActiveForUser,
  updateMediaBlockForUser,
  type MediaLimits,
} from "@/lib/media-block-service";
import {
  uploadPublicFile,
  uploadPublicImage,
  type MediaFileKind,
} from "@/lib/storage";
import { mediaBlockInputSchema } from "@/lib/validations";

void idleState;

function parsePayload(formData: FormData) {
  const raw = String(formData.get("payload") || "");
  try {
    return mediaBlockInputSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message ?? "ورودی نامعتبر است.");
    }
    throw new Error("ورودی نامعتبر است.");
  }
}

async function ensureGranted(pageId: string) {
  const featureKey = blockKindToFeatureKey("media");
  if (featureKey === null) return true;
  return pageHasFeature(pageId, featureKey);
}

/** Read the page's media limits from the registry (bigint → number; small). */
async function resolveMediaLimits(pageId: string): Promise<MediaLimits> {
  const num = (v: bigint | null) => (v === null ? null : Number(v));
  const [storageMb, maxPhotoMb, maxVideoMb, maxFileMb, maxGalleryCount] =
    await Promise.all([
      getPageEntitlementLimit(pageId, "media_storage_mb"),
      getPageEntitlementLimit(pageId, "media_max_photo_mb"),
      getPageEntitlementLimit(pageId, "media_max_video_mb"),
      getPageEntitlementLimit(pageId, "media_max_file_mb"),
      getPageEntitlementLimit(pageId, "media_max_gallery_count"),
    ]);
  return {
    storageMb: num(storageMb),
    maxPhotoMb: num(maxPhotoMb),
    maxVideoMb: num(maxVideoMb),
    maxFileMb: num(maxFileMb),
    maxGalleryCount: num(maxGalleryCount),
  };
}

export async function createMediaBlockAction(
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
  const limits = await resolveMediaLimits(viewer.profile.id);
  const result = await createMediaBlockForUser(
    viewer.user.id,
    payload,
    limits,
  );
  if (!result.ok) {
    return { status: "error", message: result.message ?? "ذخیره نشد." };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "بلوک مدیا ساخته شد.", id: result.data?.id };
}

export async function updateMediaBlockAction(
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
  const limits = await resolveMediaLimits(viewer.profile.id);
  const result = await updateMediaBlockForUser(
    viewer.user.id,
    blockId,
    payload,
    limits,
  );
  if (!result.ok) {
    return { status: "error", message: result.message ?? "ذخیره نشد." };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "ذخیره شد." };
}

export async function deleteMediaBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const result = await deleteMediaBlockForUser(viewer.user.id, blockId);
  if (!result.ok) {
    return { status: "error", message: result.message ?? "حذف نشد." };
  }
  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success" };
}

export async function toggleMediaBlockActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const blockId = String(formData.get("blockId") || "");
  const isActive = String(formData.get("isActive") || "false") === "true";
  const result = await toggleMediaBlockActiveForUser(
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
 * Upload a photo (or a video cover) for a media block. Routes through the
 * image pipeline (sharp re-encode → WebP, EXIF stripped). Returns the public
 * URL + stored byte size so the editor can track quota and send `byteSize`
 * in the block payload. The size validation against the plan happens at
 * save time in the service; this returns the actual stored bytes.
 */
export async function uploadMediaImageAction(
  _prev: ActionState & { url?: string | null; byteSize?: number },
  formData: FormData,
): Promise<ActionState & { url?: string | null; byteSize?: number }> {
  const viewer = await requireCompletedProfile();
  if (!(await ensureGranted(viewer.profile.id))) {
    return { status: "error", message: "این قابلیت فعال نیست.", url: null };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "فایل تصویر ارسال نشد.", url: null };
  }
  // Per-photo cap (read before processing so we reject oversize early with a
  // specific message, not a generic one).
  const maxPhotoMb = await getPageEntitlementLimit(
    viewer.profile.id,
    "media_max_photo_mb",
  );
  if (maxPhotoMb !== null && file.size > Number(maxPhotoMb) * 1_000_000) {
    return {
      status: "error",
      message: `حجم هر عکس باید کمتر از ${Number(maxPhotoMb)} مگابایت باشد.`,
      url: null,
    };
  }
  try {
    const uploaded = await uploadPublicImage(file, "media");
    if (!uploaded?.url) throw new Error("آپلود ناموفق بود.");
    // The image is re-encoded to WebP; report the actual stored size if we
    // can, else fall back to the input size. uploadPublicImage doesn't return
    // bytes, so approximate with the input file size for quota accounting.
    return {
      status: "success",
      message: "تصویر آپلود شد.",
      url: uploaded.url,
      byteSize: file.size,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "آپلود تصویر با خطا مواجه شد.",
      url: null,
    };
  }
}

/**
 * Upload a non-image media file (video or PDF). Validates extension + magic
 * bytes in storage; enforces the per-file plan cap here with a specific
 * Persian message. Returns the public URL + byte size for quota accounting.
 */
export async function uploadMediaFileAction(
  _prev: ActionState & { url?: string | null; byteSize?: number },
  formData: FormData,
): Promise<ActionState & { url?: string | null; byteSize?: number }> {
  const viewer = await requireCompletedProfile();
  if (!(await ensureGranted(viewer.profile.id))) {
    return { status: "error", message: "این قابلیت فعال نیست.", url: null };
  }
  const file = formData.get("file");
  const kind = String(formData.get("kind") || "") as MediaFileKind;
  if (kind !== "video" && kind !== "file") {
    return { status: "error", message: "نوع فایل نامعتبر است.", url: null };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "فایلی ارسال نشد.", url: null };
  }

  const limitKey =
    kind === "video" ? "media_max_video_mb" : "media_max_file_mb";
  const cap = await getPageEntitlementLimit(viewer.profile.id, limitKey);
  if (cap !== null && file.size > Number(cap) * 1_000_000) {
    return {
      status: "error",
      message:
        kind === "video"
          ? `حجم ویدئو باید کمتر از ${Number(cap)} مگابایت باشد.`
          : `حجم فایل باید کمتر از ${Number(cap)} مگابایت باشد.`,
      url: null,
    };
  }

  try {
    const uploaded = await uploadPublicFile(file, kind);
    if (!uploaded?.url) throw new Error("آپلود ناموفق بود.");
    return {
      status: "success",
      message: "فایل آپلود شد.",
      url: uploaded.url,
      byteSize: uploaded.byteSize,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "آپلود فایل با خطا مواجه شد.",
      url: null,
    };
  }
}
