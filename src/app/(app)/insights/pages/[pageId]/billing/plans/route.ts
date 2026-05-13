/**
 * Legacy cookie-pinning shim — used to live at
 * `/dashboard/pages/[pageId]/billing/plans`. Same idea: hop to `/pro`.
 */
import type { Route } from "next";
import { redirect } from "next/navigation";

type Params = Promise<{ pageId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { pageId } = await params;
  redirect(`/account/billing/${pageId}/plans` as Route);
}
