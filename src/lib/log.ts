import "server-only";

/**
 * Structured JSON logger. No external deps — prints one JSON object per line
 * to stdout/stderr so any log collector (Loki, Vector, Filebeat, journald)
 * can ingest it. Use this in server code instead of `console.log`.
 *
 * Never pass secrets as fields. We explicitly redact a small set of common
 * sensitive keys as a safety net.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

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
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
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
    if (process.env.NODE_ENV === "production" && process.env.LOG_DEBUG !== "1")
      return;
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
