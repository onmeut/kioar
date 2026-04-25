"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { getDb } from "@/db"
import { eventRegistrations, events } from "@/db/schema"
import { setPendingEventRegistration } from "@/lib/auth/pending-intent"
import { getCurrentViewer } from "@/lib/auth/session"

export async function registerForEventAction(formData: FormData) {
  const slug = String(formData.get("slug") || "").trim()

  if (!slug) {
    redirect("/events")
  }

  const db = getDb()
  const event = await db.query.events.findFirst({
    where: and(eq(events.slug, slug), eq(events.status, "published")),
  })

  if (!event) {
    redirect("/events")
  }

  const viewer = await getCurrentViewer()

  if (!viewer) {
    await setPendingEventRegistration(slug)
    redirect("/auth")
  }

  if (!viewer.profile?.isComplete) {
    await setPendingEventRegistration(slug)
    redirect("/onboarding")
  }

  const existing = await db.query.eventRegistrations.findFirst({
    where: and(
      eq(eventRegistrations.eventId, event.id),
      eq(eventRegistrations.userId, viewer.user.id)
    ),
  })

  if (!existing) {
    await db.insert(eventRegistrations).values({
      eventId: event.id,
      userId: viewer.user.id,
      status: "registered",
    })
  } else if (existing.status !== "registered") {
    await db
      .update(eventRegistrations)
      .set({ status: "registered" })
      .where(eq(eventRegistrations.id, existing.id))
  }

  redirect(`/events/${slug}?registered=1`)
}
