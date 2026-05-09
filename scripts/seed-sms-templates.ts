/**
 * scripts/seed-sms-templates.ts
 *
 * Insert-only seeder for the Phase 10 SMS template registry.
 *
 * Run after each migration:
 *   pnpm db:seed:sms
 *
 * Behavior contract:
 *
 *   - If a `sms_templates` row for a given key does NOT exist, this
 *     script INSERTs it with `kavenegarTemplate = NULL`. Ops fills in
 *     the actual Kavenegar template name from `/admin/sms`. The worker
 *     refuses to send rows whose template is unmapped.
 *   - If the row already exists, this script LEAVES IT ALONE — even if
 *     the seed below disagrees with the database. Admin edits stick.
 *
 * Adding a new transactional SMS:
 *   1. Add the key to `SmsTemplateKey` in `src/lib/sms-queue.ts`.
 *   2. Add a row here.
 *   3. Re-run `pnpm db:seed:sms`.
 *   4. Map the Kavenegar template name in `/admin/sms`.
 */

import "dotenv/config";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";

type SmsTemplateSeed = {
  key: string;
  nameFa: string;
  descriptionFa: string;
  variableSchema: string[];
};

// Order = ordered token slots passed to Kavenegar's verify/lookup. Do
// not reorder existing entries — operators map to template token
// positions on their side. Append new variables at the end.
const TEMPLATES: SmsTemplateSeed[] = [
  {
    key: "welcome",
    nameFa: "خوش‌آمدگویی",
    descriptionFa: "اولین پیامک پس از ثبت‌نام.",
    variableSchema: ["name"],
  },
  {
    key: "trial_started",
    nameFa: "شروع آزمایش رایگان",
    descriptionFa: "تأیید شروع دوره آزمایشی Pro/Business.",
    variableSchema: ["plan", "days"],
  },
  {
    key: "trial_ending_soon",
    nameFa: "نزدیک شدن پایان دوره آزمایش",
    descriptionFa: "یادآور سه روز مانده به پایان دوره آزمایش.",
    variableSchema: ["plan", "daysLeft"],
  },
  {
    key: "trial_ended_invoice_due",
    nameFa: "پایان دوره آزمایش — فاکتور برای پرداخت",
    descriptionFa: "صدور فاکتور پایان آزمایش با مهلت ۲۴ ساعته.",
    variableSchema: ["plan", "invoice", "amount"],
  },
  {
    key: "invoice_generated",
    nameFa: "صدور فاکتور",
    descriptionFa: "اطلاع‌رسانی صدور یک فاکتور جدید.",
    variableSchema: ["invoice", "amount"],
  },
  {
    key: "renewal_reminder_5d",
    nameFa: "یادآور تمدید — ۵ روز مانده",
    descriptionFa: "یادآور تمدید اشتراک پنج روز مانده به پایان دوره.",
    variableSchema: ["plan", "daysLeft"],
  },
  {
    key: "renewal_reminder_1d",
    nameFa: "یادآور تمدید — ۱ روز مانده",
    descriptionFa: "یادآور تمدید اشتراک یک روز مانده به پایان دوره.",
    variableSchema: ["plan", "daysLeft"],
  },
  {
    key: "payment_received",
    nameFa: "تأیید پرداخت",
    descriptionFa: "تأیید موفقیت پرداخت زرین‌پال.",
    variableSchema: ["invoice", "plan", "ref"],
  },
  {
    key: "payment_failed",
    nameFa: "ناموفق بودن پرداخت",
    descriptionFa: "اطلاع از پرداخت ناموفق.",
    variableSchema: ["invoice"],
  },
  {
    key: "grace_period_started",
    nameFa: "ورود به دوره مهلت",
    descriptionFa: "اشتراک به دوره مهلت ۷ روزه وارد شد.",
    variableSchema: ["plan", "graceDays"],
  },
  {
    key: "subscription_expired",
    nameFa: "انقضای اشتراک",
    descriptionFa: "اشتراک منقضی شد و صفحه به پلن رایگان بازگشت.",
    variableSchema: ["plan"],
  },
  {
    key: "discount_applied",
    nameFa: "اعمال کد تخفیف",
    descriptionFa: "تأیید اعمال موفق کد تخفیف.",
    variableSchema: ["code", "amount"],
  },
  {
    key: "plan_changed",
    nameFa: "تغییر پلن",
    descriptionFa: "تأیید تغییر پلن اشتراک.",
    variableSchema: ["plan"],
  },
  {
    key: "price_change_notice",
    nameFa: "اطلاع تغییر قیمت",
    descriptionFa: "اطلاع‌رسانی به مشترک قبل از اعمال قیمت جدید در تجدید بعدی.",
    variableSchema: ["plan", "newAmount", "renewalDate"],
  },
  {
    key: "cancellation_confirmed",
    nameFa: "تأیید لغو",
    descriptionFa: "تأیید لغو اشتراک در پایان دوره فعلی.",
    variableSchema: ["plan"],
  },
  {
    key: "referral_referee_rewarded",
    nameFa: "هدیه‌ی پذیرش دعوت",
    descriptionFa:
      "به دعوت‌شده اطلاع می‌دهد که یک ماه پرو رایگان روی صفحه‌اش فعال شد.",
    variableSchema: ["months"],
  },
  {
    key: "referral_referrer_rewarded",
    nameFa: "تأیید دریافت اعتبار دعوت",
    descriptionFa:
      "به دعوت‌کننده اطلاع می‌دهد که یک ماه اعتبار پرو به حسابش اضافه شد.",
    variableSchema: ["refereeName", "balance"],
  },
  {
    key: "affiliate_application_received",
    nameFa: "ثبت درخواست همکاری در فروش",
    descriptionFa: "تأیید دریافت فرم درخواست همکاری در فروش به متقاضی.",
    variableSchema: ["name"],
  },
  {
    key: "affiliate_application_approved",
    nameFa: "تأیید همکاری در فروش",
    descriptionFa: "تأیید درخواست همکاری در فروش به همراه کد اختصاصی شریک.",
    variableSchema: ["name", "code", "pct"],
  },
  {
    key: "affiliate_application_rejected",
    nameFa: "عدم تأیید همکاری در فروش",
    descriptionFa: "اطلاع رد درخواست همکاری در فروش.",
    variableSchema: ["name"],
  },
  {
    key: "affiliate_application_needs_info",
    nameFa: "درخواست تکمیل اطلاعات همکاری",
    descriptionFa: "از متقاضی همکاری در فروش می‌خواهد اطلاعات تکمیلی بفرستد.",
    variableSchema: ["name"],
  },
  {
    key: "affiliate_referee_rewarded",
    nameFa: "هدیه پذیرش از طریق شریک",
    descriptionFa: "اطلاع به دعوت‌شده درباره سه ماه هدیه پرو با کد شریک.",
    variableSchema: ["months"],
  },
  {
    key: "affiliate_commission_earned",
    nameFa: "کمیسیون جدید همکاری",
    descriptionFa:
      "اطلاع به شریک درباره کمیسیون جدید پس از خرید سالانه دعوت‌شده.",
    variableSchema: ["refereeName", "commission"],
  },
  {
    key: "affiliate_payout_requested",
    nameFa: "ثبت درخواست تسویه همکاری",
    descriptionFa: "تأیید ثبت درخواست واریز کمیسیون.",
    variableSchema: ["amount"],
  },
  {
    key: "affiliate_payout_paid",
    nameFa: "واریز کمیسیون انجام شد",
    descriptionFa: "اطلاع پرداخت کمیسیون به همراه شماره پیگیری.",
    variableSchema: ["amount", "ref"],
  },
  {
    key: "affiliate_payout_rejected",
    nameFa: "رد درخواست تسویه",
    descriptionFa: "اطلاع به شریک درباره رد یا توقف درخواست واریز.",
    variableSchema: ["reason"],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set — cannot seed SMS templates.");
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  try {
    let inserted = 0;
    let skipped = 0;
    console.log("Seeding sms_templates (insert-only)…");
    for (const template of TEMPLATES) {
      const existing = await db.query.smsTemplates.findFirst({
        where: eq(schema.smsTemplates.key, template.key),
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await db.insert(schema.smsTemplates).values({
        key: template.key,
        nameFa: template.nameFa,
        descriptionFa: template.descriptionFa,
        variableSchema: template.variableSchema,
        kavenegarTemplate: null,
        isActive: true,
      });
      inserted += 1;
    }
    console.log(
      `  → +${inserted} inserted, ${skipped} skipped (already present).`,
    );
    console.log(
      "\nNext step: open /admin/sms and fill in `kavenegar_template` for each key.",
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
