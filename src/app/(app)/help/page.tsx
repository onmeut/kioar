import { HelpCircleIcon } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = {
  title: "راهنما و پشتیبانی",
};

export default function HelpPage() {
  return (
    <ComingSoon
      icon={HelpCircleIcon}
      title="راهنما و پشتیبانی"
      description="این بخش به‌زودی فعال می‌شود؛ راهنمای استفاده از کیوار، پاسخ پرسش‌های پرتکرار و راه‌های ارتباط با پشتیبانی را اینجا خواهید دید."
    />
  );
}
