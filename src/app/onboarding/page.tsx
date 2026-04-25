import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { BrandMark } from "@/components/shared/brand-mark";
import { getPendingSlug } from "@/lib/auth/pending-intent";
import { requireUser } from "@/lib/auth/session";
import { getProfileWithLinksByUserId } from "@/lib/data";

import { saveOnboardingProfileAction } from "./actions";

export default async function OnboardingPage() {
  const viewer = await requireUser();
  const profile = await getProfileWithLinksByUserId(viewer.user.id);

  if (profile?.isComplete) {
    redirect("/dashboard");
  }

  // Prefill the slug from the landing-page claim bar (?handle=…), falling back
  // to any slug already stored on a half-built profile.
  const pendingSlug = await getPendingSlug();
  const initialSlug = pendingSlug || profile?.slug || "";

  return (
    <main className="section-shell min-h-dvh py-5">
      <div className="flex items-center justify-between py-3">
        <BrandMark />
      </div>

      <div className="mx-auto w-full max-w-xl space-y-6 py-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-primary">
            مرحله اول از تجربه کیوآر
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">
            نام کاربری‌ات را بگیر.
          </h1>
          <p className="text-sm leading-8 text-muted-foreground sm:text-base">
            فقط چهار فیلد کوتاه: نشانی عمومی، نام، نام خانوادگی و عنوان شغلی.
            بعد از این، مستقیماً می‌توانی لینک‌هایت را اضافه کنی.
          </p>
        </div>

        <OnboardingForm
          action={saveOnboardingProfileAction}
          initialSlug={initialSlug}
        />
      </div>
    </main>
  );
}
