/**
 * Programmatic migration runner.
 *
 * Replaces `drizzle-kit migrate` (CLI tool) for production use.
 * This script is invoked by the Docker ENTRYPOINT before the app starts.
 * If ANY migration fails, the process exits with code 1 — the container
 * will NOT start, which is the correct behavior (fail loud, not silent).
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
