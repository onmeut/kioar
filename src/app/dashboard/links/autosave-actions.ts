"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import {
  saveProfileDetailsForUser,
  saveProfileLinksForUser,
} from "@/lib/profile-service";
import { uploadPublicImage } from "@/lib/storage";
import { profileLinksArraySchema } from "@/lib/validations";
import type { z } from "zod";

export async function autosaveProfileDetailsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const result = await saveProfileDetailsForUser(viewer.user.id, formData);

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      message: result.message ?? "ذخیره خودکار با خطا مواجه شد.",
    };
  }

  revalidatePath("/dashboard/links");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "ذخیره شد",
  };
}

export async function autosaveAvatarAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const avatar = formData.get("avatar");

  if (!(avatar instanceof File) || avatar.size === 0) {
    return {
      status: "error",
      message: "فایل تصویر ارسال نشد.",
    };
  }

  let avatarUrl: string;
  try {
    const uploaded = await uploadPublicImage(avatar, "avatars");
    if (!uploaded?.url) throw new Error("آپلود ناموفق بود.");
    avatarUrl = uploaded.url;
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "آپلود تصویر با خطا مواجه شد.",
    };
  }

  const db = getDb();
  await db
    .update(profiles)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(profiles.userId, viewer.user.id));

  revalidatePath("/dashboard/links");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "تصویر ذخیره شد",
  };
}

export async function autosaveLinksAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();

  let parsedLinks: z.infer<typeof profileLinksArraySchema>;
  try {
    parsedLinks = profileLinksArraySchema.parse(
      JSON.parse(String(formData.get("links") || "[]")),
    );
  } catch {
    return {
      status: "error",
      fieldErrors: { links: ["لیست لینک‌ها معتبر نیست."] },
      message: "لینک‌ها را دوباره بررسی کنید.",
    };
  }

  const result = await saveProfileLinksForUser(viewer.user.id, parsedLinks);

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      message: result.message,
    };
  }

  revalidatePath("/dashboard/links");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "ذخیره شد",
  };
}

/**
 * Per-link image uploader. Client posts a single file under the `file` key
 * and a `folder` discriminator ("link-covers" | "link-icons"). Returns the
 * uploaded URL so the client can set it on the edited link. The link list
 * itself is saved via `autosaveLinksAction`.
 */
export async function autosaveLinkImageAction(
  _prevState: ActionState & { url?: string | null; folder?: string },
  formData: FormData,
): Promise<ActionState & { url?: string | null; folder?: string }> {
  await requireCompletedProfile();

  const file = formData.get("file");
  const folderRaw = String(formData.get("folder") || "link-covers");
  const folder: "link-covers" | "link-icons" =
    folderRaw === "link-icons" ? "link-icons" : "link-covers";

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "فایل تصویر ارسال نشد.",
      folder,
      url: null,
    };
  }

  try {
    const uploaded = await uploadPublicImage(file, folder);
    if (!uploaded?.url) throw new Error("آپلود ناموفق بود.");
    return {
      status: "success",
      message: "تصویر آپلود شد",
      folder,
      url: uploaded.url,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "آپلود تصویر با خطا مواجه شد.",
      folder,
      url: null,
    };
  }
}
