/**
 * Legacy path shim — billing used to live under
 * `/dashboard/pages/[pageId]/billing`. Now it's `/account/billing/[pageId]`.
 * Query string (`?paid=...`, `?status=...`) is preserved so callback
 * landings keep their banners.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";

type Params = Promise<{ pageId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function buildQuery(sp: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export default async function LegacyPageBilling({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { pageId } = await params;
  const sp = await searchParams;
  redirect(`/account/billing/${pageId}${buildQuery(sp)}` as Route);
}
