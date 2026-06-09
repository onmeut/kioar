/**
 * App settings — typed key/value store for runtime billing knobs.
 *
 * Each key has a zod schema describing its `value` shape. Reads validate
 * the JSONB payload; writes do too. Keys live in code (this file is the
 * registry); adding one is: declare schema + default, run the seeder.
 *
 * Reads are uncached — callers that need hot-path values should cache at
 * their own layer. The cron handler reads once per run, so the extra
 * round-trip is negligible. Per-request page renders that need VAT etc.
 * already happen inside an existing TX; one extra SELECT is fine.
 *
 * Why JSONB rather than per-key columns: a 5-key billing config table
 * doesn't deserve a migration per knob. JSONB + zod gives us schema
 * safety at the read boundary without DDL churn.
 */

import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb, type Database } from "@/db";
import { appSettings } from "@/db/schema";

/**
 * Registry of all known settings. The TypeScript type of each entry's
 * value is inferred from its zod schema, so consumers get full
 * autocomplete on `getSetting("billing.grace_period_days")` etc.
 */
export const APP_SETTING_DEFINITIONS = {
  "billing.grace_period_days": {
    schema: z.number().int().min(0).max(60),
    fallback: 7,
    descriptionFa: "روزهای مهلت پس از پایان دوره — قبل از تنزل به پلن رایگان.",
  },
  "billing.reminder_offsets_days": {
    schema: z.array(z.number().int().min(0).max(60)).max(8),
    fallback: [5, 1] as number[],
    descriptionFa:
      "روزهای باقی‌مانده تا پایان دوره که پیامک یادآوری تجدید پرداخت می‌رود.",
  },
  "billing.trial_reminder_offset_days": {
    schema: z.number().int().min(0).max(60),
    fallback: 3,
    descriptionFa:
      "روزهای باقی‌مانده تا پایان آزمایشی که پیامک یادآوری می‌رود.",
  },
  "billing.vat_rate": {
    schema: z.number().min(0).max(0.5),
    fallback: 0,
    descriptionFa: "نرخ مالیات بر ارزش افزوده (به‌صورت کسر، مثلاً 0.09 = ۹٪).",
  },
  "billing.grandfathering_default_policy": {
    schema: z.enum(["always_current", "grandfather"]),
    fallback: "always_current" as "always_current" | "grandfather",
    descriptionFa:
      "وقتی قیمت پلن تغییر می‌کند، پیش‌فرض چه باشد: همه به قیمت جدید (always_current) یا قفل قیمت قدیم برای فعلی‌ها (grandfather).",
  },

  // ---- NFC/QR cards -------------------------------------------------------
  "cards.price_colorful_toman": {
    schema: z.number().int().min(0),
    fallback: 390_000,
    descriptionFa: "قیمت کارت رنگی (تومان).",
  },
  "cards.price_metal_toman": {
    schema: z.number().int().min(0),
    fallback: 1_290_000,
    descriptionFa: "قیمت کارت فلزی (تومان).",
  },
  // Which plan tier a PAID card purchase grants for one year.
  "cards.purchase_grants_plan": {
    schema: z.enum(["free", "pro", "business"]),
    fallback: "pro" as "free" | "pro" | "business",
    descriptionFa: "خرید کارت، یک سال کدام پلن را هدیه می‌دهد؟",
  },
  // Which card material each plan's yearly purchase grants as a free card.
  "cards.plan_grants_material": {
    schema: z.object({
      pro: z.enum(["colorful", "metal"]),
      business: z.enum(["colorful", "metal"]),
    }),
    fallback: { pro: "colorful", business: "metal" } as {
      pro: "colorful" | "metal";
      business: "colorful" | "metal";
    },
    descriptionFa: "هر پلن سالانه چه جنس کارتی هدیه می‌دهد (Pro/Business).",
  },
  // Available card colors shown in the studio (hex + Persian label per material).
  "cards.colors": {
    schema: z.object({
      colorful: z.array(z.object({ value: z.string(), label: z.string() })),
      metal: z.array(z.object({ value: z.string(), label: z.string() })),
    }),
    fallback: {
      colorful: [
        { value: "lime", label: "سبز" },
        { value: "orange", label: "نارنجی" },
        { value: "cyan", label: "آبی" },
        { value: "pink", label: "صورتی" },
      ],
      metal: [
        { value: "black", label: "مشکی" },
        { value: "silver", label: "نقره‌ای" },
        { value: "gold", label: "طلایی" },
      ],
    } as {
      colorful: Array<{ value: string; label: string }>;
      metal: Array<{ value: string; label: string }>;
    },
    descriptionFa: "رنگ‌های موجود برای هر جنس کارت.",
  },
  // Master on/off for each material's availability in the studio.
  "cards.material_enabled": {
    schema: z.object({
      colorful: z.boolean(),
      metal: z.boolean(),
    }),
    fallback: { colorful: true, metal: true } as {
      colorful: boolean;
      metal: boolean;
    },
    descriptionFa: "در دسترس بودن هر جنس کارت در فروشگاه.",
  },
  // Gift offers (plan→card and card→plan) master toggles.
  "cards.offer_plan_grants_card_enabled": {
    schema: z.boolean(),
    fallback: false, // offer disabled — was true when active
    descriptionFa: "فعال بودن هدیهٔ کارت رایگان هنگام خرید پلن سالانه.",
  },
  "cards.offer_card_grants_plan_enabled": {
    schema: z.boolean(),
    fallback: false, // offer disabled — was true when active
    descriptionFa: "فعال بودن هدیهٔ یک سال پلن هنگام خرید کارت.",
  },
  // Cross-promo copy (Farsi) shown on the plans page and in the card flow.
  "cards.copy_plan_includes_card": {
    schema: z.string().max(200),
    fallback: "شامل یک کارت فیزیکی رایگان.",
    descriptionFa: "متن تبلیغی نمایش‌داده‌شده در صفحهٔ پلن‌ها (شامل کارت رایگان).",
  },
  "cards.copy_card_includes_plan": {
    schema: z.string().max(200),
    fallback: "خرید این کارت شامل یک سال پلن رایگان است.",
    descriptionFa: "متن تبلیغی نمایش‌داده‌شده در فروشگاه کارت (شامل یک سال پلن).",
  },
  "cards.shipping_cost_toman": {
    schema: z.number().int().min(0),
    fallback: 0,
    descriptionFa: "هزینه ارسال کارت (تومان). صفر = رایگان.",
  },
} as const;

export type AppSettingKey = keyof typeof APP_SETTING_DEFINITIONS;
export type AppSettingValue<K extends AppSettingKey> = z.infer<
  (typeof APP_SETTING_DEFINITIONS)[K]["schema"]
>;

const KEYS = Object.keys(APP_SETTING_DEFINITIONS) as AppSettingKey[];

/**
 * Read a single setting. Returns the fallback if the row doesn't exist
 * or fails validation (logged via console.warn — the caller continues
 * with safe defaults rather than 500-ing).
 */
export async function getSetting<K extends AppSettingKey>(
  key: K,
  db: Database = getDb(),
): Promise<AppSettingValue<K>> {
  const def = APP_SETTING_DEFINITIONS[key];
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return def.fallback as AppSettingValue<K>;
  }
  const parsed = def.schema.safeParse(row.value);
  if (!parsed.success) {
    console.warn(
      `[app-settings] invalid value for ${key}; falling back. error=${parsed.error.message}`,
    );
    return def.fallback as AppSettingValue<K>;
  }
  return parsed.data as AppSettingValue<K>;
}

/**
 * Read every known setting at once. Used by the admin config page so
 * one round-trip pulls everything.
 */
export async function getAllSettings(
  db: Database = getDb(),
): Promise<{ [K in AppSettingKey]: AppSettingValue<K> }> {
  const rows = await db.select().from(appSettings);
  const byKey = new Map(rows.map((r) => [r.key, r.value] as const));
  const out = {} as { [K in AppSettingKey]: AppSettingValue<K> };
  for (const key of KEYS) {
    const def = APP_SETTING_DEFINITIONS[key];
    const raw = byKey.get(key);
    if (raw === undefined) {
      out[key] = def.fallback as never;
      continue;
    }
    const parsed = def.schema.safeParse(raw);
    out[key] = (parsed.success ? parsed.data : def.fallback) as never;
  }
  return out;
}

/**
 * Write a setting. Validates against the registered schema, upserts the
 * row, and stamps `updated_by_user_id` for audit. Caller is responsible
 * for adding a `recordAdminAudit` entry.
 */
export async function setSetting<K extends AppSettingKey>(
  key: K,
  value: AppSettingValue<K>,
  updatedByUserId: string,
  db: Database = getDb(),
): Promise<void> {
  const def = APP_SETTING_DEFINITIONS[key];
  const validated = def.schema.parse(value);
  await db
    .insert(appSettings)
    .values({
      key,
      value: validated as unknown as object,
      descriptionFa: def.descriptionFa,
      updatedByUserId,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: sql`excluded.value`,
        updatedByUserId: sql`excluded.updated_by_user_id`,
        updatedAt: sql`now()`,
      },
    });
}

export function getSettingDescription(key: AppSettingKey): string {
  return APP_SETTING_DEFINITIONS[key].descriptionFa;
}
