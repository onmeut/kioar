import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { AuthShell } from "@/components/marketing/auth-shell";
import { getPendingSlug } from "@/lib/auth/pending-intent";
import { requireUser } from "@/lib/auth/session";
import { getProfileWithLinksByUserId } from "@/lib/data";
import { getDiscoverCategories } from "@/lib/discover";

import { saveOnboardingProfileAction } from "./actions";

export default async function OnboardingPage() {
  const viewer = await requireUser();
  const profile = await getProfileWithLinksByUserId(viewer.user.id);

  if (profile?.isComplete) {
    redirect("/dashboard");
  }

  const pendingSlug = await getPendingSlug();
  const initialSlug = pendingSlug || profile?.slug || "";
  const categories = await getDiscoverCategories();

  return (
    <AuthShell>
      <OnboardingForm
        action={saveOnboardingProfileAction}
        initialSlug={initialSlug}
        categories={categories}
      />
    </AuthShell>
  );
}
