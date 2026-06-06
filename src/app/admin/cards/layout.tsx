import { CardsSectionTabs } from "@/components/admin/cards-section-tabs";

export default function AdminCardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="section-shell space-y-6 py-6">
      <CardsSectionTabs />
      {children}
    </div>
  );
}
