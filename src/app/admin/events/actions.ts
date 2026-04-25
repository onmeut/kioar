"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { type ActionState } from "@/lib/action-state"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/db"
import { eventRegistrations, events } from "@/db/schema"
import { saveEvent } from "@/lib/event-service"

export async function saveEventAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const viewer = await requireAdmin()
  const eventId = String(formData.get("id") || "").trim() || undefined
  const result = await saveEvent(formData, viewer.user.id, eventId)

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      message: result.message,
      values: result.values,
    }
  }

  redirect(`/admin/events/${result.event.id}?saved=1`)
}

export async function updateRegistrationStatusAction(formData: FormData) {
  await requireAdmin()
  const registrationId = String(formData.get("registrationId") || "").trim()
  const nextStatus = String(formData.get("status") || "").trim()
  const eventId = String(formData.get("eventId") || "").trim()

  if (
    !registrationId ||
    !eventId ||
    (nextStatus !== "registered" && nextStatus !== "cancelled")
  ) {
    return
  }

  const db = getDb()
  await db
    .update(eventRegistrations)
    .set({ status: nextStatus })
    .where(eq(eventRegistrations.id, registrationId))

  revalidatePath(`/admin/events/${eventId}`)
}

export async function deleteEventAction(formData: FormData) {
  await requireAdmin()
  const eventId = String(formData.get("eventId") || "").trim()
  if (!eventId) return

  const db = getDb()
  await db.delete(events).where(eq(events.id, eventId))
  redirect("/admin")
}

export async function quickSetStatusAction(formData: FormData) {
  await requireAdmin()
  const eventId = String(formData.get("eventId") || "").trim()
  const nextStatus = String(formData.get("status") || "").trim()

  if (
    !eventId ||
    (nextStatus !== "draft" &&
      nextStatus !== "published" &&
      nextStatus !== "closed")
  ) {
    return
  }

  const db = getDb()
  await db
    .update(events)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(events.id, eventId))

  revalidatePath(`/admin/events/${eventId}`)
  revalidatePath("/admin")
}

