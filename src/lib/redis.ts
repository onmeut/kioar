import "server-only";

import Redis from "ioredis";

import { log } from "@/lib/log";

/**
 * Single-process Redis client. Only used by the rate limiter today; expose
 * a generic `getRedis()` so future callers don't reinvent the wheel.
 *
 * Production policy:
 *   - `REDIS_URL` is REQUIRED in production. Missing it throws on first use
 *     so the failure is loud at deploy time instead of silently falling back
 *     to Postgres under abuse traffic.
 *   - In development/test, missing `REDIS_URL` returns `null` so callers
 *     can fall back to Postgres without booting Redis locally.
 *
 * Connection behavior:
 *   - `lazyConnect: false` (default): connection happens on construction.
 *   - `enableOfflineQueue: false`: commands fail fast if the socket is down,
 *     so the rate limiter can fall through to Postgres instead of stalling.
 *   - `maxRetriesPerRequest: 1`: cap retry latency for the same reason.
 *   - Reconnection is automatic via ioredis' built-in retry strategy.
 */

declare global {
  // eslint-disable-next-line no-var
  var __kioarRedis: Redis | null | undefined;
  // eslint-disable-next-line no-var
  var __kioarRedisShutdownHooked: boolean | undefined;
}

function attachShutdownHooks(client: Redis) {
  if (globalThis.__kioarRedisShutdownHooked) return;
  globalThis.__kioarRedisShutdownHooked = true;
  const shutdown = () => {
    // `disconnect` is synchronous and best-effort; we don't await `quit`
    // because process exit is already in progress.
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

/**
 * Returns a connected Redis client, or `null` if `REDIS_URL` is unset and
 * we are not in production. Throws in production if `REDIS_URL` is missing.
 */
export function getRedis(): Redis | null {
  if (globalThis.__kioarRedis !== undefined) {
    return globalThis.__kioarRedis;
  }

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "REDIS_URL is required in production. Set it in the environment or " +
          "use docker-compose.prod.yml with the `redis` profile.",
      );
    }
    globalThis.__kioarRedis = null;
    return null;
  }

  const client = new Redis(url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: false,
    // Exponential backoff capped at 2s. Beyond that the rate limiter will
    // start failing over to Postgres anyway because `enableOfflineQueue`
    // is false.
    retryStrategy: (times) => Math.min(times * 200, 2000),
    reconnectOnError: () => true,
  });

  // Log only the first error in each disconnect cycle to avoid spam.
  // ioredis fires "error" on every failed reconnect attempt.
  let _errorLogged = false;
  client.on("error", (err) => {
    if (_errorLogged) return;
    _errorLogged = true;
    log.warn("redis.error", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
  client.on("ready", () => {
    _errorLogged = false;
  });

  attachShutdownHooks(client);
  globalThis.__kioarRedis = client;
  return client;
}
