import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { cards, profiles } from "@/db/schema";
import { log } from "@/lib/log";
import { getRedis } from "@/lib/redis";

/**
 * Card → page resolution for the public `/c/{id}` route.
 *
 * Resolution is by-id → slug. The public profile renderer + its expensive
 * multi-table load are already cached by SLUG in `profile-cache.ts`, so here
 * we only cache the small `id → {status, slug}` mapping. This second cache is
 * what we invalidate when a card is (re)bound or disabled; the slug-keyed
 * profile cache is invalidated separately by the existing helpers.
 *
 * Fail-open: any Redis error logs and falls through to the DB.
 */

const KEY_PREFIX = "kioar:card:v1:";
const TTL_SECONDS = 300;
// Sentinel for "card disabled or not found" so enumeration floods don't hit
// the DB on every tap of a dead id.
const DEAD_SENTINEL = "__dead__";

export type CardResolution =
  | { kind: "assigned"; slug: string; cardId: string }
  | { kind: "unassigned"; cardId: string }
  | { kind: "dead" }; // disabled or not found

function keyFor(id: string): string {
  return KEY_PREFIX + id;
}

async function loadFromDb(id: string): Promise<CardResolution> {
  const db = getDb();
  const row = await db
    .select({
      status: cards.status,
      pageId: cards.pageId,
      slug: profiles.slug,
      isComplete: profiles.isComplete,
    })
    .from(cards)
    .leftJoin(profiles, eq(cards.pageId, profiles.id))
    .where(eq(cards.id, id))
    .limit(1);

  const card = row[0];
  if (!card || card.status === "disabled") return { kind: "dead" };
  if (card.status === "assigned" && card.pageId && card.slug && card.isComplete) {
    return { kind: "assigned", slug: card.slug, cardId: id };
  }
  // assigned-but-page-incomplete is treated as unassigned (nothing to show yet).
  return { kind: "unassigned", cardId: id };
}

/**
 * Resolve a card id to its current routing target, read-through cached.
 */
export async function resolveCard(id: string): Promise<CardResolution> {
  const redis = getRedis();
  const key = keyFor(id);

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        if (cached === DEAD_SENTINEL) return { kind: "dead" };
        const parsed = JSON.parse(cached) as CardResolution;
        return parsed;
      }
    } catch (err) {
      log.warn("card_cache.read_error", {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const fresh = await loadFromDb(id);

  if (redis) {
    try {
      const value = fresh.kind === "dead" ? DEAD_SENTINEL : JSON.stringify(fresh);
      await redis.set(key, value, "EX", TTL_SECONDS);
    } catch (err) {
      log.warn("card_cache.write_error", {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return fresh;
}

/**
 * Drop the `id → page` cache entry. MUST be called (after the DB commit)
 * whenever a card is bound, re-pointed, or disabled.
 */
export async function invalidateCardCache(id: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(keyFor(id));
  } catch (err) {
    log.warn("card_cache.invalidate_error", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
