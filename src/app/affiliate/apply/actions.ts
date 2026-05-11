"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { profiles, users } from "@/db/schema";
import { type ActionState } from "@/lib/action-state";
import { submitAffiliateApplication } from "@/lib/affiliate";
import { requireUser } from "@/lib/auth/session";

const CHANNEL_KINDS = [
  "instagram",
  "telegram",
  "youtube",
  "blog",
  "podcast",
  "agency",
  "other",
] as const;

type ChannelKind = (typeof CHANNEL_KINDS)[number];

function isChannelKind(v: string): v is ChannelKind {
  return (CHANNEL_KINDS as readonly string[]).includes(v);
}

/**
 * Submit an affiliate program application. Requires the visitor to be
 * signed in — if they aren't, we redirect to /auth?next=/affiliate/apply
 * so the OTP flow can bring them back. Application validation is light:
 * we trust authenticated users and rely on admin review for quality.
 */
export async function submitAffiliateApplicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let viewer;
  try {
    viewer = await requireUser();
  } catch {
    redirect("/auth?next=%2Faffiliate%2Fapply");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const channelKind = String(formData.get("channelKind") ?? "").trim();
  const channelUrl = String(formData.get("channelUrl") ?? "").trim();

  const fieldErrors: Record<string, string[]> = {};
  if (fullName.length < 2)
    fieldErrors.fullName = ["نام رو کامل وارد کن (حداقل ۲ حرف)."];
  if (!isChannelKind(channelKind))
    fieldErrors.channelKind = ["یکی از گزینه‌ها رو انتخاب کن."];
  if (channelUrl.length < 4)
    fieldErrors.channelUrl = ["لینک یا آدرس کانالت رو وارد کن."];

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "چند مورد رو درست کن و دوباره ارسال کن.",
      fieldErrors,
      values: { fullName, channelKind, channelUrl },
    };
  }

  const result = await submitAffiliateApplication({
    userId: viewer.user.id,
    applicantName: fullName,
    contactPhone: viewer.user.phone,
    contactEmail: null,
    channelKind: channelKind as ChannelKind,
    channelUrl,
    audienceSize: "lt_1k",
    promotionPlan: "",
  });

  if (!result.ok) {
    if (result.reason === "already_open") {
      redirect("/affiliate/dashboard?already=pending");
    }
    if (result.reason === "already_approved") {
      redirect("/affiliate/dashboard");
    }
  }

  revalidatePath("/affiliate/dashboard");
  redirect("/affiliate/apply/thanks");
}

/**
 * Used on /affiliate to nudge unauthenticated users into the auth flow
 * with the right `next` so they come back to the apply form. Server
 * action so it stays on the server boundary even if invoked from a
 * client form.
 */
export async function startAffiliateApplyAction() {
  try {
    await requireUser();
  } catch {
    redirect("/auth?next=%2Faffiliate%2Fapply");
  }
  redirect("/affiliate/apply");
}

/** Look up the signed-in user's display defaults so the apply form is pre-filled. */
export async function getApplyDefaults(userId: string): Promise<{
  fullName: string;
  email: string;
}> {
  const db = getDb();
  const [u, page] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { phone: true },
    }),
    db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { fullName: true },
    }),
  ]);
  return {
    fullName: page?.fullName?.trim() ?? "",
    email: u ? "" : "",
  };
}
