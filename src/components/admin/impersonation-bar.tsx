import { LogOutIcon, UserIcon } from "lucide-react";

import { endImpersonationAction } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";
import { getCurrentViewer } from "@/lib/auth/session";
import { formatPhoneDisplay } from "@/lib/phone";

/**
 * Site-wide banner shown whenever an admin is browsing as another user.
 * Rendered inside the dashboard and admin layouts so the escape hatch is
 * always one tap away — admins forget they're impersonating and end up
 * posting from the wrong account otherwise.
 */
export async function ImpersonationBar() {
  const viewer = await getCurrentViewer();
  if (!viewer?.impersonator) return null;

  const target =
    viewer.profile?.fullName || formatPhoneDisplay(viewer.user.phone);

  return (
    <div className="sticky top-0 z-40 border-b border-amber-500/40 bg-amber-500/12 text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs font-semibold sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <UserIcon className="size-4 shrink-0" />
          <span className="truncate">
            در حال ورود به‌عنوان <span className="font-bold">{target}</span>
          </span>
        </div>
        <form action={endImpersonationAction}>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8 rounded-full border-amber-600/50 bg-background text-xs"
          >
            <LogOutIcon className="size-3.5" />
            بازگشت به ادمین
          </Button>
        </form>
      </div>
    </div>
  );
}
