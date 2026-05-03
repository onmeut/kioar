import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getRequiredEnv } from "@/lib/env";

import * as schema from "./schema";

/**
 * Production-ready Postgres pool.
 *
 * Sizing:
 *   `DATABASE_POOL_MAX` (default 10). Total Postgres connections =
 *   `DATABASE_POOL_MAX × instance count`. Postgres' default `max_connections`
 *   is 100, so when running >2 app instances you SHOULD put PgBouncer in
 *   transaction mode in front. This client is already pgbouncer-compatible
 *   (`prepare: false`).
 *
 * Safety timeouts (hard server-side caps that don't depend on app code):
 *   `statement_timeout` (default 15s) — kills runaway queries.
 *   `idle_in_transaction_session_timeout` (default 10s) — frees connections
 *     held by abandoned transactions.
 *
 * SSL:
 *   `DATABASE_SSL=require` enables TLS. `DATABASE_SSL=no-verify` enables TLS
 *   but skips cert validation (managed Postgres providers with self-signed
 *   intermediates). Default: off (local docker / pgbouncer on a private net).
 */

type SslOption = false | "require" | { rejectUnauthorized: boolean };

function parseSsl(): SslOption {
  const raw = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (!raw || raw === "false" || raw === "disable" || raw === "off") {
    return false;
  }
  if (raw === "no-verify") {
    return { rejectUnauthorized: false };
  }
  return "require";
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function createDatabase(url: string) {
  const max = parsePositiveInt(process.env.DATABASE_POOL_MAX, 10);
  const statementTimeoutMs = parsePositiveInt(
    process.env.DATABASE_STATEMENT_TIMEOUT_MS,
    15_000,
  );
  const idleTxTimeoutMs = parsePositiveInt(
    process.env.DATABASE_IDLE_TX_TIMEOUT_MS,
    10_000,
  );

  const client = postgres(url, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    ssl: parseSsl(),
    connection: {
      // Server-side query timeouts: applied per session by `postgres`.
      // Values are passed as connection params (strings) per libpq.
      statement_timeout: statementTimeoutMs as unknown as number,
      idle_in_transaction_session_timeout: idleTxTimeoutMs as unknown as number,
      application_name: "kioar-app",
    },
    onnotice: () => {
      // Suppress NOTICE-level chatter (pgbouncer, transaction wrappers).
    },
  });

  return {
    client,
    db: drizzle(client, { schema }),
  };
}

type Database = ReturnType<typeof createDatabase>["db"];
type Client = ReturnType<typeof createDatabase>["client"];

declare global {
  // eslint-disable-next-line no-var
  var __kioarDb: Database | undefined;
  // eslint-disable-next-line no-var
  var __kioarDbClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __kioarDbShutdownHooked: boolean | undefined;
}

function attachShutdownHooks(client: Client) {
  if (globalThis.__kioarDbShutdownHooked) return;
  globalThis.__kioarDbShutdownHooked = true;

  const shutdown = async (signal: string) => {
    try {
      await client.end({ timeout: 5 });
    } catch {
      // Best-effort drain on shutdown — never block exit.
    } finally {
      // Do not call process.exit; let the runtime exit naturally so other
      // shutdown hooks (Next.js, telemetry, etc.) can complete.
      void signal;
    }
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

export function getDb() {
  if (!globalThis.__kioarDb) {
    const { client, db } = createDatabase(getRequiredEnv("DATABASE_URL"));
    globalThis.__kioarDb = db;
    globalThis.__kioarDbClient = client;
    attachShutdownHooks(client);
  }
  return globalThis.__kioarDb;
}

export type { Database };
export * from "./schema";
