"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionState } from "@/lib/action-state";
import { requireCompletedProfile } from "@/lib/auth/session";
import { fetchLinkMetadata, type LinkMetadata } from "@/lib/link-metadata";
import { saveProfileLinksForUser } from "@/lib/profile-service";
import { profileLinksArraySchema } from "@/lib/validations";

export async function updateLinksAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireCompletedProfile();

  let parsedLinks: z.infer<typeof profileLinksArraySchema>;
  try {
    parsedLinks = profileLinksArraySchema.parse(
      JSON.parse(String(formData.get("links") || "[]")),
    );
  } catch {
    return {
      status: "error",
      fieldErrors: { links: ["لیست لینک‌ها معتبر نیست."] },
      message: "لینک‌ها را دوباره بررسی کنید.",
    };
  }

  const result = await saveProfileLinksForUser(viewer.user.id, parsedLinks);

  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: result.fieldErrors,
      message: result.message,
    };
  }

  revalidatePath("/page");
  revalidatePath(`/${viewer.profile.slug}`);

  return {
    status: "success",
    message: "لینک‌ها ذخیره شد.",
  };
}

export async function fetchLinkMetadataAction(
  url: string,
): Promise<{ ok: true; data: LinkMetadata } | { ok: false; message: string }> {
  await requireCompletedProfile();
  const data = await fetchLinkMetadata(url);
  if (!data) {
    return {
      ok: false,
      message: "نشانی معتبر نیست یا قابل دسترسی نیست.",
    };
  }
  return { ok: true, data };
}
