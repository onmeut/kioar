"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { setBlockSpotlightForUser } from "@/lib/block-spotlight-service";

const inputSchema = z.object({
  blockKind: z.enum(["link", "form", "booking"]),
  blockId: z.string().uuid(),
  spotlight: z.enum(["none", "pin", "animate"]),
  animationStyle: z
    .enum(["buzz", "wobble", "pop", "swipe"])
    .nullable()
    .optional(),
});

export async function setBlockSpotlightAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();
  const parsed = inputSchema.safeParse({
    blockKind: formData.get("blockKind"),
    blockId: formData.get("blockId"),
    spotlight: formData.get("spotlight"),
    animationStyle: formData.get("animationStyle") || null,
  });

  if (!parsed.success) {
    return { status: "error", message: "ورودی نامعتبر است." };
  }

  const result = await setBlockSpotlightForUser({
    userId: viewer.user.id,
    blockKind: parsed.data.blockKind,
    blockId: parsed.data.blockId,
    spotlight: parsed.data.spotlight,
    animationStyle: parsed.data.animationStyle ?? null,
  });

  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  revalidatePath("/me");
  revalidatePath(`/${viewer.profile.slug}`);
  return { status: "success" };
}
