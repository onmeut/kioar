#!/usr/bin/env node
/**
 * audit-migrations.cjs — READ-ONLY production migration audit.
 *
 * Why this exists: the drizzle journal carried non-monotonic `when` timestamps,
 * so `migrate()` (which only applies entries whose `when` exceeds the max
 * `created_at` already in drizzle.__drizzle_migrations) silently SKIPPED
 * migrations 0049–0060. Dev was repaired by bumping those `when` values above
 * the cutoff. This script checks whether PRODUCTION is missing the same DDL.
 *
 * It performs ZERO writes. It only reads information_schema, pg_indexes, and
 * drizzle.__drizzle_migrations.
 *
 * Run it from INSIDE the cluster (where DATABASE_URL resolves), e.g.:
 *   kubectl exec -it <app-pod> -- node scripts/audit-migrations.cjs
 * or via the PaaS shell on the running app container.
 */

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run this inside the app container.");
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- standalone CommonJS ops script, not bundled
const postgres = require("postgres");

// One probe per migration 0049–0060: a cheap existence check that proves the
// migration's DDL actually ran. Each probe is a {sql, label} that returns >=1
// row when the object exists.
const PROBES = [
  {
    tag: "0049_fix_show_public_contact",
    what: "profiles.show_public_phone column",
    sql: (s) =>
      s`select 1 from information_schema.columns where table_name='profiles' and column_name='show_public_phone'`,
  },
  {
    tag: "0050_fix_trial_started_variable_schema",
    what: "sms_templates data fix (no schema — verify by hand)",
    soft: true, // pure UPDATE of a template's variable_schema; no DDL to probe
    sql: (s) =>
      s`select 1 from sms_templates where key='trial_started' and variable_schema='["days","plan"]'::jsonb`,
  },
  {
    tag: "0051_profile_appearance",
    what: "profiles.appearance jsonb column",
    sql: (s) =>
      s`select 1 from information_schema.columns where table_name='profiles' and column_name='appearance'`,
  },
  {
    tag: "0052_page_connections",
    what: "page_connections table",
    sql: (s) =>
      s`select 1 from information_schema.tables where table_name='page_connections'`,
  },
  {
    tag: "0053_nfc_cards",
    what: "cards + card_orders tables",
    sql: (s) =>
      s`select 1 from information_schema.tables where table_name in ('cards','card_orders') having count(*)=2`,
  },
  {
    tag: "0054_drop_card_requests",
    what: "card_requests table DROPPED (absence = pass)",
    invert: true, // pass when row is ABSENT
    sql: (s) =>
      s`select 1 from information_schema.tables where table_name='card_requests'`,
  },
  {
    tag: "0055_events_rebuild",
    what: "events + event_questions tables",
    sql: (s) =>
      s`select 1 from information_schema.tables where table_name in ('events','event_questions') having count(*)=2`,
  },
  {
    tag: "0056_backfill_business_events_entitlement",
    what: "business_events feature row",
    soft: true, // data backfill — absence is a warning, not a hard fail
    sql: (s) =>
      s`select 1 from features where key='business_events'`,
  },
  {
    tag: "0057_event_payment_instructions",
    what: "events.payment_instructions column",
    sql: (s) =>
      s`select 1 from information_schema.columns where table_name='events' and column_name='payment_instructions'`,
  },
  {
    tag: "0058_seed_business_events_feature",
    what: "business_events plan_features mapping",
    soft: true,
    sql: (s) =>
      s`select 1 from plan_features pf join features f on f.id=pf.feature_id where f.key='business_events' limit 1`,
  },
  {
    tag: "0059_profile_settings",
    what: "profiles.settings column",
    sql: (s) =>
      s`select 1 from information_schema.columns where table_name='profiles' and column_name='settings'`,
  },
  {
    tag: "0060_block_slugs_and_featured",
    what: "product/booking slug + product_items.is_featured",
    sql: (s) =>
      s`select 1 from information_schema.columns where (table_name='profile_product_blocks' and column_name='slug') or (table_name='profile_booking_blocks' and column_name='slug') or (table_name='product_items' and column_name='is_featured') having count(*)=3`,
  },
];

(async () => {
  const sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  let hardFails = 0;
  let softFails = 0;
  try {
    const host = DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
    console.log("Target:", host);

    const applied = await sql`select count(*)::int n, max(created_at) mx from drizzle.__drizzle_migrations`;
    console.log(
      `drizzle.__drizzle_migrations: ${applied[0].n} rows, max created_at=${applied[0].mx}`,
    );
    console.log("Journal cutoff note: entries with when <= max(created_at) are skipped by migrate().\n");
    console.log("MIGRATION                                    | OBJECT                                  | STATUS");
    console.log("---------------------------------------------+-----------------------------------------+--------");

    for (const p of PROBES) {
      let present;
      try {
        const r = await p.sql(sql);
        present = r.length > 0;
      } catch {
        // A probe referencing a table that doesn't exist throws — treat as missing.
        present = false;
      }
      const pass = p.invert ? !present : present;
      let status;
      if (pass) status = "PASS";
      else if (p.soft) {
        status = "WARN (data backfill missing)";
        softFails++;
      } else {
        status = "*** MISSING ***";
        hardFails++;
      }
      console.log(
        p.tag.padEnd(44),
        "|",
        p.what.slice(0, 39).padEnd(39),
        "|",
        status,
      );
    }

    console.log("\n----------------------------------------------------------------------");
    if (hardFails === 0 && softFails === 0) {
      console.log("RESULT: ✅ All migrations 0049–0060 are present in production.");
    } else {
      console.log(
        `RESULT: ${hardFails} hard MISSING, ${softFails} soft WARN.`,
      );
      if (hardFails > 0) {
        console.log(
          "ACTION: production is missing schema. The journal `when` fix (already in the\n" +
            "        repo) will let the next deploy apply them via scripts/migrate.ts.\n" +
            "        Verify the deploy logs show these tags applying, then re-run this audit.",
        );
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  process.exit(hardFails > 0 ? 2 : 0);
})().catch((e) => {
  console.error("Audit failed:", e.message);
  process.exit(1);
});
