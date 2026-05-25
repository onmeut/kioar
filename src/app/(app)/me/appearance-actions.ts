"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { pageAppearanceSchema } from "@/lib/appearance/schema";
import type { PageAppearance } from "@/lib/appearance/types";
import { type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import { uploadPublicImage } from "@/lib/storage";

/**
 * Persist the user's page appearance (theme + wallpaper). Validated
 * server-side with Zod v4 before write; ownership is enforced via
 * `requireCompletedProfile()` + matching `viewer.profile.id` on the row
 * we update.
 *
 * After the write commits we invalidate the public-page Redis cache so
 * the next visitor sees the new look immediately (otherwise the 5-min
 * TTL would serve stale appearance for up to 300 s).
 */
export async function updatePageAppearanceAction(
  appearance: PageAppearance,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();

  const parsed = pageAppearanceSchema.safeParse(appearance);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return {
      status: "error",
      message: firstIssue ?? "تنظیمات ظاهر صفحه معتبر نیست.",
    };
  }

  const db = getDb();
  await db
    .update(profiles)
    .set({ appearance: parsed.data, updatedAt: new Date() })
    .where(eq(profiles.id, viewer.profile.id));

  // Drop the cached payload so /[slug] re-renders with the new look.
  await invalidateProfileCacheBySlug(viewer.profile.slug);

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return { status: "success", message: "ظاهر صفحه ذخیره شد." };
}

/**
 * Upload a wallpaper image. Reuses the shared `uploadPublicImage` so we
 * get the same sharp-based re-encoding, SSRF safety, and storage backend
 * (S3 or local public/) as avatars and link covers.
 *
 * Returns the uploaded URL so the client can set `wallpaper.imageUrl`
 * before calling `updatePageAppearanceAction`. The link list / image
 * persistence pattern in this app keeps the upload + the "use it"
 * actions separate, so we do the same here.
 */
export async function uploadWallpaperImageAction(
  _prev: ActionState & { url?: string | null },
  formData: FormData,
): Promise<ActionState & { url?: string | null }> {
  await requireCompletedProfile();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "فایل تصویر ارسال نشد.", url: null };
  }

  try {
    // "link-covers" folder is the closest match — large background-ish
    // images. We don't need a new bucket prefix for this single use.
    const uploaded = await uploadPublicImage(file, "link-covers");
    if (!uploaded?.url) throw new Error("آپلود ناموفق بود.");
    return {
      status: "success",
      message: "تصویر آپلود شد.",
      url: uploaded.url,
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
 * Plain-form variant of {@link uploadWallpaperImageAction}. Lets a client
 * component take a single `(FormData) => Promise<…>` prop without having
 * to thread an unused `_prev` argument through every call site.
 */
export async function uploadWallpaperFromFormDataAction(
  formData: FormData,
): Promise<{ status: string; message?: string; url?: string | null }> {
  const res = await uploadWallpaperImageAction({ status: "idle" }, formData);
  return { status: res.status, message: res.message, url: res.url ?? null };
}
