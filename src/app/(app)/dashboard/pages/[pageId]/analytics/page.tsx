import { BarChart3Icon } from "lucide-react";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/shared/coming-soon";
import { requireUser } from "@/lib/auth/session";
import { getOwnedPageById } from "@/lib/pages";

export const metadata = {
  title: "آمار صفحه",
};

type Params = Promise<{ pageId: string }>;

/**
 * Phase-X — placeholder for the page-scoped analytics surface.
 *
 * Real implementation lands in a later phase against the existing
 * `analytics_history_*`, `analytics_geo`, `analytics_device_referrer`,
 * `analytics_csv_export`, etc. feature gates. The route exists now so
 * the sidebar entry has a stable target and the URL shape doesn't churn
 * later.
 */
export default async function AnalyticsPage({ params }: { params: Params }) {
  const { pageId } = await params;
  const viewer = await requireUser();

  // Same ownership guard as the billing hub — `getOwnedPageById` already
  // scopes to the viewer, so a stranger hitting this URL just 404s.
  const page = await getOwnedPageById(pageId, viewer.user.id);
  if (!page) notFound();

  return (
    <ComingSoon
      icon={BarChart3Icon}
      title="آمار صفحه"
      description="این بخش به‌زودی فعال می‌شود؛ گزارش‌های پیشرفتهٔ بازدید، کلیک، منابع ورود، دستگاه‌ها و خروجی CSV همین‌جا در دسترس خواهد بود."
    />
  );
}
