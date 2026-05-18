import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { profileLinks, profiles } from "@/db/schema";
import { generateAvatarSeed } from "@/lib/avatar-seed";
import {
  invalidateProfileCacheBySlug,
  invalidateProfileCacheOnSlugChange,
} from "@/lib/cache/profile-cache";
import { invalidateDiscoverCache } from "@/lib/cache/page-list-cache";
import { getProfileWithLinksByUserId } from "@/lib/data";
import {
  ensureFreeSubscriptionForPage,
  resolveCurrentPageForOwner,
} from "@/lib/pages";
import { deletePublicImage, uploadPublicImage } from "@/lib/storage";
import {
  onboardingProfileSchema,
  pageSettingsFormSchema,
  profileDetailsFormSchema,
  profileLinksArraySchema,
} from "@/lib/validations";

type SaveResult =
  | { ok: true; ogImageUrl?: string | null }
  | {
      ok: false;
      fieldErrors?: Record<string, string[] | undefined>;
      message?: string;
    };

export type OnboardingSaveResult =
  | {
      ok: true;
      pageId: string;
      /**
       * True iff onboarding INSERTed a brand-new page (the user had none
       * before). Phase 8's `/dashboard/pages/{id}/trial` redirect is gated
       * on this — we never auto-show the trial screen for an existing
       * page that just had its onboarding fields edited.
       */
      isFirstPage: boolean;
    }
  | {
      ok: false;
      fieldErrors?: Record<string, string[] | undefined>;
      message?: string;
    };

export async function saveProfileDetailsForUser(
  userId: string,
  formData: FormData,
): Promise<SaveResult> {
  const existingProfile = await getProfileWithLinksByUserId(userId);

  const parsed = profileDetailsFormSchema.safeParse({
    fullName: formData.get("fullName"),
    title: formData.get("title"),
    bio: formData.get("bio"),
    slug: formData.get("slug"),
    publicPhone: formData.get("publicPhone"),
    email: formData.get("email"),
    domain: formData.get("domain") ?? undefined,
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    indexEnabled: formData.get("indexEnabled") ?? undefined,
    appIconKey: formData.get("appIconKey"),
    appIconColor: formData.get("appIconColor"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات پروفایل ناقص یا نامعتبر است.",
    };
  }

  const db = getDb();
  // Slug uniqueness must be checked against *every other page on the
  // platform* — not just other users — because a single user can own
  // many pages now and each must have a globally unique slug.
  const slugOwner = await db.query.profiles.findFirst({
    where: eq(profiles.slug, parsed.data.slug),
  });

  if (
    slugOwner &&
    (slugOwner.userId !== userId || slugOwner.id !== existingProfile?.id)
  ) {
    return {
      ok: false,
      fieldErrors: {
        slug: ["این شناسه قبلاً استفاده شده است."],
      },
      message: "شناسه عمومی تکراری است.",
    };
  }

  let avatarUrl = existingProfile?.avatarUrl ?? null;
  const avatar = formData.get("avatar");

  if (avatar instanceof File && avatar.size > 0) {
    try {
      const uploaded = await uploadPublicImage(avatar, "avatars");
      avatarUrl = uploaded?.url ?? avatarUrl;
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "آپلود تصویر با خطا مواجه شد.",
      };
    }
  }

  let ogImageUrl = existingProfile?.ogImageUrl ?? null;
  const ogImageRemove = formData.get("ogImageRemove") === "1";
  if (ogImageRemove) {
    ogImageUrl = null;
  }
  const ogImage = formData.get("ogImage");
  if (ogImage instanceof File && ogImage.size > 0) {
    try {
      const uploaded = await uploadPublicImage(ogImage, "events");
      ogImageUrl = uploaded?.url ?? ogImageUrl;
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "آپلود تصویر سئو با خطا مواجه شد.",
      };
    }
  }

  const nextValues = {
    slug: parsed.data.slug,
    fullName: parsed.data.fullName,
    title: parsed.data.title,
    bio: parsed.data.bio,
    avatarUrl,
    publicPhone: parsed.data.publicPhone || null,
    email: parsed.data.email || null,
    domain: parsed.data.domain,
    seoTitle: parsed.data.seoTitle,
    seoDescription: parsed.data.seoDescription,
    ogImageUrl,
    indexEnabled: parsed.data.indexEnabled,
    appIconKey: parsed.data.appIconKey,
    appIconColor: parsed.data.appIconColor,
    isComplete: true,
    updatedAt: new Date(),
  };

  if (existingProfile) {
    try {
      // Target the specific page row by id — a user may own several pages,
      // and `userId` alone no longer uniquely identifies one.
      await db
        .update(profiles)
        .set(nextValues)
        .where(eq(profiles.id, existingProfile.id));
    } catch (error) {
      if (isUniqueSlugError(error)) {
        return {
          ok: false,
          fieldErrors: { slug: ["این شناسه قبلاً استفاده شده است."] },
          message: "شناسه عمومی تکراری است.",
        };
      }
      throw error;
    }
    // Slug may have changed — invalidate both old and new keys so neither
    // url serves stale data. `invalidateProfileCacheOnSlugChange` no-ops
    // the redundant DEL when old===new.
    await invalidateProfileCacheOnSlugChange(
      existingProfile.slug,
      parsed.data.slug,
    );
  } else {
    try {
      await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(profiles)
          .values({ userId, avatarSeed: generateAvatarSeed(), ...nextValues })
          .returning();
        await ensureFreeSubscriptionForPage(tx, created.id);
      });
    } catch (error) {
      if (isUniqueSlugError(error)) {
        return {
          ok: false,
          fieldErrors: { slug: ["این شناسه قبلاً استفاده شده است."] },
          message: "شناسه عمومی تکراری است.",
        };
      }
      throw error;
    }
    // New page — drop any stale 404 sentinel under the freshly-claimed slug.
    await invalidateProfileCacheBySlug(parsed.data.slug);
  }

  // Name/avatar/title change → stale discover cards. Bump the version so
  // cached grid pages are orphaned and rebuild on the next request.
  await invalidateDiscoverCache();

  return { ok: true };
}

// Map a Postgres unique-constraint violation back to a friendly slug error.
// We have to handle this (instead of trusting the pre-check SELECT) because
// two concurrent requests could both pass the SELECT and race to the INSERT,
// and without this catch one of them would 500.
function isUniqueSlugError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; constraint_name?: unknown };
  if (err.code !== "23505") return false;
  // profiles has a unique constraint on slug; we're conservative and only
  // treat a unique violation as a slug error when the constraint name hints
  // at slug, otherwise we rethrow so other races surface properly.
  const name = String(err.constraint_name ?? "").toLowerCase();
  return name === "" || name.includes("slug");
}

/**
 * Saves only the page-settings fields (slug, domain, SEO, icon, og image).
 * Does NOT re-validate fullName/title/bio so users with incomplete profiles
 * can still update their page settings.
 */
export async function savePageSettingsForUser(
  userId: string,
  formData: FormData,
): Promise<SaveResult> {
  const existingProfile = await resolveCurrentPageForOwner(userId);

  if (!existingProfile) {
    return { ok: false, message: "پروفایلی یافت نشد." };
  }

  const parsed = pageSettingsFormSchema.safeParse({
    fullName: formData.get("fullName"),
    title: formData.get("title"),
    bio: formData.get("bio"),
    slug: formData.get("slug"),
    domain: formData.get("domain") ?? undefined,
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    indexEnabled: formData.get("indexEnabled") ?? undefined,
    appIconKey: formData.get("appIconKey"),
    appIconColor: formData.get("appIconColor"),
    discoverEnabled: formData.get("discoverEnabled") ?? undefined,
    discoverCategory: formData.get("discoverCategory"),
    city: formData.get("city"),
    pageType: formData.get("pageType"),
    publicPhone: formData.get("publicPhone") ?? "",
    showPublicPhone: formData.get("showPublicPhone") ?? undefined,
    email: formData.get("email") ?? "",
    showPublicEmail: formData.get("showPublicEmail") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات تنظیمات صفحه نامعتبر است.",
    };
  }

  const db = getDb();

  // Slug uniqueness — check against every page except this one.
  const slugOwner = await db.query.profiles.findFirst({
    where: eq(profiles.slug, parsed.data.slug),
  });

  if (slugOwner && slugOwner.id !== existingProfile.id) {
    return {
      ok: false,
      fieldErrors: { slug: ["این شناسه قبلاً استفاده شده است."] },
      message: "شناسه عمومی تکراری است.",
    };
  }

  // Handle OG image upload / removal.
  let ogImageUrl = existingProfile.ogImageUrl ?? null;
  const ogImageRemove = formData.get("ogImageRemove") === "1";
  if (ogImageRemove) {
    // Delete old file from storage so it doesn't linger in the bucket.
    if (existingProfile.ogImageUrl) {
      try {
        await deletePublicImage(existingProfile.ogImageUrl);
      } catch {
        // Non-fatal: file may already be gone; continue to clear DB reference.
      }
    }
    ogImageUrl = null;
  }
  let uploadedOgUrl: string | undefined;
  const ogImage = formData.get("ogImage");
  if (ogImage instanceof File && ogImage.size > 0) {
    try {
      const uploaded = await uploadPublicImage(ogImage, "events");
      ogImageUrl = uploaded?.url ?? ogImageUrl;
      uploadedOgUrl = uploaded?.url ?? undefined;
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "آپلود تصویر سئو با خطا مواجه شد.",
      };
    }
  }

  try {
    await db
      .update(profiles)
      .set({
        fullName: parsed.data.fullName,
        title: parsed.data.title,
        bio: parsed.data.bio,
        slug: parsed.data.slug,
        domain: parsed.data.domain,
        seoTitle: parsed.data.seoTitle,
        seoDescription: parsed.data.seoDescription,
        indexEnabled: parsed.data.indexEnabled,
        appIconKey: parsed.data.appIconKey,
        appIconColor: parsed.data.appIconColor,
        discoverEnabled: parsed.data.discoverEnabled,
        discoverCategory: parsed.data.discoverCategory,
        city: parsed.data.city,
        pageType: parsed.data.pageType,
        publicPhone: parsed.data.publicPhone || null,
        showPublicPhone: parsed.data.showPublicPhone,
        email: parsed.data.email || null,
        showPublicEmail: parsed.data.showPublicEmail,
        ogImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, existingProfile.id));
  } catch (error) {
    if (isUniqueSlugError(error)) {
      return {
        ok: false,
        fieldErrors: { slug: ["این شناسه قبلاً استفاده شده است."] },
        message: "شناسه عمومی تکراری است.",
      };
    }
    throw error;
  }

  await invalidateProfileCacheOnSlugChange(
    existingProfile.slug,
    parsed.data.slug,
  );

  // discoverEnabled / discoverCategory / pageType changes directly affect
  // which profiles appear in the discover directory.
  await invalidateDiscoverCache();

  return {
    ok: true,
    ogImageUrl: uploadedOgUrl ?? (ogImageRemove ? null : undefined),
  };
}

export async function saveProfileLinksForUser(
  userId: string,
  links: z.infer<typeof profileLinksArraySchema>,
): Promise<SaveResult> {
  const db = getDb();
  // Operate on the *current* page — not just "the user's only page". When a
  // user owns multiple pages, the cookie picks which one we're editing.
  const existingProfile = await resolveCurrentPageForOwner(userId);

  if (!existingProfile) {
    return {
      ok: false,
      message: "ابتدا اطلاعات پروفایل را تکمیل کنید.",
    };
  }

  const parsed = profileLinksArraySchema.safeParse(links);

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: {
        links: [parsed.error.issues[0]?.message ?? "لیست لینک‌ها معتبر نیست."],
      },
      message: "لینک‌ها را دوباره بررسی کنید.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(profileLinks)
      .where(eq(profileLinks.profileId, existingProfile.id));

    if (parsed.data.length) {
      await tx.insert(profileLinks).values(
        parsed.data.map((link, index) => ({
          profileId: existingProfile.id,
          label: link.label,
          url: link.url,
          description: link.description ?? null,
          imageUrl: link.imageUrl ?? null,
          iconKey: link.iconKey ?? null,
          iconUrl: link.iconUrl ?? null,
          sortOrder: index,
          isActive: link.isActive ?? true,
          spotlight: link.spotlight ?? "none",
          animationStyle: link.animationStyle ?? null,
        })),
      );
    }
  });

  await invalidateProfileCacheBySlug(existingProfile.slug);
  return { ok: true };
}

export async function saveProfileForUser(
  userId: string,
  formData: FormData,
): Promise<SaveResult> {
  const details = await saveProfileDetailsForUser(userId, formData);
  if (!details.ok) return details;

  const rawLinks = formData.get("links");
  if (rawLinks == null) {
    return { ok: true };
  }

  let parsedLinks: z.infer<typeof profileLinksArraySchema>;
  try {
    parsedLinks = profileLinksArraySchema.parse(
      JSON.parse(String(rawLinks || "[]")),
    );
  } catch {
    return {
      ok: false,
      fieldErrors: {
        links: ["لیست لینک‌ها معتبر نیست."],
      },
      message: "لینک‌ها را دوباره بررسی کنید.",
    };
  }

  return saveProfileLinksForUser(userId, parsedLinks);
}

/**
 * Minimal first-run save: claims a slug and stores first/last name + title.
 * Everything else (avatar, bio, contact, links) is intentionally left for the
 * dashboard — onboarding stays a single short screen.
 */
export async function saveOnboardingProfileForUser(
  userId: string,
  formData: FormData,
): Promise<OnboardingSaveResult> {
  const parsed = onboardingProfileSchema.safeParse({
    pageName: formData.get("pageName"),
    slug: formData.get("slug"),
    pageType: formData.get("pageType"),
    discoverCategory: formData.get("discoverCategory"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات ناقص یا نامعتبر است.",
    };
  }

  const fullName = parsed.data.pageName;

  const db = getDb();
  // Slug uniqueness across every page on the platform.
  const slugOwner = await db.query.profiles.findFirst({
    where: eq(profiles.slug, parsed.data.slug),
  });
  // Allow if the slug is free, or if it already belongs to one of the
  // user's *own* pages (we'll target that exact page below).
  const existingProfile = await resolveCurrentPageForOwner(userId);
  if (
    slugOwner &&
    (slugOwner.userId !== userId || slugOwner.id !== existingProfile?.id)
  ) {
    return {
      ok: false,
      fieldErrors: { slug: ["این نام کاربری قبلاً گرفته شده است."] },
      message: "نام کاربری تکراری است.",
    };
  }

  const nextValues = {
    slug: parsed.data.slug,
    fullName,
    pageType: parsed.data.pageType,
    discoverCategory: parsed.data.discoverCategory,
    isComplete: true,
    updatedAt: new Date(),
  };

  let pageId: string;
  let isFirstPage = false;
  try {
    if (existingProfile) {
      // Update by page id — the user might own several pages.
      await db
        .update(profiles)
        .set(nextValues)
        .where(eq(profiles.id, existingProfile.id));
      pageId = existingProfile.id;
    } else {
      pageId = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(profiles)
          .values({ userId, avatarSeed: generateAvatarSeed(), ...nextValues })
          .returning();
        await ensureFreeSubscriptionForPage(tx, created.id);
        return created.id;
      });
      isFirstPage = true;
    }
  } catch (error) {
    if (isUniqueSlugError(error)) {
      return {
        ok: false,
        fieldErrors: { slug: ["این نام کاربری قبلاً گرفته شده است."] },
        message: "نام کاربری تکراری است.",
      };
    }
    throw error;
  }

  // Old slug (only meaningful when an existing page renamed) + new slug.
  if (existingProfile) {
    await invalidateProfileCacheOnSlugChange(
      existingProfile.slug,
      parsed.data.slug,
    );
  } else {
    await invalidateProfileCacheBySlug(parsed.data.slug);
  }

  // New page joins discover by default (discover_enabled=true column default);
  // bump the version so the directory reflects the new entry immediately.
  await invalidateDiscoverCache();

  return { ok: true, pageId, isFirstPage };
}
