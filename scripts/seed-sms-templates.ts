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
  bodyFaPreview?: string;
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
    bodyFaPreview: "سلام %token عزیز! به کیوآر خیلی خوش اومدی 🚀",
  },
  {
    key: "trial_started",
    nameFa: "شروع آزمایش رایگان",
    descriptionFa: "تأیید شروع دوره آزمایشی Pro/Business.",
    variableSchema: ["days", "plan"],
    bodyFaPreview: "کیوآر: دوره آزمایشی %token2 برات فعال شد! %token روز وقت داری همه چیز رو امتحان کنی. بعدش اگه خواستی ادامه بدی فاکتور صادر می‌شه.",
  },
  {
    key: "trial_ending_soon",
    nameFa: "نزدیک شدن پایان دوره آزمایش",
    descriptionFa: "یادآور سه روز مانده به پایان دوره آزمایش.",
    variableSchema: ["plan", "daysLeft"],
    bodyFaPreview: "کیوآر: %token2 روز دیگه دوره آزمایشی %token تموم می‌شه. اگه می‌خوای ادامه بدی از داشبوردت اشتراک بگیر.",
  },
  {
    key: "trial_ended_invoice_due",
    nameFa: "پایان دوره آزمایش — فاکتور برای پرداخت",
    descriptionFa: "صدور فاکتور پایان آزمایش با مهلت ۲۴ ساعته.",
    variableSchema: ["plan", "invoice", "amount"],
    bodyFaPreview: "کیوآر: دوره آزمایشی %token تموم شد. فاکتور %token2 به مبلغ %token3 تومان صادر شد — ۲۴ ساعت مهلت داری پرداخت کنی وگرنه صفحه‌ات به رایگان برمی‌گرده.",
  },
  {
    key: "invoice_generated",
    nameFa: "صدور فاکتور",
    descriptionFa: "اطلاع‌رسانی صدور یک فاکتور جدید.",
    variableSchema: ["invoice", "amount"],
    bodyFaPreview: "کیوآر: فاکتور %token به مبلغ %token2 تومان صادر شد. از داشبوردت می‌تونی پرداخت کنی.",
  },
  {
    key: "renewal_reminder_5d",
    nameFa: "یادآور تمدید — ۵ روز مانده",
    descriptionFa: "یادآور تمدید اشتراک پنج روز مانده به پایان دوره.",
    variableSchema: ["plan", "daysLeft"],
    bodyFaPreview: "کیوآر: %token2 روز دیگه اشتراک %token تموم می‌شه. از داشبوردت تمدید کن تا صفحه‌ات بی‌وقفه کار کنه.",
  },
  {
    key: "renewal_reminder_1d",
    nameFa: "یادآور تمدید — ۱ روز مانده",
    descriptionFa: "یادآور تمدید اشتراک یک روز مانده به پایان دوره.",
    variableSchema: ["plan", "daysLeft"],
    bodyFaPreview: "کیوآر: فردا اشتراک %token منقضی می‌شه! همین الان تمدید کن تا چیزی از دست ندی.",
  },
  {
    key: "payment_received",
    nameFa: "تأیید پرداخت",
    descriptionFa: "تأیید موفقیت پرداخت زرین‌پال.",
    variableSchema: ["invoice", "plan", "ref"],
    bodyFaPreview: "کیوآر: پرداخت فاکتور %token برای پلن %token2 موفق بود. کد پیگیری: %token3. ممنون!",
  },
  {
    key: "payment_failed",
    nameFa: "ناموفق بودن پرداخت",
    descriptionFa: "اطلاع از پرداخت ناموفق.",
    variableSchema: ["invoice"],
    bodyFaPreview: "کیوآر: پرداخت فاکتور %token ناموفق بود. از داشبوردت دوباره امتحان کن.",
  },
  {
    key: "grace_period_started",
    nameFa: "ورود به دوره مهلت",
    descriptionFa: "اشتراک به دوره مهلت ۷ روزه وارد شد.",
    variableSchema: ["plan", "graceDays"],
    bodyFaPreview: "کیوآر: اشتراک %token منقضی شد ولی %token2 روز مهلت داری که پرداخت کنی. بعد از این مدت صفحه‌ات به رایگان برمی‌گرده.",
  },
  {
    key: "subscription_expired",
    nameFa: "انقضای اشتراک",
    descriptionFa: "اشتراک منقضی شد و صفحه به پلن رایگان بازگشت.",
    variableSchema: ["plan"],
    bodyFaPreview: "کیوآر: اشتراک %token منقضی شد و صفحه‌ات به پلن رایگان برگشت. هر وقت خواستی از داشبوردت دوباره فعال کن.",
  },
  {
    key: "discount_applied",
    nameFa: "اعمال کد تخفیف",
    descriptionFa: "تأیید اعمال موفق کد تخفیف.",
    variableSchema: ["code", "amount"],
    bodyFaPreview: "کیوآر: کد تخفیف %token اعمال شد و %token2 تومان از فاکتورت کم شد.",
  },
  {
    key: "plan_changed",
    nameFa: "تغییر پلن",
    descriptionFa: "تأیید تغییر پلن اشتراک.",
    variableSchema: ["plan"],
    bodyFaPreview: "کیوآر: پلنت به %token تغییر کرد. تغییرات همین الان روی صفحه‌ات اعمال شدن.",
  },
  {
    key: "price_change_notice",
    nameFa: "اطلاع تغییر قیمت",
    descriptionFa: "اطلاع‌رسانی به مشترک قبل از اعمال قیمت جدید در تجدید بعدی.",
    variableSchema: ["plan", "newAmount", "renewalDate"],
    bodyFaPreview: "کیوآر: قیمت پلن %token از تاریخ %token3 به %token2 تومان تغییر می‌کنه. تا اون موقع هیچ تغییری نیست.",
  },
  {
    key: "cancellation_confirmed",
    nameFa: "تأیید لغو",
    descriptionFa: "تأیید لغو اشتراک در پایان دوره فعلی.",
    variableSchema: ["plan"],
    bodyFaPreview: "کیوآر: لغو اشتراک %token تأیید شد. تا پایان دوره فعلی همه امکانات در دسترسته، بعدش به رایگان برمی‌گردی.",
  },
  {
    key: "referral_referee_rewarded",
    nameFa: "هدیه‌ی پذیرش دعوت",
    descriptionFa:
      "به دعوت‌شده اطلاع می‌دهد که یک ماه پرو رایگان روی صفحه‌اش فعال شد.",
    variableSchema: ["months"],
    bodyFaPreview: "کیوآر: یه دوست دعوتت کرده و %token ماه پرو رایگان برات فعال شد! از داشبوردت ببین.",
  },
  {
    key: "referral_referrer_rewarded",
    nameFa: "تأیید دریافت اعتبار دعوت",
    descriptionFa:
      "به دعوت‌کننده اطلاع می‌دهد که یک ماه اعتبار پرو به حسابش اضافه شد.",
    variableSchema: ["refereeName", "balance"],
    bodyFaPreview: "کیوآر: %token اشتراک گرفت و موجودی دعوت‌نامه‌ات به %token2 ماه رسید. ممنون که کیوآر رو معرفی کردی!",
  },
  {
    key: "affiliate_application_received",
    nameFa: "ثبت درخواست همکاری در فروش",
    descriptionFa: "تأیید دریافت فرم درخواست همکاری در فروش به متقاضی.",
    variableSchema: ["name"],
    bodyFaPreview: "کیوآر: %token عزیز، درخواست همکاری در فروشت دریافت شد. تیم ما بررسی می‌کنه و بهت خبر می‌دیم.",
  },
  {
    key: "affiliate_application_approved",
    nameFa: "تأیید همکاری در فروش",
    descriptionFa: "تأیید درخواست همکاری در فروش به همراه کد اختصاصی شریک.",
    variableSchema: ["name", "code", "pct"],
    bodyFaPreview: "کیوآر: %token عزیز، درخواستت تأیید شد! کد اختصاصیت %token2 هست و %token3 درصد کمیسیون می‌گیری. موفق باشی!",
  },
  {
    key: "affiliate_application_rejected",
    nameFa: "عدم تأیید همکاری در فروش",
    descriptionFa: "اطلاع رد درخواست همکاری در فروش.",
    variableSchema: ["name"],
    bodyFaPreview: "کیوآر: %token عزیز، متأسفانه درخواست همکاری در فروشت این بار تأیید نشد. ممنون که وقت گذاشتی.",
  },
  {
    key: "affiliate_application_needs_info",
    nameFa: "درخواست تکمیل اطلاعات همکاری",
    descriptionFa: "از متقاضی همکاری در فروش می‌خواهد اطلاعات تکمیلی بفرستد.",
    variableSchema: ["name"],
    bodyFaPreview: "کیوآر: %token عزیز، برای بررسی درخواست همکاریت به اطلاعات بیشتری نیاز داریم. لطفاً با ما در تماس باش.",
  },
  {
    key: "affiliate_referee_rewarded",
    nameFa: "هدیه پذیرش از طریق شریک",
    descriptionFa: "اطلاع به دعوت‌شده درباره سه ماه هدیه پرو با کد شریک.",
    variableSchema: ["months"],
    bodyFaPreview: "کیوآر: با کد شریک ما ثبت‌نام کردی و %token ماه پرو رایگان برات فعال شد! از داشبوردت ببین.",
  },
  {
    key: "affiliate_commission_earned",
    nameFa: "کمیسیون جدید همکاری",
    descriptionFa:
      "اطلاع به شریک درباره کمیسیون جدید پس از خرید سالانه دعوت‌شده.",
    variableSchema: ["refereeName", "commission"],
    bodyFaPreview: "کیوآر: %token اشتراک سالانه گرفت و %token2 تومان کمیسیون به حسابت اضافه شد. آفرین!",
  },
  {
    key: "affiliate_payout_requested",
    nameFa: "ثبت درخواست تسویه همکاری",
    descriptionFa: "تأیید ثبت درخواست واریز کمیسیون.",
    variableSchema: ["amount"],
    bodyFaPreview: "کیوآر: درخواست تسویه %token تومان ثبت شد. معمولاً ظرف چند روز کاری واریز می‌کنیم.",
  },
  {
    key: "affiliate_payout_paid",
    nameFa: "واریز کمیسیون انجام شد",
    descriptionFa: "اطلاع پرداخت کمیسیون به همراه شماره پیگیری.",
    variableSchema: ["amount", "ref"],
    bodyFaPreview: "کیوآر: %token تومان کمیسیونت واریز شد. شماره پیگیری: %token2. ممنون از همکاریت!",
  },
  {
    key: "affiliate_payout_rejected",
    nameFa: "رد درخواست تسویه",
    descriptionFa: "اطلاع به شریک درباره رد یا توقف درخواست واریز.",
    variableSchema: ["reason"],
    bodyFaPreview: "کیوآر: درخواست تسویه‌ات این بار انجام نشد. دلیل: %token. برای پیگیری با پشتیبانی در تماس باش.",
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
    let updated = 0;
    let skipped = 0;
    console.log("Seeding sms_templates…");
    for (const template of TEMPLATES) {
      const existing = await db.query.smsTemplates.findFirst({
        where: eq(schema.smsTemplates.key, template.key),
      });
      if (existing) {
        if (template.bodyFaPreview && existing.bodyFaPreview !== template.bodyFaPreview) {
          await db.update(schema.smsTemplates).set({
            bodyFaPreview: template.bodyFaPreview,
          }).where(eq(schema.smsTemplates.key, template.key));
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }
      await db.insert(schema.smsTemplates).values({
        key: template.key,
        nameFa: template.nameFa,
        descriptionFa: template.descriptionFa,
        variableSchema: template.variableSchema,
        bodyFaPreview: template.bodyFaPreview,
        kavenegarTemplate: null,
        isActive: true,
      });
      inserted += 1;
    }
    console.log(
      `  → +${inserted} inserted, ${updated} updated, ${skipped} skipped (already present).`,
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
