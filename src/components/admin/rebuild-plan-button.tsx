"use client";

import { useActionState, useState } from "react";
import { RefreshCcwIcon } from "lucide-react";

import { adminRebuildPlanEntitlementsAction } from "@/app/admin/plans/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { idleState } from "@/lib/action-state";
import { toPersianDigits } from "@/lib/persian";

type Props = {
  planId: string;
  planNameFa: string;
  pageCount: number;
};

export function RebuildPlanButton({ planId, planNameFa, pageCount }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    adminRebuildPlanEntitlementsAction,
    idleState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="h-9 gap-1 text-xs">
            <RefreshCcwIcon className="size-3" />
            بازسازی برای همه صفحات این پلن
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form action={action}>
          <input type="hidden" name="planId" value={planId} />
          <DialogHeader>
            <DialogTitle>بازسازی قابلیت‌های پلن «{planNameFa}»</DialogTitle>
            <DialogDescription>
              تغییرات ماتریس قابلیت‌ها فقط روی صفحه‌های جدید اعمال می‌شود مگر
              این‌که قابلیت‌های صفحه‌های موجود را بازسازی کنید. این اقدام
              قابلیت‌های مبدا «اشتراک» را پاک و طبق ماتریس فعلی دوباره
              می‌سازد. قابلیت‌های اعطایی توسط ادمین یا کدهای تخفیف دست‌نخورده
              می‌مانند.
              <br />
              <br />
              <strong>{toPersianDigits(pageCount)} صفحه</strong> روی این پلن
              تحت تأثیر قرار می‌گیرد.
            </DialogDescription>
          </DialogHeader>
          {state.status === "error" && state.message ? (
            <p className="px-4 text-xs text-destructive">{state.message}</p>
          ) : null}
          {state.status === "success" && state.message ? (
            <p className="px-4 text-xs text-emerald-600">{state.message}</p>
          ) : null}
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "در حال بازسازی…" : "بازسازی همه"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
