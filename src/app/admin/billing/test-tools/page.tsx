import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { TestToolsClient } from "./test-tools-client";
import { TEST_TOOLS_SMS_TEMPLATE_KEYS } from "./constants";

export const dynamic = "force-dynamic";

export default async function AdminBillingTestToolsPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  await requireAdmin();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">ابزارهای آزمایشی صورت‌حساب</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          این بخش تنها در محیط توسعه فعال است. هیچ‌کدام از این ابزارها وارد محیط
          Production نمی‌شوند.
        </p>
      </header>

      <TestToolsClient
        smsTemplateKeys={TEST_TOOLS_SMS_TEMPLATE_KEYS as unknown as string[]}
      />
    </div>
  );
}
