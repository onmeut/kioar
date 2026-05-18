"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { type ActionState } from "@/lib/action-state";
import {
  clearPendingPageIntent,
  clearPendingSlug,
  setPendingPageIntent,
} from "@/lib/auth/pending-intent";
import { getCurrentViewer } from "@/lib/auth/session";
import { writeCurrentPageIdCookie } from "@/lib/page-cookie";
import { isPageTypeSlug, type PageTypeSlug } from "@/lib/page-type";
import { createPageForOwner, listPagesForOwner } from "@/lib/pages";
import { saveOnboardingProfileForUser } from "@/lib/profile-service";
import { isReservedSlug, normalizeSlug } from "@/lib/slug";
import { startTrial } from "@/lib/trial";

const MAX_PAGES_PER_OWNER = 25;

/**
 * Final step of the /start wizard — the single entry point for creating
 * any page (first page, second page, Nth page).
 *
 * Branches:
 *   - Unauthenticated visitor → persist {slug, pageType, discoverCategory}
 *     into the `kioar_pending_page_intent` cookie and redirect to /auth.
 *     Nothing is written to the database; the slug is NOT reserved.
 *   - Authenticated visitor without a completed profile (legacy users who
 *     signed up before /start existed) → save the page row directly via
 *     `saveOnboardingProfileForUser` and start the trial.
 *   - Authenticated visitor who already has at least one page → create an
 *     *additional* page via `createPageForOwner`, pin it as the current
 *     page, start its trial, then redirect to /me.
 */
export async function commitPageIntentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawSlug = String(formData.get("slug") ?? "");
  const slug = normalizeSlug(rawSlug);
  if (!slug || slug.length < 2) {
    return {
      status: "error",
      fieldErrors: { slug: ["نام کاربری خیلی کوتاه است."] },
      message: "نام کاربری معتبر نیست.",
    };
  }
  if (isReservedSlug(slug)) {
    return {
      status: "error",
      fieldErrors: { slug: ["این نام کاربری رزرو شده است."] },
      message: "نام کاربری دیگری انتخاب کنید.",
    };
  }

  const rawPageType = String(formData.get("pageType") ?? "");
  const pageType: PageTypeSlug | null = isPageTypeSlug(rawPageType)
    ? rawPageType
    : null;

  const rawCategory = String(formData.get("discoverCategory") ?? "");
  const discoverCategory = rawCategory.length > 0 ? rawCategory : null;

  const rawFullName = String(formData.get("pageName") ?? "").trim();
  const fullName = rawFullName.length > 0 ? rawFullName.slice(0, 80) : null;
  if (!fullName) {
    return {
      status: "error",
      fieldErrors: { pageName: ["نام صفحه را وارد کنید."] },
      message: "نام صفحه را وارد کنید.",
    };
  }

  const viewer = await getCurrentViewer();

  // Unauthenticated → stash in cookie, send to /auth.
  if (!viewer?.user) {
    await setPendingPageIntent({ slug, pageType, fullName, discoverCategory });
    // Drop the legacy single-slug cookie; the new intent cookie supersedes it.
    await clearPendingSlug();
    redirect("/auth");
  }

  // Authed + already onboarded → create an *additional* page.
  if (viewer.profile?.isComplete) {
    const existing = await listPagesForOwner(viewer.user.id);
    if (existing.length >= MAX_PAGES_PER_OWNER) {
      return {
        status: "error",
        message: `حداکثر ${MAX_PAGES_PER_OWNER} صفحه برای هر حساب قابل ساخت است.`,
      };
    }

    const result = await createPageForOwner({
      ownerId: viewer.user.id,
      slug,
      fullName,
      pageType,
      discoverCategory,
    });

    if (!result.ok) {
      if (result.reason === "slug_taken") {
        return {
          status: "error",
          fieldErrors: { slug: ["این نام کاربری قبلاً گرفته شده است."] },
          message: "نام کاربری تکراری است.",
        };
      }
      if (result.reason === "slug_reserved") {
        return {
          status: "error",
          fieldErrors: { slug: ["این نام کاربری رزرو شده است."] },
          message: "نام کاربری رزرو شده است.",
        };
      }
      return {
        status: "error",
        fieldErrors: {
          slug: [
            "نام کاربری معتبر نیست (۳ تا ۳۰ کاراکتر، حروف انگلیسی و عدد).",
          ],
        },
        message: "نام کاربری نامعتبر است.",
      };
    }

    // Pin the freshly created page as the current page so /me lands on its
    // editor (mirrors /onboarding/new-page behaviour).
    await writeCurrentPageIdCookie(result.page.id);
    revalidatePath("/", "layout");

    await clearPendingPageIntent();
    await clearPendingSlug();

    await startTrial({
      pageId: result.page.id,
      planKey: pageType === "business" ? "business" : "pro",
      ownerId: viewer.user.id,
    });

    redirect("/me?new=1");
  }

  // Legacy authed-but-incomplete user: write directly via the onboarding
  // profile service (updates the existing empty profile row in place).
  const fd = new FormData();
  fd.set("slug", slug);
  fd.set("pageName", fullName);
  if (pageType) fd.set("pageType", pageType);
  if (discoverCategory) fd.set("discoverCategory", discoverCategory);

  const result = await saveOnboardingProfileForUser(viewer.user.id, fd);
  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      message: result.message,
    };
  }

  await clearPendingPageIntent();
  await clearPendingSlug();

  if (result.isFirstPage) {
    const planKey = pageType === "business" ? "business" : "pro";
    await startTrial({
      pageId: result.pageId,
      planKey,
      ownerId: viewer.user.id,
    });
  }

  redirect("/me?new=1");
}
