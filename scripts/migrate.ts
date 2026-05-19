/**
 * Programmatic migration runner.
 *
 * Use this (via `npm run db:migrate`) — NEVER use `drizzle-kit migrate` CLI.
 *
 * WHY: drizzle-kit CLI has a bug where it records a migration as applied in
 * __drizzle_migrations even when the DDL fails (phantom-apply). Once
 * phantom-applied, drizzle skips that SQL on every future deploy, leaving
 * schema changes missing forever. This is what caused the show_public_phone
 * production incident.
 *
 * This script uses drizzle-orm's programmatic migrate() which wraps the DDL
 * AND the journal insert in one transaction — if DDL fails, the journal entry
 * rolls back too. No phantom entries possible.
 *
 * Usage: node --import tsx scripts/migrate.ts
 *        (or via `npm run db:migrate`)
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set. Cannot run migrations.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  onnotice: () => {},
});

const db = drizzle(sql);

async function main() {
  const migrationsFolder = path.resolve(__dirname, "../drizzle");

  console.log(`⏳ Running migrations from ${migrationsFolder}...`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("✅ Migrations applied successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
