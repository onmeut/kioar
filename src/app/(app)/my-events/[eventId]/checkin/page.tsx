import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { CheckinScanner } from "@/components/events/checkin-scanner";
import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import { getHostEvent } from "@/lib/events/queries";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Owner-gated door check-in. The scanner reads the attendee's EXISTING personal
 * Kioar QR (no per-event ticket) and resolves their registration for THIS event
 * in real time. Access is the same guard as /manage — page owner only.
 */
export default async function CheckinPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const viewer = await requireCompletedProfile();
  const page = await resolveCurrentPageForOwner(viewer.user.id);
  if (!page) redirect("/me");
  if (!(await pageHasFeature(page.id, "business_events"))) redirect("/me");

  const data = await getHostEvent(eventId, page.id);
  if (!data) redirect("/my-events");
  const { event } = data;

  return (
    <div className="section-shell space-y-5 py-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/my-events/${event.id}/manage` as Route}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "size-11 shrink-0",
          )}
          aria-label="بازگشت"
        >
          <ArrowRightIcon className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">ورود مهمان‌ها</h1>
          <p className="truncate text-sm text-muted-foreground">
            {event.title}
          </p>
        </div>
      </div>

      <CheckinScanner eventId={event.id} timezone={event.timezone} />

      <p className="text-center text-xs text-muted-foreground">
        مهمان کافی است کد QR شخصی‌اش را در حساب کی‌یوآر نشان دهد؛ نیازی به بلیت
        جداگانه نیست.
      </p>
    </div>
  );
}
