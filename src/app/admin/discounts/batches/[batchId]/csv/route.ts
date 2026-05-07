import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { discountCodes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Phase 7 — CSV download for a discount batch.
 * Admin-gated. Returns the display codes plus their amount/cycle/limits so
 * the operator can hand the batch off to whoever is distributing them.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ batchId: string }> },
) {
  await requireAdmin();
  const { batchId } = await ctx.params;
  if (!UUID_RE.test(batchId)) {
    return NextResponse.json({ error: "invalid batch id" }, { status: 400 });
  }

  const rows = await getDb()
    .select({
      code: discountCodes.code,
      nameFa: discountCodes.nameFa,
      discountType: discountCodes.discountType,
      amount: discountCodes.amount,
      recurringCycles: discountCodes.recurringCycles,
      maxRedemptions: discountCodes.maxRedemptions,
      maxPerUser: discountCodes.maxPerUser,
      startsAt: discountCodes.startsAt,
      endsAt: discountCodes.endsAt,
      isActive: discountCodes.isActive,
    })
    .from(discountCodes)
    .where(
      and(eq(discountCodes.batchId, batchId), isNull(discountCodes.deletedAt)),
    )
    .orderBy(asc(discountCodes.code));

  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const header = [
    "code",
    "name",
    "discount_type",
    "amount",
    "recurring_cycles",
    "max_redemptions",
    "max_per_user",
    "starts_at",
    "ends_at",
    "is_active",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.code,
        r.nameFa,
        r.discountType,
        String(r.amount),
        String(r.recurringCycles),
        r.maxRedemptions == null ? "" : String(r.maxRedemptions),
        r.maxPerUser == null ? "" : String(r.maxPerUser),
        r.startsAt ? r.startsAt.toISOString() : "",
        r.endsAt ? r.endsAt.toISOString() : "",
        r.isActive ? "true" : "false",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  // UTF-8 BOM so Excel opens it correctly.
  const body = "\ufeff" + lines.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="discount-batch-${batchId}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
