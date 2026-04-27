import { GiftIcon } from "lucide-react";

import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata = {
  title: "دعوت دوستان",
};

export default function ReferralPage() {
  return (
    <ComingSoon
      icon={GiftIcon}
      title="دعوت دوستان"
      description="این بخش به‌زودی فعال می‌شود؛ با دعوت دوستان به کیوار، اعتبار و تخفیف اشتراک دریافت خواهید کرد."
    />
  );
}
