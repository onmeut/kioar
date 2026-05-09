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
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";

type Props = {
  planId: string;
  planNameFa: string;
  pageCount: number;
};

type Scope = "all_now" | "future_only";

export function RebuildPlanButton({ planId, planNameFa, pageCount }: Props) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("all_now");
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
            اعمال تغییرات روی این پلن
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form action={action}>
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="scope" value={scope} />
          <DialogHeader>
            <DialogTitle>
              اعمال ماتریس قابلیت‌های پلن «{planNameFa}»
            </DialogTitle>
            <DialogDescription>
              تغییرات ماتریس قابلیت‌ها به‌صورت خودکار فقط روی اشتراک‌های جدید و
              تمدیدها از این لحظه به بعد اعمال می‌شود. برای اعمال فوری روی
              اشتراک‌های فعلی، گزینه‌ی مناسب را انتخاب کنید.
              <br />
              <strong>{toPersianDigits(pageCount)} صفحه</strong> روی این پلن
              فعال است.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-2">
            <ScopeOption
              value="all_now"
              checked={scope === "all_now"}
              onSelect={setScope}
              title="اعمال فوری روی همه‌ی اشتراک‌های فعلی"
              description="همه‌ی صفحه‌های فعلی این پلن همین حالا با ماتریس جدید بازسازی می‌شوند. قابلیت‌های افزوده‌شده باز و قابلیت‌های حذف‌شده قفل می‌شوند. قابلیت‌های اعطایی توسط ادمین یا کدهای تخفیف دست‌نخورده می‌مانند."
            />
            <ScopeOption
              value="future_only"
              checked={scope === "future_only"}
              onSelect={setScope}
              title="فقط اشتراک‌های جدید و تمدیدها از این لحظه به بعد"
              description="اشتراک‌های فعلی تا پایان دوره‌ی کنونی‌شان بدون تغییر می‌مانند و در تمدید بعدی، ماتریس جدید برای آن‌ها اعمال می‌شود. هیچ صفحه‌ای همین حالا تحت تأثیر قرار نمی‌گیرد."
            />
          </div>

          {state.status === "error" && state.message ? (
            <p className="mt-3 text-xs text-destructive">{state.message}</p>
          ) : null}
          {state.status === "success" && state.message ? (
            <p className="mt-3 text-xs text-emerald-600">{state.message}</p>
          ) : null}
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={pending}>
              {pending
                ? "در حال اعمال…"
                : scope === "all_now"
                  ? `اعمال روی ${toPersianDigits(pageCount)} صفحه`
                  : "اعمال در تمدیدهای بعدی"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ScopeOption({
  value,
  checked,
  onSelect,
  title,
  description,
}: {
  value: Scope;
  checked: boolean;
  onSelect: (s: Scope) => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
        checked
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50",
      )}
    >
      <input
        type="radio"
        name="scope-choice"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="mt-1 size-4 accent-primary"
      />
      <span className="flex flex-col gap-1">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}
