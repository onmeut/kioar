import { LogOutIcon, UserIcon } from "lucide-react";

import { signOutAction } from "@/app/(app)/dashboard/actions";
import { requireUser } from "@/lib/auth/session";
import { formatPhoneDisplay } from "@/lib/phone";
import { toPersianDigits } from "@/lib/persian";
import { AccountForm } from "@/components/app/account-form";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "حساب کاربری",
};

export default async function AccountPage() {
  const viewer = await requireUser();
  const { user } = viewer;

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <UserIcon className="size-6 text-muted-foreground" />
        <h1 className="text-xl font-bold">حساب کاربری</h1>
      </div>

      <div className="flex flex-col gap-8">
        {/* Phone — read-only */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">شماره موبایل ثبت‌شده</span>
          <div
            dir="ltr"
            className="flex h-11 items-center rounded-xl bg-muted px-4 font-mono text-base font-semibold text-foreground select-all"
          >
            {toPersianDigits(formatPhoneDisplay(user.phone))}
          </div>
          <p className="text-xs text-muted-foreground">
            شماره موبایل قابل تغییر نیست.
          </p>
        </div>

        {/* Legal name — used for billing/invoices */}
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">نام حقوقی</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              برای فاکتور و امور حقوقی استفاده می‌شه. روی صفحه‌ات نمایش داده
              نمی‌شه.
            </p>
          </div>
          <AccountForm
            initialFirstName={user.firstName ?? ""}
            initialLastName={user.lastName ?? ""}
          />
        </div>
      </div>

      <form action={signOutAction} className="mt-4">
        <Button
          type="submit"
          variant="outline"
          className="h-12 w-full rounded-full text-sm font-bold"
        >
          <LogOutIcon className="size-4" aria-hidden />
          خروج از حساب
        </Button>
      </form>
    </div>
  );
}
