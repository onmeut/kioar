/**
 * `/account/billing` (no pageId) — fallback target used by the Zarinpal
 * callback when the inbound query is malformed (`?status=invalid`).
 * There's nothing actionable here without a pageId, so bounce the user
 * to the account hub where they can pick the right page or invoice.
 */
import { redirect } from "next/navigation";

// Authenticated shell — redirect-only, no direct session call.
export const dynamic = "force-dynamic";

export default function AccountBillingIndex() {
  redirect("/account");
}
