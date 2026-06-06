import "server-only";

import { inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { cards } from "@/db/schema";

/**
 * Card ID generation.
 *
 * Each physical card's ID is the value printed on the card and encoded in
 * both the QR and the NFC chip as `https://kioar.com/c/{id}`. It is the
 * primary key of the `cards` row by construction — there is no separate
 * "internal vs printed" id.
 *
 * Format: 7-char Crockford-style base32, uppercase, with ambiguous glyphs
 * removed (no 0/O, 1/I/L, U). ~30^7 ≈ 22 billion combinations, which keeps
 * collisions negligible at our volumes while staying short enough to read
 * off a card and type by hand if needed.
 *
 * IDs are random (NOT sequential) so the keyspace can't be enumerated by
 * incrementing, and we collision-check every generated batch against the DB
 * before insert.
 */

// Crockford base32 minus the ambiguous I/L/O/U.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const ID_LENGTH = 7;

function randomId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** True if `id` is a structurally valid card id (cheap pre-DB guard). */
export function isValidCardId(id: string): boolean {
  if (id.length !== ID_LENGTH) return false;
  for (const ch of id) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

/**
 * Generate `count` unique card ids that do not collide with each other or
 * with any existing `cards.id` in the database. Collision-checked in a single
 * query per attempt; retries the (vanishingly rare) collisions only.
 */
export async function generateUniqueCardIds(count: number): Promise<string[]> {
  if (count <= 0) return [];
  const db = getDb();
  const result = new Set<string>();

  // Bounded retry: at our keyspace, even a 100k batch collides ~never, but
  // we still verify against the DB to be safe.
  let attempts = 0;
  while (result.size < count && attempts < 50) {
    attempts++;
    const candidates = new Set<string>();
    while (candidates.size < count - result.size) {
      const id = randomId();
      if (!result.has(id)) candidates.add(id);
    }
    const candidateList = [...candidates];
    const taken = await db
      .select({ id: cards.id })
      .from(cards)
      .where(inArray(cards.id, candidateList));
    const takenSet = new Set(taken.map((row) => row.id));
    for (const id of candidateList) {
      if (!takenSet.has(id)) result.add(id);
    }
  }

  if (result.size < count) {
    throw new Error(
      `Could not generate ${count} unique card ids after ${attempts} attempts`,
    );
  }
  return [...result];
}
