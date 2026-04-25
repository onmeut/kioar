import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { profileLinks, profiles } from "@/db/schema";
import { getProfileWithLinksByUserId } from "@/lib/data";
import { uploadPublicImage } from "@/lib/storage";
import {
  onboardingProfileSchema,
  profileDetailsFormSchema,
  profileLinksArraySchema,
} from "@/lib/validations";

type SaveResult =
  | { ok: true }
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
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات پروفایل ناقص یا نامعتبر است.",
    };
  }

  const db = getDb();
  const slugOwner = await db.query.profiles.findFirst({
    where: eq(profiles.slug, parsed.data.slug),
  });

  if (slugOwner && slugOwner.userId !== userId) {
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

  const nextValues = {
    slug: parsed.data.slug,
    fullName: parsed.data.fullName,
    title: parsed.data.title,
    bio: parsed.data.bio,
    avatarUrl,
    publicPhone: parsed.data.publicPhone || null,
    email: parsed.data.email || null,
    isComplete: true,
    updatedAt: new Date(),
  };

  if (existingProfile) {
    try {
      await db
        .update(profiles)
        .set(nextValues)
        .where(eq(profiles.userId, userId));
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
  } else {
    try {
      await db.insert(profiles).values({ userId, ...nextValues });
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
  }

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

export async function saveProfileLinksForUser(
  userId: string,
  links: z.infer<typeof profileLinksArraySchema>,
): Promise<SaveResult> {
  const db = getDb();
  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

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
        })),
      );
    }
  });

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
): Promise<SaveResult> {
  const parsed = onboardingProfileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    title: formData.get("title"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات ناقص یا نامعتبر است.",
    };
  }

  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

  const db = getDb();
  const slugOwner = await db.query.profiles.findFirst({
    where: eq(profiles.slug, parsed.data.slug),
  });

  if (slugOwner && slugOwner.userId !== userId) {
    return {
      ok: false,
      fieldErrors: { slug: ["این نام کاربری قبلاً گرفته شده است."] },
      message: "نام کاربری تکراری است.",
    };
  }

  const existingProfile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  });

  const nextValues = {
    slug: parsed.data.slug,
    fullName,
    title: parsed.data.title,
    isComplete: true,
    updatedAt: new Date(),
  };

  try {
    if (existingProfile) {
      await db
        .update(profiles)
        .set(nextValues)
        .where(eq(profiles.userId, userId));
    } else {
      await db.insert(profiles).values({ userId, ...nextValues });
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

  return { ok: true };
}
