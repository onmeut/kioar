/**
 * Admin payout queue CSV export.
 *
 * Returns all rows from listAdminPayouts (optionally filtered by ?status=)
 * as a UTF-8 CSV with BOM so Excel renders Persian text correctly.
 *
 * Auth: requireAdmin().
 * Columns: payout_id, affiliate_name, phone, amount_toman, sheba,
 *          holder_name, national_id, requested_at, status, transaction_ref.
 */
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/session";
import { listAdminPayouts } from "@/lib/affiliate";
import { formatShamsiDateTime } from "@/lib/date/persian";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = ["requested", "processing", "paid", "rejected"] as const;
type Status = (typeof VALID_STATUSES)[number];

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status: Status | undefined = (
    VALID_STATUSES as readonly string[]
  ).includes(statusParam ?? "")
    ? (statusParam as Status)
    : undefined;

  const rows = await listAdminPayouts({ status, limit: 10_000 });

  const header = [
    "payout_id",
    "affiliate_name",
    "phone",
    "amount_toman",
    "sheba",
    "holder_name",
    "national_id",
    "requested_at",
    "paid_at",
    "status",
    "transaction_ref",
    "rejected_reason",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.affiliateName,
        r.affiliatePhone,
        r.amountToman,
        r.shebaSnapshot,
        r.holderNameSnapshot,
        r.nationalIdSnapshot,
        formatShamsiDateTime(r.createdAt),
        r.paidAt ? formatShamsiDateTime(r.paidAt) : "",
        r.status,
        r.transactionRef,
        r.rejectedReason,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  // BOM so Excel detects UTF-8 and renders Persian properly.
  const body = "\uFEFF" + lines.join("\n");
  const filename = `payouts-${status ?? "all"}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
