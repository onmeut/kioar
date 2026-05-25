import { requireCompletedProfile } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DesignShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCompletedProfile();
  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
