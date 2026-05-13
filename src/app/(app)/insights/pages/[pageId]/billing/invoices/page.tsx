import type { Route } from "next";
import { redirect } from "next/navigation";

type Params = Promise<{ pageId: string }>;

export default async function LegacyPageInvoices({
  params,
}: {
  params: Params;
}) {
  const { pageId } = await params;
  redirect(`/account/billing/${pageId}/invoices` as Route);
}
