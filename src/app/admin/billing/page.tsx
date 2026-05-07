import type { Route } from "next";
import { redirect } from "next/navigation";

export default function AdminBillingIndexRedirect() {
  redirect("/admin/billing/overview" as Route);
}
