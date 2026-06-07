/**
 * Pure QR-payload parsing for event check-in. NO server-only / DB imports so
 * it's unit-testable in isolation (tests/events.test.ts). The DB-touching
 * resolver in `checkin.ts` composes this with profile/card/user lookups.
 *
 * The personal Kioar QR encodes the user's public page URL in one of three
 * shapes:
 *   /{slug}      → a profile slug
 *   /c/{cardId}  → a physical/NFC card id
 *   /u/{userId}  → the stable per-user short URL
 */

// Crockford base32 minus ambiguous I/L/O/U — mirrors card-id.ts. Duplicated
// (not imported) to keep this module free of the server-only card module.
const CARD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CARD_ID_LENGTH = 7;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// App routes that are never a personal page — a QR landing on one of these is
// not a Kioar identity QR.
const RESERVED_SLUGS = new Set([
  "events",
  "api",
  "admin",
  "auth",
  "u",
  "c",
  "discover",
]);

export type QrTarget =
  | { kind: "card"; cardId: string }
  | { kind: "user"; userId: string }
  | { kind: "slug"; slug: string };

function isValidCardId(id: string): boolean {
  if (id.length !== CARD_ID_LENGTH) return false;
  for (const ch of id) {
    if (!CARD_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Split a scanned QR payload (full URL or bare path/slug) into path segments. */
export function qrPathSegments(scanned: string): string[] {
  const raw = scanned.trim();
  if (!raw) return [];
  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return [];
    }
  } else if (raw.includes("/")) {
    pathname = raw.startsWith("/") ? raw : `/${raw}`;
  } else {
    pathname = `/${raw}`;
  }
  return pathname.split("/").filter(Boolean);
}

/**
 * Parse a scanned QR into a routing target, or null for unparseable /
 * structurally-invalid / reserved payloads. Pure — caller does the DB lookup.
 */
export function parseQrTarget(scanned: string): QrTarget | null {
  const segments = qrPathSegments(scanned);
  if (segments.length === 0) return null;

  if (segments[0] === "c" && segments[1]) {
    const cardId = segments[1].toUpperCase();
    return isValidCardId(cardId) ? { kind: "card", cardId } : null;
  }
  if (segments[0] === "u" && segments[1]) {
    const userId = segments[1];
    return UUID_RE.test(userId) ? { kind: "user", userId } : null;
  }
  const slug = segments[0].toLowerCase();
  if (RESERVED_SLUGS.has(slug)) return null;
  return { kind: "slug", slug };
}
