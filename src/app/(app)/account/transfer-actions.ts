"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  acceptTransfer,
  cancelTransfer,
  createTransfer,
  rejectTransfer,
} from "@/lib/transfer-service";

/**
 * Server actions for page-ownership transfers. Every action calls
 * `requireUser()` and re-validates ownership/recipient inside the service —
 * the client is never trusted. The token in the public flow is only a
 * locator; acceptance is gated on the authenticated viewer's phone matching
 * the transfer's recipient phone (enforced in `transfer-service`).
 */

export type InitiateTransferState = {
  status: "idle" | "success" | "error";
  message?: string;
  /** Populated on success so the client can render the QR / share link. */
  data?: {
    recipientRegistered: boolean;
    shareUrl: string;
    toPhone: string;
  };
};

const INITIATE_ERROR_COPY: Record<string, string> = {
  not_owner: "این صفحه متعلق به شما نیست.",
  invalid_phone: "شماره موبایل معتبر نیست.",
  self_transfer: "نمی‌توانید صفحه را به شماره‌ی خودتان منتقل کنید.",
  already_pending:
    "برای این صفحه یک درخواست انتقال باز وجود دارد. اول آن را لغو کنید.",
};

export async function initiateTransferAction(
  _prev: InitiateTransferState,
  formData: FormData,
): Promise<InitiateTransferState> {
  const viewer = await requireUser();

  const pageId = String(formData.get("pageId") ?? "").trim();
  const toPhoneRaw = String(formData.get("toPhone") ?? "").trim();

  if (!pageId) {
    return { status: "error", message: "صفحه‌ای انتخاب نشده است." };
  }

  // Rate-limit per user: 5 initiations / hour. Cheap guard against someone
  // spamming transfer offers at many phone numbers.
  const rl = await checkRateLimit(`transfer:create:${viewer.user.id}`, 5, 3600);
  if (!rl.allowed) {
    return {
      status: "error",
      message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
    };
  }

  const result = await createTransfer({
    fromUserId: viewer.user.id,
    fromUserPhone: viewer.user.phone,
    pageId,
    toPhoneRaw,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: INITIATE_ERROR_COPY[result.reason] ?? "خطایی رخ داد.",
    };
  }

  revalidatePath("/account");
  return {
    status: "success",
    message: result.recipientRegistered
      ? "درخواست انتقال ارسال شد. کاربر در ورود بعدی آن را می‌بیند."
      : "لینک انتقال ساخته شد. آن را برای فرد مورد نظر بفرستید.",
    data: {
      recipientRegistered: result.recipientRegistered,
      shareUrl: result.shareUrl,
      toPhone: result.transfer.toPhone,
    },
  };
}

export type SimpleActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function cancelTransferAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const viewer = await requireUser();
  const transferId = String(formData.get("transferId") ?? "").trim();
  if (!transferId) return { status: "error", message: "درخواست نامعتبر است." };

  const result = await cancelTransfer({
    transferId,
    fromUserId: viewer.user.id,
  });
  if (!result.ok) {
    return { status: "error", message: "امکان لغو این درخواست نیست." };
  }
  revalidatePath("/account");
  return { status: "success", message: "درخواست انتقال لغو شد." };
}

const RECIPIENT_ERROR_COPY: Record<string, string> = {
  not_found: "این درخواست انتقال پیدا نشد.",
  not_pending: "این درخواست دیگر فعال نیست.",
  expired: "مهلت این درخواست به پایان رسیده است.",
  phone_mismatch: "این انتقال برای شماره‌ی دیگری است.",
  owner_conflict: "خطایی در انتقال مالکیت رخ داد.",
};

export async function acceptTransferAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const viewer = await requireUser();
  const transferId = String(formData.get("transferId") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  if (!transferId && !token) {
    return { status: "error", message: "درخواست نامعتبر است." };
  }

  const result = await acceptTransfer({
    transferId: transferId || undefined,
    token: token || undefined,
    viewerUserId: viewer.user.id,
    viewerPhone: viewer.user.phone,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: RECIPIENT_ERROR_COPY[result.reason] ?? "خطایی رخ داد.",
    };
  }

  // Ownership moved — refresh the whole authenticated shell so the new page
  // appears in the switcher / account list.
  revalidatePath("/", "layout");
  return { status: "success", message: "صفحه با موفقیت به شما منتقل شد." };
}

export async function rejectTransferAction(
  _prev: SimpleActionState,
  formData: FormData,
): Promise<SimpleActionState> {
  const viewer = await requireUser();
  const transferId = String(formData.get("transferId") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  if (!transferId && !token) {
    return { status: "error", message: "درخواست نامعتبر است." };
  }

  const result = await rejectTransfer({
    transferId: transferId || undefined,
    token: token || undefined,
    viewerUserId: viewer.user.id,
    viewerPhone: viewer.user.phone,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: RECIPIENT_ERROR_COPY[result.reason] ?? "خطایی رخ داد.",
    };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "درخواست انتقال رد شد." };
}
