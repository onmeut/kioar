/**
 * Legacy path shim — `/dashboard/account` used to be the account hub
 * before billing was moved out of the dashboard namespace. Old
 * bookmarks, password managers, and external links still point here, so
 * we keep a tiny redirect alive. The new canonical surface is
 * `/account`.
 */
import { redirect } from "next/navigation";

// Authenticated shell — redirect-only, no direct session call.
export const dynamic = "force-dynamic";

export default function LegacyDashboardAccount() {
  redirect("/account");
}
