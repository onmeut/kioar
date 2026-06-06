import { requireCompletedProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Standalone full-screen shell for the card studio — mirrors the (design)
 * group: auth-gated, but no sidebar/header/bottom-nav chrome. The studio
 * owns the entire viewport for a focused, premium ordering experience.
 */
export default async function CardStudioShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCompletedProfile();
  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      {children}
    </div>
  );
}
