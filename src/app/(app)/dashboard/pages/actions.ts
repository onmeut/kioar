"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import {
  createPageForOwner,
  getOwnedPageById,
  listPagesForOwner,
  switchCurrentPageForOwner,
} from "@/lib/pages";
import { writeCurrentPageIdCookie } from "@/lib/page-cookie";
import { getTrialEligibility } from "@/lib/trial";

export type CreatePageActionResult =
  | {
      ok: true;
      pageId: string;
      slug: string;
      /**
       * Where the client should `router.push` after creation. Either the
       * trial claim screen for this freshly-created page (when at least
       * one paid plan is trial-eligible — which is always true for a new
       * page) or `/page` as a safe fallback.
       */
      redirectTo: string;
    }
  | { ok: false; message: string; field?: "slug" | "fullName" };

const MAX_PAGES_PER_OWNER = 25;

export async function createPageAction(
  formData: FormData,
): Promise<CreatePageActionResult> {
  const viewer = await requireUser();
  const slug = String(formData.get("slug") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!fullName) {
    return { ok: false, message: "نام صفحه را وارد کنید.", field: "fullName" };
  }
  if (!slug) {
    return { ok: false, message: "نام کاربری را وارد کنید.", field: "slug" };
  }

  const existing = await listPagesForOwner(viewer.user.id);
  if (existing.length >= MAX_PAGES_PER_OWNER) {
    return {
      ok: false,
      message: `حداکثر ${MAX_PAGES_PER_OWNER} صفحه برای هر حساب قابل ساخت است.`,
    };
  }

  const result = await createPageForOwner({
    ownerId: viewer.user.id,
    slug,
    fullName,
    title: title || null,
  });

  if (!result.ok) {
    if (result.reason === "slug_taken") {
      return {
        ok: false,
        field: "slug",
        message: "این نام کاربری قبلاً گرفته شده است.",
      };
    }
    if (result.reason === "slug_reserved") {
      return {
        ok: false,
        field: "slug",
        message: "این نام کاربری رزرو شده است.",
      };
    }
    return {
      ok: false,
      field: "slug",
      message: "نام کاربری معتبر نیست (۳ تا ۳۰ کاراکتر، حروف انگلیسی و عدد).",
    };
  }

  // Newly-created page becomes the current one immediately so the user lands
  // in its editor right after creation.
  await writeCurrentPageIdCookie(result.page.id);
  revalidatePath("/", "layout");

  // Offer the per-page trial as the very next step, mirroring the
  // post-onboarding flow. A new page is always Free + has never used
  // either trial, so at least one paid plan is eligible — but we still
  // verify defensively to avoid stranding the user on an empty trial
  // screen if the registry is weird (e.g. all paid plans deactivated).
  let redirectTo = "/me";
  const eligibility = await getTrialEligibility(result.page.id);
  if (eligibility?.options.some((o) => o.eligible)) {
    redirectTo = "/trial";
  }

  return {
    ok: true,
    pageId: result.page.id,
    slug: result.page.slug,
    redirectTo,
  };
}

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

  // Land on another owned page so the next render doesn't 404.
  const fallback = owned.find((p) => p.id !== pageId);
  if (fallback) {
    await writeCurrentPageIdCookie(fallback.id);
  }

  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/me" };
}
