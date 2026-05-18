import path from "node:path";

/**
 * Next.js instrumentation hook — runs ONCE before the server accepts any
 * requests. We use it to apply pending Drizzle migrations so schema changes
 * are guaranteed to land before the first query, regardless of how the PaaS
 * starts the container (many override Dockerfile ENTRYPOINT / CMD).
 */
export async function register() {
  // Only run migrations on the server (not during build or in Edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await runMigrations();
  }
}

async function runMigrations() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const postgres = (await import("postgres")).default;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set — skipping migrations.");
    return;
  }

  const migrationsFolder = path.join(process.cwd(), "drizzle");

  console.log(`⏳ Running migrations from ${migrationsFolder} …`);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder });
    console.log("✅ All migrations applied.");
  } catch (err) {
    console.error("❌ Migration failed — server will NOT start.", err);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
