import { redirect } from "next/navigation";

import { PhoneAuthForm } from "@/components/auth/phone-auth-form";
import { AuthShell } from "@/components/marketing/auth-shell";
import { getCurrentViewer } from "@/lib/auth/session";

// Reads session cookie — must never be statically rendered.
export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const viewer = await getCurrentViewer();

  if (viewer?.profile?.isComplete) {
    redirect("/dashboard");
  }

  if (viewer?.user) {
    redirect("/onboarding");
  }

  return (
    <AuthShell>
      <PhoneAuthForm />
    </AuthShell>
  );
}
