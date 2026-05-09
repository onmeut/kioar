/**
 * Phase 13 — Admin audit log helper.
 *
 * Every manual admin action that mutates billing/entitlement state must
 * call `recordAdminAudit()` inside the same transaction (or immediately
 * after a successful mutation when no transaction is in play). The
 * `action` keys here form the canonical taxonomy — when adding a new
 * admin surface, extend the union below first so call-sites get
 * compile-time discoverability.
 *
 * Cron-driven transitions are NOT logged here — they live in
 * `billing_transitions_log` keyed by (pageId, transitionType, keyDate).
 * Mixing the two would conflate idempotency claims with audit trail.
 */

import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { adminAuditLog } from "@/db/schema";

export type AdminAuditAction =
  | "entitlement.grant"
  | "entitlement.revoke"
  | "subscription.extend_period"
  | "subscription.manual_plan_change"
  | "subscription.manual_status_change"
  | "subscription.force_expire"
  | "subscription.price_lock_set"
  | "subscription.price_lock_remove"
  | "subscription.price_lock_dropped_on_plan_change"
  | "subscription.apply_discount_to_next_renewal"
  | "subscription.simulate_renewal_dry_run"
  | "subscription.fire_sms_now"
  | "subscription.mock_zarinpal_verify"
  | "invoice.mark_paid"
  | "invoice.cancel"
  | "plan_feature.toggle"
  | "plan_feature.update_limit"
  | "plan_feature.rebuild_all_pages"
  | "plan_feature.rebuild_future_only"
  | "plan_settings.price_change_with_grandfather"
  | "plan_settings.price_change_without_grandfather"
  | "discount_code.batch_create"
  | "discount_code.batch_deactivate"
  | "discount_code.soft_delete"
  | "sms_template.body_preview_update"
  | "sms_template.kavenegar_synced"
  | "app_settings.update"
  | "affiliate.application.approve"
  | "affiliate.application.reject"
  | "affiliate.application.needs_info"
  | "affiliate.status.change"
  | "affiliate.payout.processing"
  | "affiliate.payout.paid"
  | "affiliate.payout.reject"
  | "affiliate.banking.update"
  | "affiliate.commission.suppressed_paused"
  | "affiliate.commission.adjust"
  | "affiliate.settings.update";

type Executor = {
  insert: ReturnType<typeof getDb>["insert"];
};

export type RecordAuditInput = {
  actorUserId: string;
  action: AdminAuditAction;
  targetUserId?: string | null;
  targetPageId?: string | null;
  targetInvoiceId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Insert one audit row. Pass a transaction executor (`tx`) if one is
 * active — the row commits with the rest of the unit-of-work and won't
 * leak partial audit on rollback. If no executor is given we use the
 * default client; callers MUST be sure the mutation already committed.
 */
export async function recordAdminAudit(
  input: RecordAuditInput,
  executor?: Executor,
): Promise<void> {
  const db = executor ?? getDb();
  await db.insert(adminAuditLog).values({
    actorUserId: input.actorUserId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    targetPageId: input.targetPageId ?? null,
    targetInvoiceId: input.targetInvoiceId ?? null,
    reason: input.reason?.trim() || null,
    metadata: (input.metadata ?? {}) as Record<string, unknown>,
  });
}

/**
 * Load recent audit rows for a page (newest first). Used by the per-page
 * drill-down to render a manual-actions history. Cron transitions are
 * NOT included — query `billing_transitions_log` separately for those.
 */
export async function getAuditLogForPage(
  pageId: string,
  limit = 50,
): Promise<
  Array<{
    id: string;
    action: string;
    actorUserId: string;
    actorPhone: string | null;
    reason: string | null;
    metadata: Record<string, unknown>;
    targetInvoiceId: string | null;
    createdAt: Date;
  }>
> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT
      a."id"               AS id,
      a."action"           AS action,
      a."actor_user_id"    AS actor_user_id,
      u."phone"            AS actor_phone,
      a."reason"           AS reason,
      a."metadata"         AS metadata,
      a."target_invoice_id" AS target_invoice_id,
      a."created_at"       AS created_at
    FROM "admin_audit_log" a
    LEFT JOIN "users" u ON u."id" = a."actor_user_id"
    WHERE a."target_page_id" = ${pageId}::uuid
    ORDER BY a."created_at" DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string;
    action: string;
    actor_user_id: string;
    actor_phone: string | null;
    reason: string | null;
    metadata: Record<string, unknown>;
    target_invoice_id: string | null;
    created_at: Date;
  }>;

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorUserId: r.actor_user_id,
    actorPhone: r.actor_phone,
    reason: r.reason,
    metadata: r.metadata ?? {},
    targetInvoiceId: r.target_invoice_id,
    createdAt: r.created_at,
  }));
}

/** Persian labels for actions, used by audit history UI. */
export const ADMIN_AUDIT_ACTION_LABELS: Record<AdminAuditAction, string> = {
  "entitlement.grant": "اعطای قابلیت",
  "entitlement.revoke": "لغو قابلیت",
  "subscription.extend_period": "تمدید دستی دوره",
  "subscription.manual_plan_change": "تغییر دستی پلن",
  "subscription.manual_status_change": "تغییر دستی وضعیت اشتراک",
  "subscription.force_expire": "انقضای اجباری اشتراک",
  "subscription.price_lock_set": "قفل قیمت اشتراک",
  "subscription.price_lock_remove": "حذف قفل قیمت اشتراک",
  "subscription.price_lock_dropped_on_plan_change":
    "حذف قفل قیمت در پی تغییر پلن",
  "subscription.apply_discount_to_next_renewal": "اعمال کد تخفیف بر تجدید بعدی",
  "subscription.simulate_renewal_dry_run": "شبیه‌سازی تجدید (آزمایشی)",
  "subscription.fire_sms_now": "ارسال فوری پیامک",
  "subscription.mock_zarinpal_verify": "تأیید آزمایشی پرداخت زرین‌پال",
  "invoice.mark_paid": "ثبت دستی پرداخت فاکتور",
  "invoice.cancel": "لغو دستی فاکتور",
  "plan_feature.toggle": "تغییر فعال‌بودن قابلیت در پلن",
  "plan_feature.update_limit": "ویرایش سقف قابلیت",
  "plan_feature.rebuild_all_pages": "بازسازی قابلیت‌ها برای همه صفحات",
  "plan_feature.rebuild_future_only":
    "اعمال ماتریس فقط برای اشتراک‌های جدید/تمدیدها",
  "plan_settings.price_change_with_grandfather":
    "تغییر قیمت پلن با حفظ قیمت قدیم برای فعلی‌ها",
  "plan_settings.price_change_without_grandfather":
    "تغییر قیمت پلن (همه به قیمت جدید)",
  "discount_code.batch_create": "ساخت گروهی کدهای تخفیف",
  "discount_code.batch_deactivate": "غیرفعال‌سازی گروهی کدهای تخفیف",
  "discount_code.soft_delete": "حذف نرم کد تخفیف",
  "sms_template.body_preview_update": "بروزرسانی پیش‌نمایش متن پیامک",
  "sms_template.kavenegar_synced": "تأیید همگام‌سازی با کاوه‌نگار",
  "app_settings.update": "بروزرسانی تنظیمات سامانه",
  "affiliate.application.approve": "تأیید درخواست همکاری",
  "affiliate.application.reject": "رد درخواست همکاری",
  "affiliate.application.needs_info": "درخواست تکمیل اطلاعات همکاری",
  "affiliate.status.change": "تغییر وضعیت شریک فروش",
  "affiliate.payout.processing": "شروع پردازش تسویه",
  "affiliate.payout.paid": "ثبت پرداخت تسویه",
  "affiliate.payout.reject": "رد درخواست تسویه",
  "affiliate.banking.update": "بروزرسانی اطلاعات بانکی شریک",
  "affiliate.commission.suppressed_paused": "تعلیق کمیسیون به‌علت توقف شریک",
  "affiliate.commission.adjust": "تنظیم دستی کمیسیون",
  "affiliate.settings.update": "بروزرسانی تنظیمات همکاری در فروش",
};
