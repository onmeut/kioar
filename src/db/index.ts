import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredEnv } from "@/lib/env";

import * as schema from "./schema";

function createDatabase(url: string) {
  // Pool sized for ~1000 rps with Postgres on the same host or via pgbouncer.
  // `prepare: false` keeps us compatible with pgbouncer transaction-mode.
  const maxRaw = Number(process.env.DATABASE_POOL_MAX ?? "");
  const max = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 20;
  const client = postgres(url, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

type Database = ReturnType<typeof createDatabase>["db"];

declare global {
  var __kioarDb: Database | undefined;
}

export function getDb() {
  if (!globalThis.__kioarDb) {
    globalThis.__kioarDb = createDatabase(getRequiredEnv("DATABASE_URL")).db;
  }

  return globalThis.__kioarDb;
}

export type { Database };
export * from "./schema";
