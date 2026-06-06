"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import { recordAdminAudit } from "@/lib/admin-audit";
import {
  advanceOrderStatus,
  adminDisableCard,
  assignCardToOrder,
  markNfcStep,
  type OrderStatus,
} from "@/lib/cards/fulfillment";
import { mintCardBatch } from "@/lib/cards/inventory";

export type AdminCardState = {
  status: "idle" | "error" | "ok";
  message?: string;
};

const ORDER_STATUSES: OrderStatus[] = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "fulfilled",
  "cancelled",
];

/** Generate a new batch of unassigned cards. */
export async function generateBatchAction(
  _prev: AdminCardState,
  formData: FormData,
): Promise<AdminCardState> {
  const viewer = await requireAdmin();

  const count = Number(formData.get("count"));
  const batch = String(formData.get("batch") ?? "").trim();
  const color = String(formData.get("color") ?? "black").trim() || "black";
  const material = String(formData.get("material") ?? "colorful");
  const source = String(formData.get("source") ?? "purchased");

  if (!Number.isInteger(count) || count <= 0 || count > 10000) {
    return { status: "error", message: "تعداد باید بین ۱ تا ۱۰۰۰۰ باشد." };
  }
  if (!batch) return { status: "error", message: "نام دسته الزامی است." };
  if (material !== "colorful" && material !== "metal") {
    return { status: "error", message: "جنس نامعتبر است." };
  }
  if (!["purchased", "gift_pro", "gift_business"].includes(source)) {
    return { status: "error", message: "منبع نامعتبر است." };
  }

  const ids = await mintCardBatch({
    count,
    batch,
    color,
    material: material as "colorful" | "metal",
    source: source as "purchased" | "gift_pro" | "gift_business",
  });

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "card.batch_generated",
    metadata: { batch, count: ids.length, material, source },
  });

  revalidatePath("/admin/cards/inventory");
  return {
    status: "ok",
    message: `${ids.length} کارت در دستهٔ ${batch} ساخته شد.`,
  };
}

/** Assign a physical card to an order (pre-binds for purchased orders). */
export async function assignCardAction(
  _prev: AdminCardState,
  formData: FormData,
): Promise<AdminCardState> {
  const viewer = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const cardId = String(formData.get("cardId") ?? "")
    .trim()
    .toUpperCase();

  if (!orderId || !cardId) {
    return { status: "error", message: "اطلاعات ناقص است." };
  }

  const result = await assignCardToOrder(orderId, cardId);
  if (!result.ok) {
    return { status: "error", message: assignErrorFa(result.error) };
  }

  await recordAdminAudit({
    actorUserId: viewer.user.id,
    action: "card.assigned_to_order",
    metadata: { orderId, cardId, preBound: result.preBound },
  });

  revalidatePath("/admin/cards");
  return {
    status: "ok",
    message: result.preBound
      ? "کارت تخصیص و به صفحه متصل شد."
      : "کارت تخصیص شد (کارت هدیه — کاربر خودش فعال می‌کند).",
  };
}

/** Advance an order's status. */
export async function advanceStatusAction(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!orderId || !ORDER_STATUSES.includes(status)) return;

  const ok = await advanceOrderStatus(orderId, status);
  if (ok) {
    await recordAdminAudit({
      actorUserId: viewer.user.id,
      action: "card.order_status_advanced",
      metadata: { orderId, status },
    });
    revalidatePath("/admin/cards");
  }
}

/** Mark an NFC checklist step (write/lock) done for a card. */
export async function markNfcStepAction(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  const step = String(formData.get("step") ?? "");
  if (!cardId || (step !== "written" && step !== "locked")) return;

  const ok = await markNfcStep(cardId, step);
  if (ok) {
    await recordAdminAudit({
      actorUserId: viewer.user.id,
      action: "card.nfc_step",
      metadata: { cardId, step },
    });
    revalidatePath("/admin/cards");
  }
}

/** Disable a card (lost/stolen/revoked). */
export async function disableCardAction(formData: FormData): Promise<void> {
  const viewer = await requireAdmin();
  const cardId = String(formData.get("cardId") ?? "");
  if (!cardId) return;

  const ok = await adminDisableCard(cardId);
  if (ok) {
    await recordAdminAudit({
      actorUserId: viewer.user.id,
      action: "card.disabled",
      metadata: { cardId },
    });
    revalidatePath("/admin/cards");
    revalidatePath("/admin/cards/inventory");
  }
}

function assignErrorFa(code: string): string {
  switch (code) {
    case "order_not_found":
      return "سفارش پیدا نشد.";
    case "order_already_assigned":
      return "این سفارش قبلاً کارت دارد.";
    case "order_not_paid":
      return "سفارش هنوز پرداخت نشده است.";
    case "card_not_found":
      return "کارتی با این شناسه یافت نشد.";
    case "card_unavailable":
      return "این کارت در دسترس نیست (تخصیص‌یافته یا غیرفعال).";
    default:
      return "تخصیص ناموفق بود.";
  }
}
