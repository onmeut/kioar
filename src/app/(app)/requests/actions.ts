"use server";

import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { cardRequests } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { cardRequestSchema } from "@/lib/validations";

export async function createCardRequestAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();

  const parsed = cardRequestSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    deliveryInfo: formData.get("deliveryInfo"),
    cardType: formData.get("cardType"),
    cardDesign: formData.get("cardDesign"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "فرم درخواست کامل نیست.",
    };
  }

  const db = getDb();

  await db.insert(cardRequests).values({
    userId: viewer.user.id,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    deliveryInfo: parsed.data.deliveryInfo,
    cardType: parsed.data.cardType,
    cardDesign: parsed.data.cardDesign,
    notes: parsed.data.notes || null,
  });

  redirect("/premium?sent=1");
}
