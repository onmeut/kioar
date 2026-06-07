import { notFound, redirect } from "next/navigation";

import { EventForm } from "@/components/events/event-form";
import { requireCompletedProfile } from "@/lib/auth/session";
import { pageHasFeature } from "@/lib/entitlements";
import { toEventFormInitial } from "@/lib/events/event-mapper";
import { getHostEvent } from "@/lib/events/queries";
import { resolveCurrentPageForOwner } from "@/lib/pages";
import { saveEventAction } from "@/app/(app)/my-events/actions";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
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
  if (!data) notFound();

  return (
    <div className="section-shell py-6">
      <h1 className="mb-6 text-xl font-bold">ویرایش رویداد</h1>
      <EventForm
        pageId={page.id}
        initial={toEventFormInitial(data)}
        saveAction={saveEventAction}
      />
    </div>
  );
}
