"use client";

import { useActionState, useState } from "react";
import { CalendarPlusIcon, RefreshCcwIcon } from "lucide-react";

import {
  adminExtendPeriodAction,
  adminManualPlanChangeAction,
} from "@/app/admin/billing/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";

type PlanOption = {
  key: "free" | "pro" | "business";
  nameFa: string;
};

type Props = {
  pageId: string;
  currentPlanKey: "free" | "pro" | "business";
  currentBillingCycle: "monthly" | "annual";
  plans: PlanOption[];
};

export function SubscriptionActions({
  pageId,
  currentPlanKey,
  currentBillingCycle,
  plans,
}: Props) {
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendState, extendAction, extendPending] = useActionState(
    adminExtendPeriodAction,
    idleState,
  );
  const [planOpen, setPlanOpen] = useState(false);
  const [planState, planAction, planPending] = useActionState(
    adminManualPlanChangeAction,
    idleState,
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" className="h-9 gap-1">
              <CalendarPlusIcon className="size-4" />
              تمدید دوره
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <form action={extendAction}>
            <input type="hidden" name="pageId" value={pageId} />
            <DialogHeader>
              <DialogTitle>تمدید دستی دوره</DialogTitle>
              <DialogDescription>
                دوره جاری به تعداد روز انتخاب‌شده افزایش می‌یابد. اگر اشتراک در
                حالت مهلت پرداخت یا منقضی است، به وضعیت فعال بازمی‌گردد.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div>
                <Label htmlFor="days">تعداد روز</Label>
                <Input
                  type="number"
                  name="days"
                  id="days"
                  required
                  inputMode="numeric"
                  min={1}
                  max={365}
                  defaultValue={30}
                />
              </div>
              <div>
                <Label htmlFor="extend-reason">دلیل</Label>
                <Textarea
                  name="reason"
                  id="extend-reason"
                  required
                  rows={3}
                  placeholder="مثلاً: جبران اختلال سرویس"
                />
              </div>
              {extendState.status === "error" && extendState.message ? (
                <p className="text-xs text-destructive">
                  {extendState.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={extendPending}>
                {extendPending ? "در حال ثبت…" : "تمدید"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" className="h-9 gap-1">
              <RefreshCcwIcon className="size-4" />
              تغییر پلن
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <form action={planAction}>
            <input type="hidden" name="pageId" value={pageId} />
            <DialogHeader>
              <DialogTitle>تغییر دستی پلن</DialogTitle>
              <DialogDescription>
                پلن صفحه فوراً تغییر می‌کند، قابلیت‌ها بازسازی می‌شوند و دوره
                جدید از همین لحظه شروع می‌شود (به‌جز انتخاب همان پلن قبلی).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div>
                <Label htmlFor="planKey">پلن مقصد</Label>
                <select
                  name="planKey"
                  id="planKey"
                  required
                  defaultValue={currentPlanKey}
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm md:h-9"
                >
                  {plans.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.nameFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="billingCycle">چرخه</Label>
                <select
                  name="billingCycle"
                  id="billingCycle"
                  defaultValue={currentBillingCycle}
                  className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm md:h-9"
                >
                  <option value="monthly">ماهانه</option>
                  <option value="annual">سالانه</option>
                </select>
              </div>
              <div>
                <Label htmlFor="plan-reason">
                  دلیل{" "}
                  <span className="text-muted-foreground text-xs">
                    (اختیاری)
                  </span>
                </Label>
                <Textarea
                  name="reason"
                  id="plan-reason"
                  rows={3}
                  placeholder="مثلاً: انتقال دستی از پلن قدیمی"
                />
              </div>
              {planState.status === "error" && planState.message ? (
                <p className="text-xs text-destructive">{planState.message}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={planPending}>
                {planPending ? "در حال ثبت…" : "اعمال تغییر"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
