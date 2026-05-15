import { BellIcon } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";

// Authenticated shell — no direct session call, so be explicit.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "اعلان‌ها",
};

export default function NotificationsPage() {
  return (
    <ComingSoon
      icon={BellIcon}
      title="اعلان‌ها"
      description="این بخش به‌زودی فعال می‌شود؛ تاریخچهٔ پیامک، اعلان‌های رزرو و فرم‌ها همین‌جا جمع می‌شود."
    />
  );
}
