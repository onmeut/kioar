"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";

import { type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { writeCurrentPageIdCookie } from "@/lib/page-cookie";
import { createPageForOwner, listPagesForOwner } from "@/lib/pages";
import { startTrial } from "@/lib/trial";
import { onboardingProfileSchema } from "@/lib/validations";

const MAX_PAGES_PER_OWNER = 25;

/**
 * Server action used by `/onboarding/new-page` (the "Add new page" surface
 * launched from the dashboard page-switcher). Mirrors `saveOnboardingProfileAction`
 * in shape (`(state, formData) => Promise<ActionState>`) so it can plug
 * into the same `<OnboardingForm>` via `useActionState`, but always
 * **creates** a brand-new page instead of updating the user's only one.
 *
 * On success we:
 *   1. Run `createPageForOwner` (slug uniqueness, free-plan seed).
 *   2. Pin the new page as the user's "current page" via cookie.
 *   3. Redirect to `/trial` if the new page is eligible for any paid
 *      plan trial, otherwise straight to the editor at `/me`.
 */
export async function createAdditionalPageOnboardingAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireUser();

  const parsed = onboardingProfileSchema.safeParse({
    pageName: formData.get("pageName"),
    slug: formData.get("slug"),
    pageType: formData.get("pageType"),
    discoverCategory: formData.get("discoverCategory"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات ناقص یا نامعتبر است.",
    };
  }

  const existing = await listPagesForOwner(viewer.user.id);
  if (existing.length >= MAX_PAGES_PER_OWNER) {
    return {
      status: "error",
      message: `حداکثر ${MAX_PAGES_PER_OWNER} صفحه برای هر حساب قابل ساخت است.`,
    };
  }

  const result = await createPageForOwner({
    ownerId: viewer.user.id,
    slug: parsed.data.slug,
    fullName: parsed.data.pageName,
    pageType: parsed.data.pageType,
    discoverCategory: parsed.data.discoverCategory,
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
        slug: ["نام کاربری معتبر نیست (۳ تا ۳۰ کاراکتر، حروف انگلیسی و عدد)."],
      },
      message: "نام کاربری نامعتبر است.",
    };
  }

  // Switch the page-switcher cookie to the freshly-created page so the
  // user lands on its editor when we redirect.
  await writeCurrentPageIdCookie(result.page.id);
  revalidatePath("/", "layout");

  // Auto-start the trial for every newly created page. Plan is chosen
  // from the user's selected page type — "business" pages get the
  // Business trial, everyone else gets Pro.
  await startTrial({
    pageId: result.page.id,
    planKey: parsed.data.pageType === "business" ? "business" : "pro",
    ownerId: viewer.user.id,
  });

  redirect("/me" as Route);
}
