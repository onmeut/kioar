import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Commands that need a database connection will fail.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:oFvFQTyHKTXXDRJpsY1I@kioar-db.onmeut-production.svc:5432/postgres",
  },
  verbose: true,
  strict: true,
});
