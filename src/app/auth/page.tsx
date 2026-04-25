import { redirect } from "next/navigation";

import { PhoneAuthForm } from "@/components/auth/phone-auth-form";
import { AuthShell } from "@/components/marketing/auth-shell";
import { getPendingSlug } from "@/lib/auth/pending-intent";
import { getCurrentViewer } from "@/lib/auth/session";

export default async function AuthPage() {
  const viewer = await getCurrentViewer();

  if (viewer?.profile?.isComplete) {
    redirect("/dashboard");
  }

  if (viewer?.user) {
    redirect("/onboarding");
  }

  const pendingSlug = await getPendingSlug();

  return (
    <AuthShell>
      <PhoneAuthForm pendingSlug={pendingSlug} />
    </AuthShell>
  );
}
