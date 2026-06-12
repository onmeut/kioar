import { BellIcon } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";
import { TransferNotificationsList } from "@/components/app/transfer-notifications-list";
import { requireUser } from "@/lib/auth/session";
import { listIncomingForViewer } from "@/lib/transfer-service";

// Authenticated shell — reads the viewer to surface incoming page transfers.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "اعلان‌ها",
};

export default async function NotificationsPage() {
  const viewer = await requireUser();
  const incoming = await listIncomingForViewer(viewer.user.phone).catch(
    () => [],
  );

  const transfers = incoming.map((t) => ({
    id: t.id,
    fromPhone: t.fromUser?.phone ?? null,
    page: t.page
      ? {
          slug: t.page.slug,
          label:
            t.page.fullName?.trim() ||
            t.page.title?.trim() ||
            `/${t.page.slug}`,
          avatarUrl: t.page.avatarUrl,
          avatarSeed: t.page.avatarSeed,
        }
      : null,
  }));

  // No pending transfers → keep the original coming-soon experience.
  if (transfers.length === 0) {
    return (
      <ComingSoon
        icon={BellIcon}
        title="اعلان‌ها"
        description="این بخش به‌زودی فعال می‌شود؛ تاریخچهٔ پیامک، اعلان‌های رزرو و فرم‌ها همین‌جا جمع می‌شود."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center gap-3">
        <BellIcon className="size-6 text-muted-foreground" />
        <h1 className="text-xl font-bold">اعلان‌ها</h1>
      </header>
      <TransferNotificationsList transfers={transfers} />
    </div>
  );
}
