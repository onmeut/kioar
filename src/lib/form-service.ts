// Service layer for form blocks (CRUD + visitor submissions).
//
// Mirrors the booking-block service patterns: profile-scoped, transactional,
// authorization is the caller's responsibility (server actions enforce it
// via `requireCompletedProfile`).

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { formFields, formSubmissions, profileFormBlocks } from "@/db/schema";
import {
  type FormBlockInput,
  type FormFieldInput,
  formBlockSchema,
} from "@/lib/validations";
import { resolveCurrentPageForOwner } from "@/lib/pages";

export type FormBlockRow = typeof profileFormBlocks.$inferSelect;
export type FormFieldRow = typeof formFields.$inferSelect;
export type FormSubmissionRow = typeof formSubmissions.$inferSelect;

export type FullFormBlock = FormBlockRow & {
  fields: FormFieldRow[];
};

async function getProfileIdForUser(userId: string): Promise<string | null> {
  // A user can own many pages; the dashboard always operates on the
  // currently-selected one (cookie-driven, with first-page fallback).
  const page = await resolveCurrentPageForOwner(userId);
  return page?.id ?? null;
}

export async function getFormBlocksByProfileId(
  profileId: string,
): Promise<FullFormBlock[]> {
  const db = getDb();
  const blocks = await db
    .select()
    .from(profileFormBlocks)
    .where(eq(profileFormBlocks.profileId, profileId))
    .orderBy(asc(profileFormBlocks.sortOrder));

  if (!blocks.length) return [];

  const blockIds = blocks.map((b) => b.id);
  const fields = await db
    .select()
    .from(formFields)
    .where(inArray(formFields.blockId, blockIds))
    .orderBy(asc(formFields.sortOrder));

  return blocks.map((b) => ({
    ...b,
    fields: fields.filter((f) => f.blockId === b.id),
  }));
}

export async function getFormBlocksByUserId(userId: string) {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return [];
  return getFormBlocksByProfileId(profileId);
}

export async function getPublicActiveFormBlocks(profileId: string) {
  const all = await getFormBlocksByProfileId(profileId);
  return all.filter((b) => b.isActive && b.fields.length > 0);
}

export async function getPublicFormBlockById(blockId: string) {
  const db = getDb();
  const block = await db.query.profileFormBlocks.findFirst({
    where: and(
      eq(profileFormBlocks.id, blockId),
      eq(profileFormBlocks.isActive, true),
    ),
  });
  if (!block) return null;
  const fields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.blockId, block.id))
    .orderBy(asc(formFields.sortOrder));
  return { ...block, fields };
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/** Create a new form block for the given user. */
export async function createFormBlockForUser(
  userId: string,
  input: FormBlockInput,
): Promise<SaveResult> {
  const parsed = formBlockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.",
    };
  }
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) {
    return { ok: false, message: "ابتدا اطلاعات پروفایل را تکمیل کنید." };
  }
  const db = getDb();

  // Compute next sort_order — append after the last form/booking/link.
  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${profileFormBlocks.sortOrder}), 0) + 1`,
    })
    .from(profileFormBlocks)
    .where(eq(profileFormBlocks.profileId, profileId));

  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(profileFormBlocks)
      .values({
        profileId,
        name: parsed.data.name,
        intro: parsed.data.intro,
        outro: parsed.data.outro,
        sortOrder: Number(next ?? 0),
      })
      .returning({ id: profileFormBlocks.id });

    if (parsed.data.fields.length) {
      await tx.insert(formFields).values(
        parsed.data.fields.map((field, index) => ({
          blockId: created.id,
          kind: field.kind,
          label: field.label,
          required: field.required ?? false,
          options: normalizeOptions(field),
          sortOrder: index,
        })),
      );
    }
    return created.id;
  });

  return { ok: true, id };
}

/** Update an existing block (full replace of fields). */
export async function updateFormBlockForUser(
  userId: string,
  blockId: string,
  input: FormBlockInput,
): Promise<SaveResult> {
  const parsed = formBlockSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است.",
    };
  }
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) {
    return { ok: false, message: "پروفایل یافت نشد." };
  }
  const db = getDb();

  const existing = await db.query.profileFormBlocks.findFirst({
    where: and(
      eq(profileFormBlocks.id, blockId),
      eq(profileFormBlocks.profileId, profileId),
    ),
  });
  if (!existing) {
    return { ok: false, message: "فرم یافت نشد." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(profileFormBlocks)
      .set({
        name: parsed.data.name,
        intro: parsed.data.intro,
        outro: parsed.data.outro,
      })
      .where(eq(profileFormBlocks.id, blockId));

    // Diff the fields by stable id when possible — preserves submission
    // references. Fields without an id are inserts; fields whose id
    // disappears from the input are deleted.
    const incomingIds = parsed.data.fields
      .map((f) => f.id)
      .filter((id): id is string => Boolean(id));

    if (incomingIds.length) {
      await tx.delete(formFields).where(
        and(
          eq(formFields.blockId, blockId),
          sql`${formFields.id} NOT IN (${sql.join(
            incomingIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        ),
      );
    } else {
      await tx.delete(formFields).where(eq(formFields.blockId, blockId));
    }

    for (const [index, field] of parsed.data.fields.entries()) {
      if (field.id) {
        await tx
          .update(formFields)
          .set({
            kind: field.kind,
            label: field.label,
            required: field.required ?? false,
            options: normalizeOptions(field),
            sortOrder: index,
          })
          .where(
            and(eq(formFields.id, field.id), eq(formFields.blockId, blockId)),
          );
      } else {
        await tx.insert(formFields).values({
          blockId,
          kind: field.kind,
          label: field.label,
          required: field.required ?? false,
          options: normalizeOptions(field),
          sortOrder: index,
        });
      }
    }
  });

  return { ok: true, id: blockId };
}

export async function deleteFormBlockForUser(
  userId: string,
  blockId: string,
): Promise<{ ok: boolean; message?: string }> {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return { ok: false, message: "پروفایل یافت نشد." };
  const db = getDb();
  await db
    .delete(profileFormBlocks)
    .where(
      and(
        eq(profileFormBlocks.id, blockId),
        eq(profileFormBlocks.profileId, profileId),
      ),
    );
  return { ok: true };
}

export async function setFormBlockActiveForUser(
  userId: string,
  blockId: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return { ok: false, message: "پروفایل یافت نشد." };
  const db = getDb();
  await db
    .update(profileFormBlocks)
    .set({ isActive })
    .where(
      and(
        eq(profileFormBlocks.id, blockId),
        eq(profileFormBlocks.profileId, profileId),
      ),
    );
  return { ok: true };
}

function normalizeOptions(field: FormFieldInput): string[] | null {
  const withOptions = (
    ["single_choice", "checkboxes", "dropdown"] as const
  ).includes(field.kind as never);
  if (!withOptions) return null;
  return (field.options ?? []).map((o) => o.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/** Insert a visitor submission after validating against the field schema. */
export async function submitFormPublic(
  blockId: string,
  values: Record<string, unknown>,
  ipHash: string | null,
): Promise<SubmitResult> {
  const block = await getPublicFormBlockById(blockId);
  if (!block) return { ok: false, message: "فرم یافت نشد یا غیرفعال است." };

  const data: Record<string, string | string[]> = {};

  for (const field of block.fields) {
    const raw = values[field.id];
    const cleaned = cleanValue(field, raw);
    if (cleaned === null) {
      if (field.required) {
        return {
          ok: false,
          message: `لطفاً ${field.label} را تکمیل کنید.`,
        };
      }
      continue;
    }
    data[field.id] = cleaned;
  }

  const db = getDb();
  const [created] = await db
    .insert(formSubmissions)
    .values({ blockId, data, ipHash })
    .returning({ id: formSubmissions.id });

  return { ok: true, id: created.id };
}

function cleanValue(
  field: FormFieldRow,
  raw: unknown,
): string | string[] | null {
  if (field.kind === "checkboxes") {
    if (Array.isArray(raw)) {
      const arr = raw
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter(Boolean);
      const allowed = new Set(field.options ?? []);
      const filtered = arr.filter((v) => allowed.has(v));
      return filtered.length ? filtered : null;
    }
    if (typeof raw === "string" && raw.trim()) {
      return [raw.trim()];
    }
    return null;
  }

  const str = typeof raw === "string" ? raw.trim() : "";
  if (!str) return null;

  if (field.kind === "single_choice" || field.kind === "dropdown") {
    if (!(field.options ?? []).includes(str)) return null;
    return str;
  }
  if (field.kind === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) ? str.slice(0, 200) : null;
  }
  if (field.kind === "phone") {
    return str.replace(/[^\d+]/g, "").slice(0, 32) || null;
  }
  if (field.kind === "date") {
    return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
  }
  // name, country, short_answer, paragraph
  return str.slice(0, field.kind === "paragraph" ? 4000 : 400);
}

export async function getSubmissions(
  userId: string,
  blockId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ rows: FormSubmissionRow[]; total: number } | null> {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return null;
  const db = getDb();
  const block = await db.query.profileFormBlocks.findFirst({
    where: and(
      eq(profileFormBlocks.id, blockId),
      eq(profileFormBlocks.profileId, profileId),
    ),
  });
  if (!block) return null;

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(formSubmissions)
    .where(eq(formSubmissions.blockId, blockId));

  const rows = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.blockId, blockId))
    .orderBy(desc(formSubmissions.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return { rows, total: Number(total) };
}

export async function deleteSubmission(
  userId: string,
  submissionId: string,
): Promise<{ ok: boolean; message?: string }> {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return { ok: false, message: "پروفایل یافت نشد." };
  const db = getDb();
  // Ensure the submission's block belongs to this user.
  const sub = await db.query.formSubmissions.findFirst({
    where: eq(formSubmissions.id, submissionId),
  });
  if (!sub) return { ok: false, message: "ارسال یافت نشد." };
  const block = await db.query.profileFormBlocks.findFirst({
    where: and(
      eq(profileFormBlocks.id, sub.blockId),
      eq(profileFormBlocks.profileId, profileId),
    ),
  });
  if (!block) return { ok: false, message: "اجازه دسترسی ندارید." };
  await db.delete(formSubmissions).where(eq(formSubmissions.id, submissionId));
  return { ok: true };
}

export async function getSubmissionForExport(
  userId: string,
  blockId: string,
): Promise<{ block: FullFormBlock; rows: FormSubmissionRow[] } | null> {
  const profileId = await getProfileIdForUser(userId);
  if (!profileId) return null;
  const db = getDb();
  const block = await db.query.profileFormBlocks.findFirst({
    where: and(
      eq(profileFormBlocks.id, blockId),
      eq(profileFormBlocks.profileId, profileId),
    ),
  });
  if (!block) return null;
  const fields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.blockId, blockId))
    .orderBy(asc(formFields.sortOrder));
  const rows = await db
    .select()
    .from(formSubmissions)
    .where(eq(formSubmissions.blockId, blockId))
    .orderBy(desc(formSubmissions.createdAt));
  return { block: { ...block, fields }, rows };
}
