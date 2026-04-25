import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { events } from "@/db/schema";
import { uploadPublicImage } from "@/lib/storage";
import { eventFormSchema } from "@/lib/validations";

function firstFieldMessage(fieldErrors: Record<string, string[] | undefined>) {
  for (const key of Object.keys(fieldErrors)) {
    const list = fieldErrors[key];
    if (list && list.length > 0) return list[0];
  }
  return null;
}

export async function saveEvent(
  formData: FormData,
  createdByUserId: string,
  eventId?: string,
) {
  const db = getDb();
  const existingEvent = eventId
    ? await db.query.events.findFirst({
        where: eq(events.id, eventId),
      })
    : null;

  const rawValues = {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    location: String(formData.get("location") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    status: String(formData.get("status") ?? "draft"),
  };

  const parsed = eventFormSchema.safeParse(rawValues);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = firstFieldMessage(fieldErrors);
    return {
      ok: false as const,
      fieldErrors,
      values: rawValues,
      message: firstError ?? "لطفاً خطاهای فرم را اصلاح کنید.",
    };
  }

  const slugOwner = await db.query.events.findFirst({
    where: eq(events.slug, parsed.data.slug),
  });

  if (slugOwner && slugOwner.id !== existingEvent?.id) {
    return {
      ok: false as const,
      fieldErrors: {
        slug: ["این اسلاگ قبلاً استفاده شده است. یکی دیگر انتخاب کنید."],
      },
      values: { ...rawValues, slug: parsed.data.slug },
      message: "اسلاگ رویداد تکراری است.",
    };
  }

  let coverUrl = existingEvent?.coverUrl ?? null;
  const cover = formData.get("cover");

  if (cover instanceof File && cover.size > 0) {
    try {
      const uploaded = await uploadPublicImage(cover, "events");
      coverUrl = uploaded?.url ?? coverUrl;
    } catch (error) {
      return {
        ok: false as const,
        values: rawValues,
        message:
          error instanceof Error
            ? error.message
            : "آپلود تصویر رویداد ناموفق بود.",
      };
    }
  }

  const values = {
    title: parsed.data.title,
    slug: parsed.data.slug,
    description: parsed.data.description,
    location: parsed.data.location,
    startsAt: new Date(parsed.data.startsAt),
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    status: parsed.data.status,
    coverUrl,
    updatedAt: new Date(),
  } as const;

  if (existingEvent) {
    try {
      const [updated] = await db
        .update(events)
        .set(values)
        .where(eq(events.id, existingEvent.id))
        .returning();

      return {
        ok: true as const,
        event: updated,
      };
    } catch (error) {
      if (isUniqueSlugError(error)) {
        return {
          ok: false as const,
          fieldErrors: {
            slug: ["این اسلاگ قبلاً استفاده شده است. یکی دیگر انتخاب کنید."],
          },
          values: { ...rawValues, slug: parsed.data.slug },
          message: "اسلاگ رویداد تکراری است.",
        };
      }
      throw error;
    }
  }

  try {
    const [created] = await db
      .insert(events)
      .values({
        ...values,
        createdByUserId,
      })
      .returning();

    return {
      ok: true as const,
      event: created,
    };
  } catch (error) {
    if (isUniqueSlugError(error)) {
      return {
        ok: false as const,
        fieldErrors: {
          slug: ["این اسلاگ قبلاً استفاده شده است. یکی دیگر انتخاب کنید."],
        },
        values: { ...rawValues, slug: parsed.data.slug },
        message: "اسلاگ رویداد تکراری است.",
      };
    }
    throw error;
  }
}

// Guard against the TOCTOU between the slug-uniqueness SELECT above and the
// actual INSERT/UPDATE. Postgres enforces the real uniqueness; we translate
// error 23505 back into the same user-facing slug error.
function isUniqueSlugError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; constraint_name?: unknown };
  if (err.code !== "23505") return false;
  const name = String(err.constraint_name ?? "").toLowerCase();
  return name === "" || name.includes("slug");
}
