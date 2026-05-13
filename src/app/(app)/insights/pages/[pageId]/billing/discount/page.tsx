import type { Route } from "next";
import { redirect } from "next/navigation";

type Params = Promise<{ pageId: string }>;

export default async function LegacyPageDiscount({
  params,
}: {
  params: Params;
}) {
  const { pageId } = await params;
  redirect(`/account/billing/${pageId}/discount` as Route);
}
