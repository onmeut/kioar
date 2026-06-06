import "server-only";

import { and, count, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { cards } from "@/db/schema";
import { generateUniqueCardIds } from "@/lib/cards/card-id";

export type CardMaterial = "colorful" | "metal";
export type CardSource = "purchased" | "gift_pro" | "gift_business";

export type MintBatchInput = {
  count: number;
  batch: string;
  color: string;
  material: CardMaterial;
  source: CardSource;
};

/**
 * Mint `count` unassigned cards for a batch. Used by both the admin
 * "Generate batch" action and the CLI generator. Returns the new ids.
 *
 * The physical artifact pipeline (QR SVGs + manifest) is generated separately
 * from these ids — see `scripts/generate-card-batch.ts` (CLI) and the admin
 * export (Phase 6), both of which render via the shared QR engine.
 */
export async function mintCardBatch(input: MintBatchInput): Promise<string[]> {
  if (!Number.isInteger(input.count) || input.count <= 0) {
    throw new Error("count must be a positive integer");
  }
  const db = getDb();
  const ids = await generateUniqueCardIds(input.count);
  await db.insert(cards).values(
    ids.map((id) => ({
      id,
      status: "unassigned" as const,
      batch: input.batch,
      color: input.color,
      material: input.material,
      source: input.source,
    })),
  );
  return ids;
}

export type BatchSummary = {
  batch: string;
  total: number;
  unassigned: number;
  assigned: number;
  disabled: number;
};

/** Per-batch counts grouped by status, for the admin inventory view. */
export async function getBatchSummaries(): Promise<BatchSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      batch: cards.batch,
      status: cards.status,
      n: count(),
    })
    .from(cards)
    .groupBy(cards.batch, cards.status);

  const map = new Map<string, BatchSummary>();
  for (const r of rows) {
    const entry =
      map.get(r.batch) ??
      ({
        batch: r.batch,
        total: 0,
        unassigned: 0,
        assigned: 0,
        disabled: 0,
      } satisfies BatchSummary);
    entry.total += Number(r.n);
    entry[r.status] += Number(r.n);
    map.set(r.batch, entry);
  }
  return [...map.values()].sort((a, b) => b.batch.localeCompare(a.batch));
}

/** All card ids in a batch (for the admin export package). */
export async function getCardIdsForBatch(batch: string): Promise<
  Array<{ id: string; color: string; material: CardMaterial }>
> {
  const db = getDb();
  const rows = await db
    .select({ id: cards.id, color: cards.color, material: cards.material })
    .from(cards)
    .where(eq(cards.batch, batch));
  return rows;
}

/** Disable a single card (lost/stolen/revoked). */
export async function disableCard(id: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(cards)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(and(eq(cards.id, id)))
    .returning({ id: cards.id });
  return updated.length > 0;
}
