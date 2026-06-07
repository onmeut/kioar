import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { eventDiscountCodes } from "@/db/schema";
import { computeDiscountedAmount } from "@/lib/events/state";

export { computeDiscountedAmount };

export type DiscountValidation =
  | {
      ok: true;
      codeId: string;
      normalizedCode: string;
      /** Amount owed after the discount (toman, never below 0). */
      amountToman: number;
      /** How much was discounted (toman). */
      discountToman: number;
    }
  | { ok: false; message: string };

/**
 * Validate a discount code for an event against the live DB (existence, active,
 * expiry, usage limit) and compute the resulting amount. Read-only — the
 * `usedCount` bump happens transactionally in the registration service when
 * the code is actually applied.
 */
export async function validateDiscountCode(
  eventId: string,
  rawCode: string,
  priceToman: number,
): Promise<DiscountValidation> {
  const normalizedCode = rawCode.trim();
  if (!normalizedCode) return { ok: false, message: "کد تخفیف را وارد کنید." };

  const db = getDb();
  const row = await db.query.eventDiscountCodes.findFirst({
    where: and(
      eq(eventDiscountCodes.eventId, eventId),
      sql`lower(${eventDiscountCodes.code}) = ${normalizedCode.toLowerCase()}`,
    ),
  });

  if (!row || !row.isActive) {
    return { ok: false, message: "کد تخفیف معتبر نیست." };
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { ok: false, message: "این کد تخفیف منقضی شده است." };
  }
  if (row.usageLimit != null && row.usedCount >= row.usageLimit) {
    return { ok: false, message: "ظرفیت استفاده از این کد تمام شده است." };
  }

  const { amountToman, discountToman } = computeDiscountedAmount(
    priceToman,
    row.type,
    row.value,
  );

  return {
    ok: true,
    codeId: row.id,
    normalizedCode: row.code,
    amountToman,
    discountToman,
  };
}
