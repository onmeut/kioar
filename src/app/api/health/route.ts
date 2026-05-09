import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe.
 *
 * Public on purpose — load balancers (Caddy, ArvanCloud, uptime monitors)
 * need an unauthenticated URL they can poll. The endpoint exposes only
 * dependency status booleans, never error details, so it's safe to leak.
 *
 * Status semantics:
 *   - `db: "up" | "down"` — `select 1` against Postgres
 *   - `redis: "up" | "down" | "unconfigured"` — `PING` if REDIS_URL set
 *   - HTTP 200 when the *required* dependency (DB) is up, 503 when DB is
 *     down. Redis being down doesn't fail the probe — the app degrades
 *     (rate limits / cache fall through) rather than refuses traffic.
 */
export async function GET() {
  const startedAt = Date.now();

  const [dbOk, redisStatus] = await Promise.all([pingDb(), pingRedis()]);

  const body = {
    ok: dbOk,
    db: dbOk ? "up" : "down",
    redis: redisStatus,
    durationMs: Date.now() - startedAt,
  } as const;

  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}

async function pingDb(): Promise<boolean> {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

async function pingRedis(): Promise<"up" | "down" | "unconfigured"> {
  const redis = getRedis();
  if (!redis) return "unconfigured";
  try {
    const reply = await redis.ping();
    return reply === "PONG" ? "up" : "down";
  } catch {
    return "down";
  }
}
