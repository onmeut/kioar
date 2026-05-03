"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  approveAffiliateApplication,
  markPayoutPaid,
  markPayoutProcessing,
  rejectAffiliateApplication,
  rejectPayout,
  requestMoreInfoAffiliateApplication,
  setAffiliateStatus,
  updateAffiliateAdminNotes,
  updateAffiliateBanking,
  updateAffiliateSettings,
} from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";

export async function approveApplicationAction(formData: FormData) {
  const viewer = await requireAdmin();
  const applicationId = String(formData.get("applicationId") ?? "");
  if (!applicationId) return;
  const overridesPct = Number(formData.get("commissionPct") ?? 0);
  const overridesHold = Number(formData.get("holdingPeriodDays") ?? 0);
  const overridesMin = Number(formData.get("minWithdrawalToman") ?? 0);
  await approveAffiliateApplication({
    applicationId,
    adminUserId: viewer.user.id,
    overrides: {
      ...(overridesPct > 0 && { commissionPct: overridesPct }),
      ...(overridesHold > 0 && { holdingPeriodDays: overridesHold }),
      ...(overridesMin > 0 && { minWithdrawalToman: overridesMin }),
    },
  });
  revalidatePath("/admin/affiliates");
  revalidatePath("/admin/affiliates/applications");
}

export async function rejectApplicationAction(formData: FormData) {
  const viewer = await requireAdmin();
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!applicationId || reason.length < 4) return;
  await rejectAffiliateApplication({
    applicationId,
    adminUserId: viewer.user.id,
    reason,
  });
  revalidatePath("/admin/affiliates/applications");
}

export async function needsInfoApplicationAction(formData: FormData) {
  const viewer = await requireAdmin();
  const applicationId = String(formData.get("applicationId") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  if (!applicationId || message.length < 4) return;
  await requestMoreInfoAffiliateApplication({
    applicationId,
    adminUserId: viewer.user.id,
    message,
  });
  revalidatePath("/admin/affiliates/applications");
}

export async function setStatusAction(formData: FormData) {
  const viewer = await requireAdmin();
  const affiliateUserId = String(formData.get("affiliateUserId") ?? "");
  const status = String(formData.get("status") ?? "") as
    | "active"
    | "paused"
    | "banned";
  const reason = String(formData.get("reason") ?? "").trim() || "—";
  if (!affiliateUserId) return;
  if (!["active", "paused", "banned"].includes(status)) return;
  await setAffiliateStatus({
    affiliateUserId,
    status,
    adminUserId: viewer.user.id,
    reason,
  });
  revalidatePath(`/admin/affiliates/${affiliateUserId}`);
  revalidatePath("/admin/affiliates");
}

export async function payoutMarkProcessingAction(formData: FormData) {
  const viewer = await requireAdmin();
  const payoutId = String(formData.get("payoutId") ?? "");
  if (!payoutId) return;
  await markPayoutProcessing({ payoutId, adminUserId: viewer.user.id });
  revalidatePath("/admin/affiliates/payouts");
}

export async function payoutMarkPaidAction(formData: FormData) {
  const viewer = await requireAdmin();
  const payoutId = String(formData.get("payoutId") ?? "");
  const ref = String(formData.get("transactionRef") ?? "").trim();
  if (!payoutId || ref.length < 3) return;
  await markPayoutPaid({
    payoutId,
    adminUserId: viewer.user.id,
    transactionRef: ref,
  });
  revalidatePath("/admin/affiliates/payouts");
}

export async function payoutRejectAction(formData: FormData) {
  const viewer = await requireAdmin();
  const payoutId = String(formData.get("payoutId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!payoutId || reason.length < 3) return;
  await rejectPayout({
    payoutId,
    adminUserId: viewer.user.id,
    reason,
  });
  revalidatePath("/admin/affiliates/payouts");
}

export async function updateAdminBankingAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const sheba = String(formData.get("sheba") ?? "").trim() || null;
  const holderName = String(formData.get("holderName") ?? "").trim() || null;
  const nationalId = String(formData.get("nationalId") ?? "").trim() || null;
  const contactEmail =
    String(formData.get("contactEmail") ?? "").trim() || null;
  await updateAffiliateBanking({
    userId,
    shebaNumber: sheba,
    accountHolderName: holderName,
    nationalId,
    contactEmail,
  });
  revalidatePath(`/admin/affiliates/${userId}`);
}

export async function updateAdminNotesAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  await updateAffiliateAdminNotes({ userId, notes });
  revalidatePath(`/admin/affiliates/${userId}`);
}

export async function updateSettingsAction(formData: FormData) {
  const viewer = await requireAdmin();
  const commissionPct = Number(formData.get("commissionPct") ?? 0);
  const holdingPeriodDays = Number(formData.get("holdingPeriodDays") ?? 0);
  const minWithdrawalToman = Number(formData.get("minWithdrawalToman") ?? 0);
  const contentRulesMd =
    String(formData.get("contentRulesMd") ?? "").trim() || null;

  await updateAffiliateSettings(
    {
      ...(commissionPct > 0 && { commissionPct }),
      ...(holdingPeriodDays > 0 && { holdingPeriodDays }),
      ...(minWithdrawalToman > 0 && { minWithdrawalToman }),
      contentRulesMd,
    },
    viewer.user.id,
  );
  revalidatePath("/admin/affiliates/settings");
  redirect("/admin/affiliates/settings?saved=1" as Route);
}
