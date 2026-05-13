"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { invalidateProfileCacheBySlug } from "@/lib/cache/profile-cache";
import {
  getOwnedPageById,
  listPagesForOwner,
  switchCurrentPageForOwner,
} from "@/lib/pages";
import { writeCurrentPageIdCookie } from "@/lib/page-cookie";

export type SwitchPageActionResult =
  | { ok: true; slug: string }
  | { ok: false; message: string };

export async function switchPageAction(
  pageId: string,
): Promise<SwitchPageActionResult> {
  const viewer = await requireUser();
  const page = await switchCurrentPageForOwner(pageId, viewer.user.id);
  if (!page) {
    return { ok: false, message: "صفحه پیدا نشد." };
  }
  // Bust every authenticated surface that reads the current page — `/page`
  // (the editor) lives outside `/dashboard`, so we revalidate the root
  // layout to cover the whole `(app)` segment.
  revalidatePath("/", "layout");
  return { ok: true, slug: page.slug };
}

export type DeletePageActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; message: string };

/**
 * User-initiated permanent deletion of a page they own.
 *
 * Guards:
 *  - Caller must own the page.
 *  - Caller must retype the slug to prove intent.
 *  - The page can't be the owner's last page (each account always has at
 *    least one).
 *  - If the page has paid invoices (FK 23503 from invoices.page_id which
 *    is `onDelete: restrict` for accounting reasons) we surface a friendly
 *    error and tell the user to contact support.
 *
 * On success, switches the current-page cookie to one of the remaining
 * pages so the dashboard reload doesn't land on a dead id.
 */
export async function deletePageAction(
  pageId: string,
  confirmSlug: string,
): Promise<DeletePageActionResult> {
  const viewer = await requireUser();
  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) return { ok: false, message: "صفحه پیدا نشد." };

  if (confirmSlug.trim().toLowerCase() !== page.slug.toLowerCase()) {
    return {
      ok: false,
      message: "نام کاربری صفحه را برای تأیید درست وارد کن.",
    };
  }

  const owned = await listPagesForOwner(viewer.user.id);
  if (owned.length <= 1) {
    return {
      ok: false,
      message:
        "نمی‌توانی تنها صفحه‌ی حساب را حذف کنی. اول یک صفحه‌ی دیگر بساز.",
    };
  }

  try {
    const db = await getDb();
    await db.delete(profiles).where(eq(profiles.id, pageId));
  } catch (err) {
    // Postgres FK violation. Surfaced when invoices reference this page.
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : "";
    if (code === "23503") {
      return {
        ok: false,
        message:
          "این صفحه فاکتور پرداختی دارد و به‌خاطر سوابق مالی قابل حذف نیست. برای حذف کامل با پشتیبانی تماس بگیر.",
      };
    }
    throw err;
  }

  // Drop any cached entry for the deleted page's slug so a /[slug] visit
  // serves a 404 sentinel (or a fresh DB miss) instead of stale content.
  await invalidateProfileCacheBySlug(page.slug);

  // Land on another owned page so the next render doesn't 404.
  const fallback = owned.find((p) => p.id !== pageId);
  if (fallback) {
    await writeCurrentPageIdCookie(fallback.id);
  }

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/me" };
}
