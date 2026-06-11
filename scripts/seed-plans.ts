/**
 * scripts/seed-plans.ts
 *
 * Insert-only seeder for the Phase 2 plan + feature registry.
 *
 * Reads the matrix defined verbatim below — DO NOT improvise additional
 * features. The lookup keys are stable identifiers that product code will
 * reference forever (via lib/entitlements.ts in Phase 4); changing them is
 * a breaking change.
 *
 * Run after every migration:
 *   pnpm db:seed:plans
 *
 * Behavior contract (intentionally narrow so production admin edits are safe):
 *
 *   - If a plan / feature / plan_features mapping row does NOT exist, this
 *     script INSERTs it with the values from the matrix.
 *   - If the row already exists, this script LEAVES IT ALONE — even if the
 *     matrix below disagrees with the database. This means:
 *       · An admin can edit a plan price or a feature mapping in
 *         production via /admin (Phase 13) and a later seed run will not
 *         clobber it.
 *       · To roll out a price change or a matrix change to existing
 *         databases, do it through a one-off SQL migration or the admin
 *         panel, NOT by editing this file.
 *   - This script never DELETEs a plan, feature, or mapping. To remove a
 *     feature, do it via the admin matrix editor (Phase 13) or by hand.
 *
 * The first run on a fresh DB seeds 3 plans + 52 features + 101 mappings.
 * Subsequent runs are no-ops (zero inserts, zero updates, zero deletes).
 */

import "dotenv/config";

import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";

type PlanKey = "free" | "pro" | "business";

type PlanSeed = {
  key: PlanKey;
  nameFa: string;
  descriptionFa: string;
  priceMonthlyToman: number;
  priceAnnualToman: number;
  trialDays: number;
  displayOrder: number;
  isDefault: boolean;
};

const PLANS: PlanSeed[] = [
  {
    key: "free",
    nameFa: "رایگان",
    descriptionFa: "همه چیزی که برای شروع لازم داری.",
    priceMonthlyToman: 0,
    priceAnnualToman: 0,
    trialDays: 0,
    displayOrder: 1,
    isDefault: true,
  },
  {
    key: "pro",
    nameFa: "حرفه‌ای",
    descriptionFa: "ابزارهای کامل برای رشد مخاطبان و تحلیل داده.",
    priceMonthlyToman: 149_000,
    priceAnnualToman: 1_499_000,
    trialDays: 7,
    displayOrder: 2,
    isDefault: false,
  },
  {
    key: "business",
    nameFa: "کسب‌وکار",
    descriptionFa: "همه‌چیز در پلن حرفه‌ای، به‌علاوه ابزارهای ویژه کسب‌وکار.",
    priceMonthlyToman: 299_000,
    priceAnnualToman: 2_999_000,
    trialDays: 7,
    displayOrder: 3,
    isDefault: false,
  },
];

type FeatureCategory =
  | "core"
  | "branding"
  | "design"
  | "link_types"
  | "analytics"
  | "marketing"
  | "business_tools"
  | "support"
  | "limits";

type FeatureSeed = {
  key: string;
  nameFa: string;
  category: FeatureCategory;
  /**
   * Per-plan grant. `false` = not granted on that plan. `true` = boolean
   * grant. number = quantitative grant (stored in plan_features.limit_value).
   */
  free: boolean | number;
  pro: boolean | number;
  business: boolean | number;
};

// Matrix verbatim from the user prompt — see IMPLEMENTATION_PLAN.md §"Seed
// feature matrix". Order here defines the display order inside each category.
const FEATURES: FeatureSeed[] = [
  // ---- core
  {
    key: "unlimited_links",
    nameFa: "لینک‌های نامحدود",
    category: "core",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "kioar_username_url",
    nameFa: "آدرس kioar.com/username",
    category: "core",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "responsive_layout",
    nameFa: "نمایش واکنش‌گرا (موبایل و دسکتاپ)",
    category: "core",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "qr_code_basic",
    nameFa: "کیو‌آر‌کد ساده",
    category: "core",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "qr_code_customization",
    nameFa: "شخصی‌سازی کیو‌آر‌کد (رنگ و لوگو)",
    category: "core",
    free: false,
    pro: true,
    business: true,
  },

  // ---- branding
  {
    key: "remove_branding",
    nameFa: "حذف برندینگ کیوآر",
    category: "branding",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "favicon_upload",
    nameFa: "آپلود فاو‌آیکون",
    category: "branding",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "seo_meta",
    nameFa: "تنظیمات سئو (عنوان، توضیحات، تصویر OG)",
    category: "branding",
    free: false,
    pro: true,
    business: true,
  },

  // ---- design
  {
    key: "themes_limited",
    nameFa: "تم‌های پایه (محدود)",
    category: "design",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "themes_full_library",
    nameFa: "کتابخانه کامل تم‌ها",
    category: "design",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "custom_colors",
    nameFa: "رنگ‌های دلخواه",
    category: "design",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "custom_fonts",
    nameFa: "فونت‌های دلخواه",
    category: "design",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "background_media",
    nameFa: "پس‌زمینه تصویری یا ویدئویی",
    category: "design",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "link_animations",
    nameFa: "انیمیشن روی لینک‌ها",
    category: "design",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "featured_links",
    nameFa: "لینک‌های برجسته‌شده",
    category: "design",
    free: false,
    pro: true,
    business: true,
  },

  // ---- link_types
  {
    key: "link_url",
    nameFa: "لینک ساده",
    category: "link_types",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "link_video_embed",
    nameFa: "درج ویدئو (یوتیوب، آپارات، ویمئو)",
    category: "link_types",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "link_audio_embed",
    nameFa: "درج موسیقی و پادکست",
    category: "link_types",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "link_image_gallery",
    nameFa: "گالری تصاویر و کاروسل",
    category: "link_types",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "link_newsletter_signup",
    nameFa: "فرم عضویت در خبرنامه",
    category: "link_types",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "link_scheduled",
    nameFa: "لینک‌های زمان‌بندی‌شده (شروع و پایان)",
    category: "link_types",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "link_shop",
    nameFa: "لینک فروشگاه (به آدرس بیرونی)",
    category: "link_types",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "link_product",
    nameFa: "لینک محصول (به آدرس بیرونی)",
    category: "link_types",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "link_text_block",
    nameFa: "بلوک متن",
    category: "link_types",
    free: false,
    pro: true,
    business: true,
  },

  // ---- analytics
  {
    key: "analytics_basic",
    nameFa: "آمار پایه (بازدید و کلیک کل)",
    category: "analytics",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "analytics_history_7d",
    nameFa: "تاریخچه آمار ۷ روزه",
    category: "analytics",
    free: true,
    pro: false,
    business: false,
  },
  {
    key: "analytics_history_unlimited",
    nameFa: "تاریخچه نامحدود آمار",
    category: "analytics",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "analytics_geo",
    nameFa: "داده‌های جغرافیایی (کشور و شهر)",
    category: "analytics",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "analytics_device_referrer",
    nameFa: "تفکیک دستگاه و منبع ورود",
    category: "analytics",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "analytics_ctr_conversion",
    nameFa: "نرخ کلیک و تبدیل",
    category: "analytics",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "analytics_csv_export",
    nameFa: "خروجی CSV از آمار",
    category: "analytics",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "analytics_funnel_cohort",
    nameFa: "تحلیل قیف و کوهورت",
    category: "analytics",
    free: false,
    pro: false,
    business: true,
  },

  // ---- marketing
  {
    key: "utm_auto_tagging",
    nameFa: "افزودن خودکار UTM",
    category: "marketing",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "pixel_meta",
    nameFa: "پیکسل متا (فیسبوک/اینستاگرام)",
    category: "marketing",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "pixel_google_analytics",
    nameFa: "اتصال به گوگل آنالیتیکس",
    category: "marketing",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "pixel_tiktok",
    nameFa: "پیکسل تیک‌تاک",
    category: "marketing",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "email_integration",
    nameFa: "اتصال به ابزارهای ایمیل (مثل میل‌چیمپ)",
    category: "marketing",
    free: false,
    pro: true,
    business: true,
  },
  {
    key: "ab_testing",
    nameFa: "تست A/B روی لینک‌ها",
    category: "marketing",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "referral_program",
    nameFa: "برنامه دعوت دوستان",
    category: "marketing",
    free: true,
    pro: true,
    business: true,
  },

  // ---- business_tools
  {
    key: "business_contact_form",
    nameFa: "فرم تماس",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  // products_block: universal "محصول" block (menus / catalogs / services /
  // packages / portfolios). Granted on every plan; per-plan capacity is
  // enforced by `products_max_items_per_block` below.
  {
    key: "products_block",
    nameFa: "بلوک محصولات و خدمات",
    category: "business_tools",
    free: true,
    pro: true,
    business: true,
  },
  // media_block: universal "مدیا" block (photos / video / file) surfaced via
  // thin variant cards (gallery / video / resume / download / menu / portfolio).
  // Granted on every plan; the real differentiator is the storage quota
  // (`media_storage_mb` below), so this never locks.
  {
    key: "media_block",
    nameFa: "بلوک مدیا (عکس، ویدئو، فایل)",
    category: "business_tools",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "business_lead_capture_form",
    nameFa: "فرم جذب سرنخ (با فیلدهای دلخواه)",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "business_form_submissions_dashboard",
    nameFa: "داشبورد پاسخ‌های فرم",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "business_form_csv_export",
    nameFa: "خروجی CSV از پاسخ‌های فرم",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "business_bookings",
    nameFa: "رزرو نوبت و قرار ملاقات",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "business_booking_calendar_sync",
    nameFa: "همگام‌سازی با گوگل کلندر",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "business_business_hours",
    nameFa: "ساعات کاری و قواعد دسترس‌پذیری",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "business_booking_sms_confirmation",
    nameFa: "پیامک تأیید رزرو برای مشتری",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "business_events",
    nameFa: "رویدادها",
    category: "business_tools",
    free: false,
    pro: false,
    business: true,
  },

  // ---- support
  {
    key: "support_help_center",
    nameFa: "دسترسی به مرکز راهنما",
    category: "support",
    free: true,
    pro: true,
    business: true,
  },
  {
    key: "support_email_best_effort",
    nameFa: "پشتیبانی ایمیلی (در حد امکان)",
    category: "support",
    free: true,
    pro: false,
    business: false,
  },
  {
    key: "support_email_standard_48h",
    nameFa: "پشتیبانی ایمیلی استاندارد (تا ۴۸ ساعت)",
    category: "support",
    free: false,
    pro: true,
    business: false,
  },
  {
    key: "support_email_priority_24h",
    nameFa: "پشتیبانی اولویت‌دار (تا ۲۴ ساعت)",
    category: "support",
    free: false,
    pro: false,
    business: true,
  },

  // ---- limits
  // storage_image_uploads: granted on every plan, distinguished by limit_value
  // (MB). The other two limit rows are pure boolean grants on Business only.
  {
    key: "storage_image_uploads",
    nameFa: "فضای آپلود تصاویر",
    category: "limits",
    free: 50,
    pro: 5_000,
    business: 50_000,
  },
  {
    key: "form_submissions_unlimited",
    nameFa: "پاسخ‌های فرم نامحدود",
    category: "limits",
    free: false,
    pro: false,
    business: true,
  },
  {
    key: "booking_slots_unlimited",
    nameFa: "بازه‌های رزرو نامحدود",
    category: "limits",
    free: false,
    pro: false,
    business: true,
  },
  // Per-block items cap for the universal product block. Hard cap of 300
  // is enforced at the validator level regardless of plan.
  {
    key: "products_max_items_per_block",
    nameFa: "حداکثر تعداد مورد در هر بلوک محصول",
    category: "limits",
    free: 15,
    pro: 75,
    business: 300,
  },
  // ---- media limits
  // Total media storage quota per page (MB) — the real differentiator across
  // tiers. The per-file / per-gallery caps below are equal across tiers for
  // now; they live in the admin matrix so they can change without a deploy.
  {
    key: "media_storage_mb",
    nameFa: "فضای ذخیره‌سازی مدیا",
    category: "limits",
    free: 50,
    pro: 200,
    business: 500,
  },
  {
    key: "media_max_photo_mb",
    nameFa: "حداکثر حجم هر عکس",
    category: "limits",
    free: 10,
    pro: 10,
    business: 10,
  },
  {
    key: "media_max_video_mb",
    nameFa: "حداکثر حجم هر ویدئو",
    category: "limits",
    free: 100,
    pro: 100,
    business: 100,
  },
  {
    key: "media_max_file_mb",
    nameFa: "حداکثر حجم هر فایل",
    category: "limits",
    free: 20,
    pro: 20,
    business: 20,
  },
  {
    key: "media_max_gallery_count",
    nameFa: "حداکثر تعداد عکس در هر گالری",
    category: "limits",
    free: 20,
    pro: 20,
    business: 20,
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL not set — cannot seed plans.");
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  try {
    let plansInserted = 0;
    let plansSkipped = 0;
    console.log("Seeding plans (insert-only)…");
    for (const plan of PLANS) {
      const existing = await db.query.plans.findFirst({
        where: eq(schema.plans.key, plan.key),
      });
      if (existing) {
        plansSkipped += 1;
        continue;
      }
      await db.insert(schema.plans).values({
        key: plan.key,
        nameFa: plan.nameFa,
        descriptionFa: plan.descriptionFa,
        priceMonthlyToman: plan.priceMonthlyToman,
        priceAnnualToman: plan.priceAnnualToman,
        trialDays: plan.trialDays,
        displayOrder: plan.displayOrder,
        isActive: true,
        isDefault: plan.isDefault,
      });
      plansInserted += 1;
    }
    console.log(
      `  → +${plansInserted} inserted, ${plansSkipped} skipped (already present).`,
    );

    let featuresInserted = 0;
    let featuresSkipped = 0;
    console.log("Seeding features (insert-only)…");
    let order = 0;
    for (const feature of FEATURES) {
      order += 1;
      const existing = await db.query.features.findFirst({
        where: eq(schema.features.key, feature.key),
      });
      if (existing) {
        featuresSkipped += 1;
        continue;
      }
      await db.insert(schema.features).values({
        key: feature.key,
        nameFa: feature.nameFa,
        category: feature.category,
        displayOrder: order,
      });
      featuresInserted += 1;
    }
    console.log(
      `  → +${featuresInserted} inserted, ${featuresSkipped} skipped (already present).`,
    );

    console.log("Seeding plan ↔ feature mappings (insert-only)…");
    const allPlans = await db.select().from(schema.plans);
    const allFeatures = await db.select().from(schema.features);
    const planByKey = new Map(allPlans.map((p) => [p.key, p]));
    const featureByKey = new Map(allFeatures.map((f) => [f.key, f]));

    let mappingInserts = 0;
    let mappingSkipped = 0;

    for (const feature of FEATURES) {
      const featureRow = featureByKey.get(feature.key);
      if (!featureRow) continue;

      for (const planKey of ["free", "pro", "business"] as const) {
        const planRow = planByKey.get(planKey);
        if (!planRow) continue;

        const grant = feature[planKey];
        const isGranted = grant !== false;
        if (!isGranted) {
          // Insert-only: never delete an existing mapping just because the
          // matrix says the plan shouldn't grant it. Admins might have
          // added the grant on purpose.
          continue;
        }

        const limitValue = typeof grant === "number" ? grant : null;

        const existingMapping = await db.query.planFeatures.findFirst({
          where: and(
            eq(schema.planFeatures.planId, planRow.id),
            eq(schema.planFeatures.featureId, featureRow.id),
          ),
        });

        if (existingMapping) {
          mappingSkipped += 1;
          continue;
        }

        await db.insert(schema.planFeatures).values({
          planId: planRow.id,
          featureId: featureRow.id,
          limitValue,
        });
        mappingInserts += 1;
      }
    }

    console.log(
      `  → +${mappingInserts} inserted, ${mappingSkipped} skipped (already present).`,
    );

    console.log(
      "\nSummary by plan (counting ALL granted features, including admin-added):",
    );
    for (const plan of allPlans.sort(
      (a, b) => a.displayOrder - b.displayOrder,
    )) {
      const grants = await db
        .select({
          featureKey: schema.features.key,
          limitValue: schema.planFeatures.limitValue,
        })
        .from(schema.planFeatures)
        .innerJoin(
          schema.features,
          eq(schema.features.id, schema.planFeatures.featureId),
        )
        .where(eq(schema.planFeatures.planId, plan.id));
      const limitedCount = grants.filter((g) => g.limitValue !== null).length;
      console.log(
        `  ${plan.key.padEnd(9)} → ${grants.length} features (${limitedCount} with limit)`,
      );
    }
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
