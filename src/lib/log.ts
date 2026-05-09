import "server-only";

import { getRequestContext } from "@/lib/log-context";

/**
 * Structured JSON logger. No external deps — prints one JSON object per line
 * to stdout/stderr so any log collector (Loki, Vector, Filebeat, journald)
 * can ingest it. Use this in server code instead of `console.log`.
 *
 * Level filter
 * ------------
 * Controlled by `LOG_LEVEL` (one of `debug` | `info` | `warn` | `error`).
 * Default in production: `info`. Default in development: `debug`. Set
 * `LOG_LEVEL=debug` in prod to temporarily get verbose logs without a
 * redeploy of the level constant. Unknown values fall back to `info`.
 *
 * Request correlation
 * -------------------
 * If the caller is running inside `withRequestContext()` (see
 * `lib/log-context.ts`), every emitted line gets a `requestId` and
 * (optional) `route` field automatically. Outside that scope (legacy
 * code, scripts, tests) lines emit without correlation — never throws.
 *
 * Redaction
 * ---------
 * A small set of common sensitive keys is replaced with `"[REDACTED]"`.
 * This is a safety net only; never rely on it as your sole defence —
 * the right thing is to not pass secrets as fields in the first place.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

// Resolved once per process so the per-call check is a single object lookup.
// A redeploy is required to change the level — that's intentional.
const MIN_LEVEL: LogLevel = resolveMinLevel();
const MIN_PRIORITY = LEVEL_PRIORITY[MIN_LEVEL];

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "set-cookie",
  "otp",
  "otpCode",
  "otp_code",
  "code",
  "apiKey",
  "api_key",
]);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

function emit(level: LogLevel, msg: string, fields?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < MIN_PRIORITY) return;

  const ctx = getRequestContext();
  const correlation: Record<string, unknown> = {};
  if (ctx) {
    correlation.requestId = ctx.requestId;
    if (ctx.route) correlation.route = ctx.route;
    if (ctx.fields) Object.assign(correlation, ctx.fields);
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...correlation,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const log = {
  debug(msg: string, fields?: Record<string, unknown>) {
    emit("debug", msg, fields);
  },
  info(msg: string, fields?: Record<string, unknown>) {
    emit("info", msg, fields);
  },
  warn(msg: string, fields?: Record<string, unknown>) {
    emit("warn", msg, fields);
  },
  error(msg: string, fields?: Record<string, unknown>) {
    emit("error", msg, fields);
  },
};
