"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import {
  savePageSettingsForUser,
  saveProfileDetailsForUser,
  saveProfileLinksForUser,
} from "@/lib/profile-service";
import { DEFAULT_QR_STYLE, type QrStyle } from "@/lib/qr/types";
import { deletePublicImage, uploadPublicImage } from "@/lib/storage";
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

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "ذخیره شد",
  };
}

export async function savePageSettingsAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const result = await savePageSettingsForUser(viewer.user.id, formData);

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      message: result.message ?? "ذخیره تنظیمات صفحه با خطا مواجه شد.",
    };
  }

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "ذخیره شد",
    ...(result.ogImageUrl !== undefined
      ? { values: { ogImageUrl: result.ogImageUrl ?? "" } }
      : {}),
  } satisfies ActionState;
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
  // A user owns many pages now — only update the *current* page's avatar,
  // never every row that shares the user_id.
  await db
    .update(profiles)
    .set({ avatarUrl, updatedAt: new Date() })
    .where(eq(profiles.id, viewer.profile.id));

  await invalidateProfileCacheBySlug(viewer.profile.slug);

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "تصویر ذخیره شد",
    values: { avatarUrl },
  };
}

/**
 * Persist a user-chosen avatar seed (DiceBear bottts-neutral). Picking
 * a seed implicitly clears any uploaded `avatarUrl` because the renderer
 * picks the upload first; leaving it would mean the seed change is
 * invisible. The previously-uploaded file is also removed from storage.
 */
export async function saveAvatarSeedAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const raw = String(formData.get("seed") ?? "").trim();

  // Validate: lowercase hex, 8–64 chars. Matches `generateAvatarSeed()`
  // (8 random bytes hex = 16 chars) and any client-generated seed of
  // similar shape. Rejecting arbitrary strings prevents stored XSS via
  // SVG attributes downstream and keeps the column tidy.
  if (!/^[a-f0-9]{8,64}$/.test(raw)) {
    return { status: "error", message: "شناسه آواتار نامعتبر است." };
  }

  const oldUrl = viewer.profile.avatarUrl;

  const db = getDb();
  await db
    .update(profiles)
    .set({ avatarSeed: raw, avatarUrl: null, updatedAt: new Date() })
    .where(eq(profiles.id, viewer.profile.id));

  if (oldUrl) {
    await deletePublicImage(oldUrl);
  }

  await invalidateProfileCacheBySlug(viewer.profile.slug);

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "آواتار ذخیره شد",
    values: { avatarSeed: raw, avatarUrl: "" },
  };
}

export async function deleteAvatarAction(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();

  const oldUrl = viewer.profile.avatarUrl;

  const db = getDb();
  await db
    .update(profiles)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(profiles.id, viewer.profile.id));

  // Delete from storage after the DB row is already cleared so a storage
  // failure never leaves the user stuck with a broken reference.
  if (oldUrl) {
    await deletePublicImage(oldUrl);
  }

  await invalidateProfileCacheBySlug(viewer.profile.slug);

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "تصویر حذف شد",
  };
}

export async function autosaveLinksAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();

  let parsedLinks: z.infer<typeof profileLinksArraySchema>;
  try {
    const safe = profileLinksArraySchema.safeParse(
      JSON.parse(String(formData.get("links") || "[]")),
    );
    if (!safe.success) {
      // Surface the *actual* zod issue (e.g. "نشانی لینک معتبر نیست." or
      // "حداکثر ۸ لینک قابل ثبت است.") so the toast tells the user what
      // to fix instead of the unhelpful "لینک‌ها را دوباره بررسی کنید."
      const firstIssue = safe.error.issues[0]?.message;
      return {
        status: "error",
        fieldErrors: { links: [firstIssue ?? "لیست لینک‌ها معتبر نیست."] },
        message: firstIssue ?? "لینک‌ها را دوباره بررسی کنید.",
      };
    }
    parsedLinks = safe.data;
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

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "ذخیره شد",
    // Hand the real DB uuids back (in saved order) so the client can replace
    // any temporary placeholder ids it minted before save — otherwise a later
    // reorder would ship non-uuid ids and crash the query. `values` is
    // string→string, so the id array is JSON-encoded.
    values: { linkIds: JSON.stringify(result.linkIds) },
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

/**
 * Reorder all blocks (links + booking blocks + form blocks) for the
 * authenticated profile in a single global ordering. Persists by
 * assigning sequential `sort_order` values across all three tables.
 */
export async function reorderBlocksAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const raw = String(formData.get("items") || "");
  let items: Array<{ kind: string; id: string }> = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      items = parsed
        .filter(
          (it): it is { kind: string; id: string } =>
            !!it &&
            typeof it === "object" &&
            typeof (it as { kind?: unknown }).kind === "string" &&
            typeof (it as { id?: unknown }).id === "string",
        )
        .map((it) => ({ kind: it.kind, id: it.id }));
    }
  } catch {
    return { status: "error", message: "ترتیب جدید معتبر نیست." };
  }

  const filtered = items.filter(
    (
      it,
    ): it is {
      kind: "link" | "booking" | "form" | "product" | "text";
      id: string;
    } =>
      it.kind === "link" ||
      it.kind === "booking" ||
      it.kind === "form" ||
      it.kind === "product" ||
      it.kind === "text",
  );

  const { reorderBlocksForUser } = await import("@/lib/block-reorder-service");
  const result = await reorderBlocksForUser(viewer.user.id, filtered);
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success", message: "ذخیره شد" };
}

/**
 * Persist the user's custom QR style to the `profiles.qr_style` column
 * so it becomes the single source of truth — shared between the share
 * modal preview, digital card, and the desktop scan-on-mobile QR widget
 * on the public page.
 *
 * Only whitelisted fields are stored; arbitrary jsonb blobs are rejected.
 */
export async function saveQrStyleAction(style: QrStyle): Promise<ActionState> {
  const viewer = await requireCompletedProfile();

  // Validate by merging with defaults — unknown fields are dropped, missing
  // fields fall back to the safe default values.
  const safe: QrStyle = {
    dotStyle:
      style.dotStyle === "square" ||
      style.dotStyle === "dots" ||
      style.dotStyle === "rounded"
        ? style.dotStyle
        : DEFAULT_QR_STYLE.dotStyle,
    markerCenter:
      style.markerCenter === "square" || style.markerCenter === "dot"
        ? style.markerCenter
        : DEFAULT_QR_STYLE.markerCenter,
    markerBorder:
      style.markerBorder === "square" ||
      style.markerBorder === "rounded" ||
      style.markerBorder === "circle"
        ? style.markerBorder
        : DEFAULT_QR_STYLE.markerBorder,
    dotColor: /^#[0-9a-fA-F]{6}$/.test(style.dotColor ?? "")
      ? style.dotColor
      : DEFAULT_QR_STYLE.dotColor,
    markerColor: /^#[0-9a-fA-F]{6}$/.test(style.markerColor ?? "")
      ? style.markerColor
      : DEFAULT_QR_STYLE.markerColor,
    showLogo:
      typeof style.showLogo === "boolean"
        ? style.showLogo
        : DEFAULT_QR_STYLE.showLogo,
  };

  const db = getDb();
  await db
    .update(profiles)
    .set({ qrStyle: safe, updatedAt: new Date() })
    .where(eq(profiles.id, viewer.profile.id));

  await invalidateProfileCacheBySlug(viewer.profile.slug);

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);

  return { status: "success", message: "شخصی‌سازی کیو‌آر‌کد ذخیره شد." };
}
