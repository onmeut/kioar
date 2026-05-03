import { BillingSectionTabs } from "@/components/admin/billing-section-tabs";

export default function AdminBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="section-shell space-y-6 py-6">
      <BillingSectionTabs />
      {children}
    </div>
  );
}
