/**
 * Phase 6 invoice numbering.
 *
 * Format: `KIOAR-{persianFiscalYear}-{6-digit-seq}`, e.g. `KIOAR-1404-000001`.
 *
 *   * `persianFiscalYear` is the Iranian/Hijri-Shamsi (Jalali) calendar
 *     year of the invoice's creation moment. The fiscal year resets each
 *     Farvardin 1 (≈ March 21 Gregorian). We use the platform `Intl`
 *     `persian` calendar to derive it — no third-party Jalali library
 *     needed, supported on Node 18+.
 *
 *   * The 6-digit sequence is per-year and monotonically increasing.
 *     Allocation goes through a transaction-scoped advisory lock keyed by
 *     `(NUMBERING_LOCK_NAMESPACE, year)` so two concurrent checkouts can't
 *     read the same `last_seq` and emit duplicate numbers. The lock is
 *     released automatically at TX commit/rollback, so callers MUST call
 *     `allocateInvoiceNumber` from inside the same transaction that
 *     INSERTs the invoice.
 *
 *   * Once we cross 999_999 invoices in a single fiscal year we'll need to
 *     widen the format. That's not a near-term concern; assert loudly if
 *     it happens so the misformat doesn't sneak into production.
 */
import { sql } from "drizzle-orm";

/**
 * Structural type covering both the top-level `Database` handle and the
 * transaction client passed to `db.transaction((tx) => ...)` callbacks.
 * We only need `execute` here.
 */
type Executor = {
  execute(query: ReturnType<typeof sql>): Promise<unknown>;
};

/**
 * Stable namespace for `pg_advisory_xact_lock(int4, int4)`. Picked
 * arbitrarily; never reused for another purpose. The second argument is
 * the Persian fiscal year so concurrent checkouts in the same year
 * serialize while different-year checkouts (very rare — only at the
 * Farvardin 1 boundary) don't block each other.
 */
const NUMBERING_LOCK_NAMESPACE = 0x49_4e_56_30; // 'INV0' as bytes

/**
 * Resolve the Persian (Jalali / Hijri Shamsi) fiscal year for an instant.
 * Uses the platform-bundled ICU `persian` calendar.
 */
export function persianFiscalYear(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    timeZone: "Asia/Tehran",
  });
  // Output is `1404 AP` or `1404`, depending on ICU build. Strip non-digits.
  const raw = fmt.format(now);
  const match = raw.match(/\d+/);
  if (!match) {
    throw new Error(`unable to resolve Persian fiscal year from "${raw}"`);
  }
  return Number.parseInt(match[0]!, 10);
}

export function formatInvoiceNumber(year: number, seq: number): string {
  if (seq < 1 || seq > 999_999) {
    throw new Error(
      `invoice sequence ${seq} for year ${year} is out of 1..999999 range; ` +
        "format needs widening before we mint another.",
    );
  }
  const padded = seq.toString().padStart(6, "0");
  return `KIOAR-${year}-${padded}`;
}

/**
 * Allocate the next invoice number for the given moment, inside a
 * transaction. MUST be called from `db.transaction(...)` — the advisory
 * lock is transaction-scoped and the UPSERT must commit alongside the
 * `invoices` INSERT or the counter and the table will diverge.
 *
 * Returns the formatted number (e.g. `KIOAR-1404-000001`).
 */
export async function allocateInvoiceNumber(
  tx: Executor,
  now: Date = new Date(),
): Promise<{ number: string; year: number; seq: number }> {
  const year = persianFiscalYear(now);

  // Serialize allocation per fiscal year. `pg_advisory_xact_lock` releases
  // automatically at TX boundary, so no try/finally needed.
  await tx.execute(
    sql`select pg_advisory_xact_lock(${NUMBERING_LOCK_NAMESPACE}, ${year})`,
  );

  // Atomically increment (or insert) the per-year counter. ON CONFLICT
  // path is taken every year except the very first checkout of a new
  // fiscal year.
  const rows = (await tx.execute(sql`
    INSERT INTO "billing_invoice_sequences" ("year", "last_seq")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE
      SET "last_seq" = "billing_invoice_sequences"."last_seq" + 1,
          "updated_at" = now()
    RETURNING "last_seq"
  `)) as unknown as Array<{ last_seq: number }>;

  const seq = Number(rows[0]?.last_seq ?? 0);
  if (!seq || seq < 1) {
    throw new Error(
      `invoice numbering UPSERT returned invalid seq=${seq} for year=${year}`,
    );
  }

  return { number: formatInvoiceNumber(year, seq), year, seq };
}
