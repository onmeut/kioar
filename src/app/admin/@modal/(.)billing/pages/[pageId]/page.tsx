import { RouteModalSheet } from "@/components/admin/route-modal-sheet";
import AdminBillingPageDetailPage from "@/app/admin/billing/pages/[pageId]/page";

export default function InterceptedBillingPageDetailModal(props: {
  params: Promise<{ pageId: string }>;
}) {
  return (
    <RouteModalSheet title="مدیریت اشتراک صفحه">
      <AdminBillingPageDetailPage {...props} />
    </RouteModalSheet>
  );
}
