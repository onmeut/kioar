import "dotenv/config"
import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Commands that need a database connection will fail."
  )
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/kioar",
  },
  verbose: true,
  strict: true,
})
