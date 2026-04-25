import type { Route } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  ArrowUpRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react";

import {
  deleteEventAction,
  quickSetStatusAction,
} from "@/app/admin/events/actions";
import { DeleteEventButton } from "@/components/admin/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { EventParticipantsList } from "@/components/events/event-participants-list";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  getAdminEventRegistrations,
  getEventRegisteredCount,
} from "@/lib/data";
import { formatPersianDateTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<
  "draft" | "published" | "closed",
  { label: string; className: string }
> = {
  draft: {
    label: "پیش‌نویس",
    className: "bg-muted text-foreground",
  },
  published: {
    label: "منتشرشده",
    className: "bg-emerald-500/12 text-emerald-700",
  },
  closed: {
    label: "بسته‌شده",
    className: "bg-destructive/10 text-destructive",
  },
};

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; tab?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { saved, tab } = await searchParams;
  const db = getDb();
  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });

  if (!event) {
    notFound();
  }

  const [registrations, registeredCount] = await Promise.all([
    getAdminEventRegistrations(event.id),
    getEventRegisteredCount(event.id),
  ]);

  const statusMeta = STATUS_LABELS[event.status];
  const defaultTab = tab === "participants" ? "participants" : "details";

  return (
    <div className="section-shell space-y-5 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("rounded-full", statusMeta.className)}>
              {statusMeta.label}
            </Badge>
            <Badge className="rounded-full bg-primary/10 text-primary">
              {toPersianDigits(registeredCount)} ثبت‌نام
            </Badge>
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl">{event.title}</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDaysIcon className="size-4 text-primary" />
              {formatPersianDateTime(event.startsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="size-4 text-primary" />
              {event.location}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status === "published" ? (
            <Link
              href={`/events/${event.slug}` as Route}
              target="_blank"
              className={cn(
                buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "h-11",
                }),
              )}
            >
              <ArrowUpRightIcon className="size-4" />
              صفحه عمومی
            </Link>
          ) : null}
          {event.status !== "published" ? (
            <form action={quickSetStatusAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="published" />
              <Button size="lg" className="h-11">
                <CheckCircle2Icon className="size-4" />
                انتشار رویداد
              </Button>
            </form>
          ) : (
            <form action={quickSetStatusAction}>
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="closed" />
              <Button variant="outline" size="lg" className="h-11">
                بستن ثبت‌نام
              </Button>
            </form>
          )}
          <DeleteEventButton
            eventId={event.id}
            deleteAction={deleteEventAction}
          />
        </div>
      </div>

      {saved === "1" ? (
        <div className="flex items-center gap-2 rounded-3xl bg-emerald-500/10 p-4 text-sm text-emerald-700">
          <CheckCircle2Icon className="size-4" />
          تغییرات رویداد با موفقیت ذخیره شد.
        </div>
      ) : null}

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">جزئیات رویداد</TabsTrigger>
          <TabsTrigger value="participants">
            <UsersIcon className="size-4" />
            شرکت‌کنندگان ({toPersianDigits(registeredCount)})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <EventForm initialEvent={event} />
        </TabsContent>

        <TabsContent value="participants" className="space-y-4">
          <EventParticipantsList
            eventId={event.id}
            registrations={registrations}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
