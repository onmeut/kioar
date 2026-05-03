/**
 * Phase 8 — `/dashboard/pages/[pageId]/trial`.
 *
 * The "claim a free 7-day trial" timeline screen. Reachable by:
 *   - automatic redirect after the user creates their FIRST page (the
 *     onboarding action handles that — see `src/app/onboarding/actions.ts`).
 *   - manual navigation from `/dashboard/pages/[pageId]/billing` for any
 *     subsequent page that hasn't used a trial yet.
 *
 * The "first page only" rule is enforced at the *redirect* sites, not
 * here. This page itself is intentionally accessible whenever the owner
 * wants to look at it — eligibility is presented, not gated. If the page
 * has already used both trials we render the "ineligible" branch with a
 * link to billing settings instead of a CTA.
 *
 * Server-rendered: pulls page + eligibility + plan registry on the server
 * so the screen is fully populated on first paint (no loading flicker on
 * the trial timeline).
 */
import { notFound } from "next/navigation";

import { TrialClaimScreen } from "@/components/dashboard/trial-claim-screen";
import { requireUser } from "@/lib/auth/session";
import { getOwnedPageById } from "@/lib/pages";
import {
  DEFAULT_PROFILE_DOMAIN,
  profileShareHost,
} from "@/lib/profile-domains";
import { getTrialEligibility } from "@/lib/trial";

export const metadata = {
  title: "آزمایش رایگان",
};

type Params = Promise<{ pageId: string }>;

export default async function TrialPage({ params }: { params: Params }) {
  const { pageId } = await params;
  const viewer = await requireUser();

  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) {
    // 404 for both "not found" and "not owned" — never leak the existence
    // of another user's page id.
    notFound();
  }

  const eligibility = await getTrialEligibility(pageId);
  if (!eligibility) {
    notFound();
  }

  const displayName =
    page.fullName?.trim() || page.title?.trim() || `/${page.slug}`;
  const shareHost = profileShareHost(
    page.slug,
    page.domain ?? DEFAULT_PROFILE_DOMAIN,
  );

  const skipHref = `/dashboard/pages/${pageId}/billing`;
  // After a successful trial start, drop the user into their page editor
  // ("صفحه‌ی من") so they can start customising right away — not back to
  // the billing hub. The cookie is set server-side in `startTrial` so the
  // editor renders the trialed page on first paint.
  const successHref = `/page`;

  return (
    <div className="min-h-dvh bg-zinc-50">
      <div className="mx-auto w-full max-w-xl px-4 py-6 sm:py-10">
        <TrialClaimScreen
          pageId={pageId}
          pageDisplayName={displayName}
          shareHost={shareHost}
          options={eligibility.options}
          skipHref={skipHref}
          successHref={successHref}
        />
      </div>
    </div>
  );
}
