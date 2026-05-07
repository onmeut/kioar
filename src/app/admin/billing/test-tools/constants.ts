import type { SmsTemplateKey } from "@/lib/sms-queue";

/**
 * Subset of SMS templates the admin test tool can fire ad-hoc. Excludes
 * referral/affiliate templates because those carry user-state side
 * effects we don't want to fake.
 */
export const TEST_TOOLS_SMS_TEMPLATE_KEYS: readonly SmsTemplateKey[] = [
  "welcome",
  "trial_started",
  "trial_ending_soon",
  "trial_ended_invoice_due",
  "invoice_generated",
  "renewal_reminder_5d",
  "renewal_reminder_1d",
  "payment_received",
  "payment_failed",
  "grace_period_started",
  "subscription_expired",
  "discount_applied",
  "plan_changed",
  "price_change_notice",
  "cancellation_confirmed",
] as const;
