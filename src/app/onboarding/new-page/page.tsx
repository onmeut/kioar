import type { Metadata } from "next";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { AuthShell } from "@/components/marketing/auth-shell";
import { requireUser } from "@/lib/auth/session";

import { createAdditionalPageOnboardingAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ساخت صفحه‌ی جدید",
  robots: { index: false, follow: false },
};

/**
 * "Add new page" surface — launched from the dashboard page-switcher.
 *
 * Renders the exact same multi-step `<OnboardingForm>` used by the
 * post-signup `/onboarding` flow, just wired to a server action that
 * creates an *additional* page for an already-onboarded user instead of
 * filling in their first. Mode `"additional"` only changes a couple of
 * copy strings (e.g. the final CTA reads "ساخت صفحه").
 */
export default async function NewPageOnboardingPage() {
  // Auth-only; we don't gate on `isComplete` because users with multiple
  // existing pages absolutely belong here.
  await requireUser();

  return (
    <AuthShell>
      <OnboardingForm
        action={createAdditionalPageOnboardingAction}
        mode="additional"
      />
    </AuthShell>
  );
}
