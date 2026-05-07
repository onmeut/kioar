/**
 * scripts/seed-app-settings.ts
 *
 * Insert-only seeder for the `app_settings` registry. Mirrors
 * `scripts/seed-plans.ts` semantics:
 *
 *   - If a key does NOT exist → INSERT with the registry default.
 *   - If a key already exists → LEAVE IT ALONE (admin edits stick).
 *   - Never DELETE.
 *
 * To roll out a default change to existing databases, do it through the
 * admin UI or a one-off SQL migration — not by editing the registry
 * defaults in `src/lib/app-settings.ts`.
 *
 * VAT rate seed honors `BILLING_VAT_RATE` env if set, else 0.
 */

import "dotenv/config";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  APP_SETTING_DEFINITIONS,
  type AppSettingKey,
} from "../src/lib/app-settings";
import * as schema from "../src/db/schema";

function getInitialValue(key: AppSettingKey): unknown {
  if (key === "billing.vat_rate") {
    const raw = process.env.BILLING_VAT_RATE?.trim();
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 0.5) return n;
    }
    return APP_SETTING_DEFINITIONS[key].fallback;
  }
  return APP_SETTING_DEFINITIONS[key].fallback;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const client = postgres(url, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    let inserted = 0;
    let skipped = 0;

    for (const key of Object.keys(APP_SETTING_DEFINITIONS) as AppSettingKey[]) {
      const def = APP_SETTING_DEFINITIONS[key];
      const existing = await db.query.appSettings.findFirst({
        where: eq(schema.appSettings.key, key),
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const value = getInitialValue(key);
      const validated = def.schema.parse(value);
      await db.insert(schema.appSettings).values({
        key,
        value: validated as unknown as object,
        descriptionFa: def.descriptionFa,
      });
      inserted += 1;
      console.log(`  + ${key} = ${JSON.stringify(validated)}`);
    }

    console.log(
      `\nDone. inserted=${inserted}, skipped=${skipped} (already present).`,
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
