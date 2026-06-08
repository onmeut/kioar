#!/usr/bin/env node
"use strict";

/**
 * Production server entry-point wrapper.
 *
 * This file REPLACES the Next.js standalone `server.js` in the Docker image.
 * The real Next.js server is renamed to `_server.js` during build.
 *
 * Flow:
 *   1. Run raw ALTER TABLE directly (no migration framework)
 *   2. Verify the column actually exists
 *   3. Run Drizzle migrations for everything else
 *   4. Load the real Next.js server
 *
 * Why: Hamravesh/Darkube PaaS overrides Dockerfile ENTRYPOINT/CMD and runs
 * `node server.js` directly.
 */

const { execSync } = require("node:child_process");
const path = require("node:path");

const cwd = path.resolve(__dirname);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ [server-wrapper] DATABASE_URL is not set!");
  process.exit(1);
}

// ---------- Step 1: Direct ALTER TABLE (bypasses ALL migration tooling) ----------
async function ensureColumns() {
  const postgres = require("postgres");
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

  try {
    console.log("⏳ [server-wrapper] DATABASE_URL host:", DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"));

    // Raw DDL — no migration framework, no journal, just ALTER TABLE.
    await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "show_public_phone" boolean DEFAULT false NOT NULL`;
    await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "show_public_email" boolean DEFAULT false NOT NULL`;
    await sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "payment_instructions" text`;
    console.log("✅ [server-wrapper] ALTER TABLE executed.");

    // Verify the column actually exists now
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'profiles'
      AND column_name IN ('show_public_phone', 'show_public_email')
    `;
    console.log("🔍 [server-wrapper] Verified columns in profiles:", cols.map(r => r.column_name));

    if (cols.length < 2) {
      console.error("❌ [server-wrapper] Columns STILL missing after ALTER TABLE! DB might be read-only or wrong.");
      process.exit(1);
    }

    const eventCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'events'
      AND column_name = 'payment_instructions'
    `;
    console.log("🔍 [server-wrapper] Verified events.payment_instructions:", eventCols.length === 1 ? "present" : "MISSING");
    if (eventCols.length < 1) {
      console.error("❌ [server-wrapper] events.payment_instructions STILL missing! DB might be read-only or wrong.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ [server-wrapper] Direct ALTER TABLE failed:", err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// ---------- Step 2: Run Drizzle migrations for other pending changes ----------
function runDrizzleMigrations() {
  try {
    console.log("⏳ [server-wrapper] Running Drizzle migrations…");
    execSync("node --import tsx scripts/migrate.ts", {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    console.log("✅ [server-wrapper] Drizzle migrations done.");
  } catch (err) {
    console.error("❌ [server-wrapper] Drizzle migration FAILED.");
    process.exit(1);
  }
}

// ---------- Step 3: Start Next.js ----------
ensureColumns()
  .then(() => {
    runDrizzleMigrations();
    require("./_server.js");
  })
  .catch((err) => {
    console.error("❌ [server-wrapper] Fatal:", err);
    process.exit(1);
  });
