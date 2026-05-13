import { redirect } from "next/navigation";

import { OtpVerificationForm } from "@/components/auth/otp-verification-form";
import { AuthShell } from "@/components/marketing/auth-shell";
import { getCurrentViewer } from "@/lib/auth/session";
import { normalizeIranianPhone } from "@/lib/phone";

// Reads session cookie + per-request searchParams — never static.
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{
    phone?: string;
    cooldownUntil?: string;
  }>;
}) {
  const viewer = await getCurrentViewer();

  if (viewer?.profile?.isComplete) {
    redirect("/dashboard");
  }

  if (viewer?.user) {
    redirect("/onboarding");
  }

  const params = await searchParams;

  if (!params.phone) {
    redirect("/auth");
  }

  let phone = params.phone;

  try {
    phone = normalizeIranianPhone(phone);
  } catch {
    redirect("/auth");
  }

  const cooldownUntil = Number(params.cooldownUntil);
  const initialCooldownUntil = Number.isFinite(cooldownUntil)
    ? cooldownUntil
    : undefined;

  return (
    <AuthShell>
      <OtpVerificationForm
        phone={phone}
        initialCooldownUntil={initialCooldownUntil}
      />
    </AuthShell>
  );
}
