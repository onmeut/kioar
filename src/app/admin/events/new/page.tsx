import { EventForm } from "@/components/events/event-form";
import { requireAdmin } from "@/lib/auth/session";

export default async function NewEventPage() {
  await requireAdmin();

  return (
    <div className="section-shell space-y-4 py-6">
      <h2 className="text-2xl font-bold">ایجاد رویداد جدید</h2>
      <EventForm />
    </div>
  );
}
