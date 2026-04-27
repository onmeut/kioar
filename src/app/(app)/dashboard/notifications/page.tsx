import { BellIcon } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";

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
