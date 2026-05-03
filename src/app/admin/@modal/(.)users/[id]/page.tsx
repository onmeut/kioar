import { RouteModalSheet } from "@/components/admin/route-modal-sheet";
import AdminUserDetailPage from "@/app/admin/users/[id]/page";

export default function InterceptedUserDetailModal(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    impersonate?: string;
    pageId?: string;
  }>;
}) {
  return (
    <RouteModalSheet title="مدیریت کاربر">
      <AdminUserDetailPage {...props} />
    </RouteModalSheet>
  );
}
