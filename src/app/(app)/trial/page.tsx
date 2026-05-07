/**
 * `/trial` — claim a free trial for the user's CURRENT page.
 *
 * The current page is resolved via the kioar_current_page cookie set by
 * `resolveCurrentPageForOwner` (or, for users with a single page, that one
 * page). We never embed the page id in the URL — page detection is a
 * platform concern, not a routing concern.
 */
import { notFound, redirect } from "next/navigation";

import { TrialClaimScreen } from "@/components/dashboard/trial-claim-screen";
import { requireUser } from "@/lib/auth/session";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import {
  DEFAULT_PROFILE_DOMAIN,
  profileShareHost,
} from "@/lib/profile-domains";
import { getTrialEligibility } from "@/lib/trial";

export const metadata = {
  title: "آزمایش رایگان",
};

export default async function TrialPage() {
  const viewer = await requireUser();

  // No page yet → user hasn't finished onboarding. Punt them back.
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) {
    redirect("/onboarding");
  }

  const eligibility = await getTrialEligibility(page.id);
  if (!eligibility) {
    notFound();
  }

  const displayName =
    page.fullName?.trim() || page.title?.trim() || `/${page.slug}`;
  const shareHost = profileShareHost(
    page.slug,
    page.domain ?? DEFAULT_PROFILE_DOMAIN,
  );

  return (
    <div className="min-h-dvh bg-zinc-50">
      <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
        <TrialClaimScreen
          pageId={page.id}
          pageDisplayName={displayName}
          shareHost={shareHost}
          options={eligibility.options}
          skipHref="/me"
          successHref="/me"
        />
      </div>
    </div>
  );
}
