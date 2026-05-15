import { AuthShell } from "@/components/marketing/auth-shell";
import { StartWizard } from "@/components/onboarding/start-wizard";
import {
  getPendingPageIntent,
  getPendingSlug,
} from "@/lib/auth/pending-intent";
import { getCurrentViewer } from "@/lib/auth/session";
import { getAllActiveCategories, getIndustries } from "@/lib/discover";

import { commitPageIntentAction } from "./actions";

// Reads session cookie + pending-intent cookie — must never be statically
// rendered. New "create a page" entry point: an unauthenticated visitor
// picks slug → page type → category here, then is redirected to /auth to
// sign in. The slug is not reserved in the DB until OTP success.
export const dynamic = "force-dynamic";

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>;
}) {
  const viewer = await getCurrentViewer();

  // No redirect away from /start: this wizard is the single entry point
  // for creating a page — first page OR an additional one for an already
  // onboarded user. Action handlers branch on viewer state.

  const params = await searchParams;
  const [pendingIntent, pendingSlug, industries, categories] =
    await Promise.all([
      getPendingPageIntent(),
      getPendingSlug(),
      getIndustries(),
      getAllActiveCategories(),
    ]);

  const initialSlug = pendingIntent?.slug || pendingSlug || params.handle || "";

  return (
    <AuthShell>
      <StartWizard
        action={commitPageIntentAction}
        initialSlug={initialSlug}
        initialPageType={pendingIntent?.pageType ?? null}
        initialFullName={pendingIntent?.fullName ?? null}
        initialDiscoverCategory={pendingIntent?.discoverCategory ?? null}
        industries={industries}
        categories={categories}
      />
    </AuthShell>
  );
}
