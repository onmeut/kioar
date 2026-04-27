import { UserIcon } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = {
  title: "پروفایل کاربری",
};

export default function UserProfilePage() {
  return (
    <ComingSoon
      icon={UserIcon}
      title="پروفایل کاربری"
      description="این بخش به‌زودی فعال می‌شود؛ ویرایش نام، شماره تماس، ایمیل و رمز عبور حسابتان همین‌جا انجام می‌شود."
    />
  );
}
