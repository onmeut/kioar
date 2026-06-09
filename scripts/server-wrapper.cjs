#!/usr/bin/env node
"use strict";

/**
 * Production server entry-point wrapper.
 *
 * This file REPLACES the Next.js standalone `server.js` in the Docker image.
 * The real Next.js server is renamed to `_server.js` during build.
 *
 * Flow (every phase is timed + greppable):
 *   1. Run raw ALTER TABLE directly (bounded retry, no migration framework).
 *   2. Verify the columns actually exist.
 *   3. Run Drizzle migrations for everything else (hard execSync timeout).
 *   4. Load the real Next.js server.
 *
 * Why a wrapper: Hamravesh/Darkube PaaS overrides Dockerfile ENTRYPOINT/CMD and
 * runs `node server.js` directly. This file IS `server.js` at runtime.
 *
 * Single replica only — no migration coordination needed. If this ever scales
 * past one replica, reintroduce a Postgres advisory lock around the DDL +
 * migrate phases so exactly one pod migrates.
 */

const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

// At runtime this file is copied to /app/server.js, so __dirname === /app and
// the migrate script is at /app/scripts/migrate.ts. When run directly from the
// source tree for testing, this file lives in scripts/ so migrate.ts is a
// sibling. Resolve the real location instead of assuming a fixed cwd.
const cwd = path.resolve(__dirname);
const MIGRATE_SCRIPT = [
  path.join(cwd, "scripts", "migrate.ts"), // Docker image layout (/app/scripts/migrate.ts)
  path.join(cwd, "migrate.ts"), // co-located with this file (running from scripts/)
].find((p) => existsSync(p));
const DATABASE_URL = process.env.DATABASE_URL;

// ---------- Tunables (env-overridable, sane prod defaults) ----------
const CONNECT_TIMEOUT_SEC = Number(process.env.WRAPPER_CONNECT_TIMEOUT_SEC || 10);
const IDLE_TIMEOUT_SEC = Number(process.env.WRAPPER_IDLE_TIMEOUT_SEC || 20);
const DDL_MAX_ATTEMPTS = Number(process.env.WRAPPER_DDL_MAX_ATTEMPTS || 3);
const DDL_BACKOFF_MS = Number(process.env.WRAPPER_DDL_BACKOFF_MS || 1500);
const MIGRATE_TIMEOUT_MS = Number(process.env.WRAPPER_MIGRATE_TIMEOUT_MS || 60_000);

const bootStartedAt = Date.now();

// ---------- High-resolution, greppable, timestamped logging ----------
function ts() {
  return new Date().toISOString();
}
function sinceBoot() {
  return `${Date.now() - bootStartedAt}ms`;
}
function logPhase(emoji, phase, msg, extra) {
  const base = `${emoji} [server-wrapper] [${ts()}] [+${sinceBoot()}] ${phase}`;
  if (extra !== undefined) {
    console.log(base + (msg ? ` ${msg}` : ""), extra);
  } else {
    console.log(base + (msg ? ` ${msg}` : ""));
  }
}
// Wrap an async phase with start/end + elapsed-ms logging.
async function timedPhase(phase, fn) {
  const start = Date.now();
  logPhase("⏳", phase, "start");
  try {
    const result = await fn();
    logPhase("✅", phase, `done in ${Date.now() - start}ms`);
    return result;
  } catch (err) {
    logPhase("❌", phase, `FAILED after ${Date.now() - start}ms`);
    throw err;
  }
}

// ---------- Process-level death loggers ----------
// Without these a fatal error makes the pod vanish silently; the PaaS-captured
// stdout then shows nothing. These print WHY before the process exits.
function fatalExit(reason, err) {
  logPhase("💀", "FATAL", reason);
  if (err) {
    console.error(`💀 [server-wrapper] [${ts()}] [+${sinceBoot()}] FATAL detail:`, err && err.stack ? err.stack : err);
  }
  process.exit(1);
}
process.on("uncaughtException", (err) => {
  fatalExit("uncaughtException — process is dying", err);
});
process.on("unhandledRejection", (reason) => {
  fatalExit("unhandledRejection — process is dying", reason);
});
process.on("SIGTERM", () => {
  // The PaaS sends SIGTERM when it kills a pod (probe failure, scale-down,
  // rollout). Logging it tells us the death was orchestrator-initiated, not a
  // crash — critical for distinguishing "we hung past the probe" from "we threw".
  logPhase("🛑", "SIGTERM", `received after +${sinceBoot()} — orchestrator is terminating this pod`);
  process.exit(143); // 128 + 15
});

if (!DATABASE_URL) {
  fatalExit("DATABASE_URL is not set!");
}

// ---------- Fail-fast postgres client factory ----------
// max:1 keeps a single connection; connect_timeout makes an unreachable DB fail
// fast instead of hanging forever; idle_timeout reaps the socket promptly.
function makeClient() {
  const postgres = require("postgres");
  return postgres(DATABASE_URL, {
    max: 1,
    connect_timeout: CONNECT_TIMEOUT_SEC,
    idle_timeout: IDLE_TIMEOUT_SEC,
    onnotice: () => {},
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Direct ALTER TABLE + verification (bounded retry) ----------
// Raw DDL — no migration framework, no journal, just idempotent ALTER TABLE.
// Wrapped in a short retry so a transient DB blip retries instead of killing
// the pod. After the final attempt, the error propagates to fatalExit.
async function ensureColumns() {
  let lastErr;
  for (let attempt = 1; attempt <= DDL_MAX_ATTEMPTS; attempt++) {
    const sql = makeClient();
    try {
      return await timedPhase(`ddl:attempt-${attempt}`, async () => {
        logPhase(
          "🔗",
          `ddl:attempt-${attempt}`,
          "DATABASE_URL host:",
          DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@")
        );

        await timedPhase(`ddl:alter-${attempt}`, async () => {
          await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "show_public_phone" boolean DEFAULT false NOT NULL`;
          await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "show_public_email" boolean DEFAULT false NOT NULL`;
          await sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "payment_instructions" text`;
        });

        await timedPhase(`ddl:verify-${attempt}`, async () => {
          const cols = await sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'profiles'
            AND column_name IN ('show_public_phone', 'show_public_email')
          `;
          logPhase("🔍", `ddl:verify-${attempt}`, "profiles cols:", cols.map((r) => r.column_name));
          if (cols.length < 2) {
            throw new Error("profiles columns STILL missing after ALTER TABLE (DB read-only or wrong target?)");
          }

          const eventCols = await sql`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'events'
            AND column_name = 'payment_instructions'
          `;
          logPhase(
            "🔍",
            `ddl:verify-${attempt}`,
            "events.payment_instructions:",
            eventCols.length === 1 ? "present" : "MISSING"
          );
          if (eventCols.length < 1) {
            throw new Error("events.payment_instructions STILL missing after ALTER TABLE");
          }
        });
      });
    } catch (err) {
      lastErr = err;
      logPhase("⚠️", `ddl:attempt-${attempt}`, `failed (${attempt}/${DDL_MAX_ATTEMPTS})`);
      console.error(err && err.stack ? err.stack : err);
      if (attempt < DDL_MAX_ATTEMPTS) {
        await sleep(DDL_BACKOFF_MS * attempt);
      }
    } finally {
      try {
        await sql.end({ timeout: 5 });
      } catch {
        /* ignore */
      }
    }
  }
  throw new Error(`Direct ALTER TABLE failed after ${DDL_MAX_ATTEMPTS} attempts: ${lastErr && lastErr.message}`);
}

// ---------- Drizzle migrations (hard timeout) ----------
// A hung migrate would otherwise hang until the PaaS kills the pod. The
// execSync timeout makes it fail fast and loudly. The programmatic migrate.ts
// (NOT drizzle-kit CLI) wraps DDL + journal insert in one transaction.
function runDrizzleMigrations() {
  const start = Date.now();
  if (!MIGRATE_SCRIPT) {
    throw new Error("could not locate scripts/migrate.ts (looked next to wrapper and in ./scripts)");
  }
  logPhase("⏳", "migrate", `start (execSync ${MIGRATE_SCRIPT}, hard timeout ${MIGRATE_TIMEOUT_MS}ms)`);
  try {
    execSync(`node --import tsx ${JSON.stringify(MIGRATE_SCRIPT)}`, {
      cwd,
      stdio: "inherit",
      env: process.env,
      timeout: MIGRATE_TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    logPhase("✅", "migrate", `done in ${Date.now() - start}ms`);
  } catch (err) {
    if (err && err.signal === "SIGKILL") {
      throw new Error(`Drizzle migrate exceeded ${MIGRATE_TIMEOUT_MS}ms hard timeout and was killed`);
    }
    throw new Error(`Drizzle migrate failed after ${Date.now() - start}ms: ${err && err.message}`);
  }
}

// ---------- Boot sequence ----------
async function boot() {
  logPhase("🚀", "boot", `wrapper starting (pid ${process.pid})`);

  await ensureColumns();
  runDrizzleMigrations();

  // SUCCESS PATH ONLY: hand off to the real Next.js server.
  logPhase("🟢", "handoff", `migrations complete; loading _server.js (+${sinceBoot()})`);
  require("./_server.js");
}

boot().catch((err) => {
  fatalExit("boot sequence failed before _server.js could start", err);
});
