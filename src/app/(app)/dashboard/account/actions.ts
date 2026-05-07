"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const accountSchema = z.object({
  firstName: z.string().trim().max(40).optional(),
  lastName: z.string().trim().max(40).optional(),
});

export async function saveAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireUser();

  const parsed = accountSchema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "اطلاعات نامعتبر است.",
    };
  }

  const db = getDb();
  await db
    .update(users)
    .set({
      firstName: parsed.data.firstName || null,
      lastName: parsed.data.lastName || null,
    })
    .where(eq(users.id, viewer.user.id));

  return { status: "success", message: "اطلاعات ذخیره شد." };
}
