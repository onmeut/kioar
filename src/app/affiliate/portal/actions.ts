"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type ActionState } from "@/lib/action-state";
import { requestAffiliatePayout } from "@/lib/affiliate";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { affiliateProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const SHEBA_RE = /^IR\d{24}$/;
const NATIONAL_ID_RE = /^\d{10}$/;

function normalizeSheba(raw: string): string {
  // Accept "IR..." or "ir..." or just "98... " (24 digits, sometimes with
  // spaces/dashes). We canonicalize to "IR" + 24 digits.
  const stripped = raw.replace(/[\s-]/g, "").toUpperCase();
  if (/^IR\d{24}$/.test(stripped)) return stripped;
  if (/^\d{24}$/.test(stripped)) return `IR${stripped}`;
  return stripped;
}

export async function requestPayoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireUser();
  const sheba = normalizeSheba(String(formData.get("sheba") ?? ""));
  const holderName = String(formData.get("holderName") ?? "").trim();
  const nationalId = String(formData.get("nationalId") ?? "").trim();

  const fieldErrors: Record<string, string[]> = {};
  if (!SHEBA_RE.test(sheba))
    fieldErrors.sheba = ["شماره شبا معتبر نیست. باید با IR شروع بشه."];
  if (holderName.length < 2)
    fieldErrors.holderName = ["نام صاحب حساب رو کامل وارد کن."];
  if (nationalId && !NATIONAL_ID_RE.test(nationalId))
    fieldErrors.nationalId = ["کد ملی باید ۱۰ رقم باشه."];

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "اطلاعات بانکی رو درست کن.",
      fieldErrors,
      values: { sheba, holderName, nationalId },
    };
  }

  const result = await requestAffiliatePayout({
    userId: viewer.user.id,
    shebaNumber: sheba,
    accountHolderName: holderName,
    nationalId: nationalId || undefined,
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_affiliate: "حسابت به‌عنوان همکار فعال نیست.",
      below_threshold: "موجودی قابل برداشت کم‌تر از حداقل آستانه‌ست.",
      no_available: "هیچ مبلغ قابل برداشتی نداری.",
      missing_banking: "اطلاعات بانکی کامل نیست.",
    };
    return { status: "error", message: messages[result.reason] ?? "خطا" };
  }

  revalidatePath("/affiliate/portal");
  revalidatePath("/affiliate/portal/payouts");
  redirect(`/affiliate/portal/payouts?success=${result.amount}`);
}

export async function updateBankingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireUser();
  const sheba = normalizeSheba(String(formData.get("sheba") ?? ""));
  const holderName = String(formData.get("holderName") ?? "").trim();
  const nationalId = String(formData.get("nationalId") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();

  const fieldErrors: Record<string, string[]> = {};
  if (sheba && !SHEBA_RE.test(sheba))
    fieldErrors.sheba = ["شماره شبا معتبر نیست."];
  if (nationalId && !NATIONAL_ID_RE.test(nationalId))
    fieldErrors.nationalId = ["کد ملی باید ۱۰ رقم باشه."];

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "اطلاعات رو درست کن.",
      fieldErrors,
      values: { sheba, holderName, nationalId, contactEmail },
    };
  }

  const db = getDb();
  await db
    .insert(affiliateProfiles)
    .values({
      userId: viewer.user.id,
      displayName: "—",
      channelKind: "other",
      channelUrl: "",
      shebaNumber: sheba || null,
      accountHolderName: holderName || null,
      nationalId: nationalId || null,
      contactEmail: contactEmail || null,
    })
    .onConflictDoUpdate({
      target: affiliateProfiles.userId,
      set: {
        shebaNumber: sheba || null,
        accountHolderName: holderName || null,
        nationalId: nationalId || null,
        contactEmail: contactEmail || null,
        updatedAt: new Date(),
      },
    });

  // Avoid eslint unused
  void eq;

  revalidatePath("/affiliate/portal/settings");
  return { status: "success", message: "اطلاعات ذخیره شد." };
}
