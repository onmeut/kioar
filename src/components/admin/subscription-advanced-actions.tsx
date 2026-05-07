"use client";

/**
 * Phase 8 — advanced subscription actions for /admin/billing/pages/[pageId].
 *
 * Force-expire, set/remove price-lock, apply discount to next renewal.
 * Each action runs through an admin server action with required reason
 * and lands a row in `admin_audit_log`.
 */

import { useActionState, useState } from "react";
import {
  AlertTriangleIcon,
  LockIcon,
  TicketIcon,
  UnlockIcon,
} from "lucide-react";

import {
  adminApplyDiscountToNextRenewalAction,
  adminForceExpireSubscriptionAction,
  adminRemovePriceLockAction,
  adminSetPriceLockAction,
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
import {
  formatPersianDateTime,
  formatPersianNumber,
  toPersianDigits,
} from "@/lib/persian";

export type PriceLockSummary = {
  lockedMonthlyToman: number;
  lockedAnnualToman: number;
  reason: string | null;
  lockedAt: string;
};

export type DiscountOption = {
  id: string;
  code: string;
  nameFa: string;
};

type Props = {
  pageId: string;
  planKey: "free" | "pro" | "business";
  planMonthlyToman: number;
  planAnnualToman: number;
  priceLock: PriceLockSummary | null;
  discountOptions: DiscountOption[];
  pendingDiscountCode: string | null;
};

export function SubscriptionAdvancedActions({
  pageId,
  planKey,
  planMonthlyToman,
  planAnnualToman,
  priceLock,
  discountOptions,
  pendingDiscountCode,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <ForceExpireDialog pageId={pageId} disabled={planKey === "free"} />
      <PriceLockDialog
        pageId={pageId}
        planKey={planKey}
        planMonthlyToman={planMonthlyToman}
        planAnnualToman={planAnnualToman}
        priceLock={priceLock}
      />
      <ApplyDiscountDialog
        pageId={pageId}
        discountOptions={discountOptions}
        pendingDiscountCode={pendingDiscountCode}
      />
    </div>
  );
}

function ForceExpireDialog({
  pageId,
  disabled,
}: {
  pageId: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    adminForceExpireSubscriptionAction,
    idleState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1 text-destructive hover:bg-destructive/10"
            type="button"
            disabled={disabled}
          >
            <AlertTriangleIcon className="size-4" />
            انقضای اجباری
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form action={action}>
          <input type="hidden" name="pageId" value={pageId} />
          <DialogHeader>
            <DialogTitle>انقضای اجباری اشتراک</DialogTitle>
            <DialogDescription>
              اشتراک به‌فوریت منقضی می‌شود، دوره به این لحظه می‌رسد و
              قابلیت‌های پلن پولی برداشته می‌شوند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="fe-reason">دلیل</Label>
              <Textarea
                id="fe-reason"
                name="reason"
                required
                rows={3}
                placeholder="مثلاً: نقض شرایط استفاده"
              />
            </div>
            {state.status === "error" && state.message ? (
              <p className="text-xs text-destructive">{state.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending}
            >
              {pending ? "در حال ثبت…" : "تأیید انقضا"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PriceLockDialog({
  pageId,
  planKey,
  planMonthlyToman,
  planAnnualToman,
  priceLock,
}: {
  pageId: string;
  planKey: "free" | "pro" | "business";
  planMonthlyToman: number;
  planAnnualToman: number;
  priceLock: PriceLockSummary | null;
}) {
  const [open, setOpen] = useState(false);
  const [setState, setAction, setPending] = useActionState(
    adminSetPriceLockAction,
    idleState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    adminRemovePriceLockAction,
    idleState,
  );

  const disabled = planKey === "free";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1"
            type="button"
            disabled={disabled}
          >
            {priceLock ? (
              <LockIcon className="size-4 text-amber-600" />
            ) : (
              <LockIcon className="size-4" />
            )}
            {priceLock ? "ویرایش قفل قیمت" : "قفل قیمت"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>قفل قیمت اشتراک</DialogTitle>
          <DialogDescription>
            قیمت پلن این صفحه را روی مقدار دلخواه قفل می‌کنید. تمدیدها و
            تغییر چرخه‌ها از این مقدار استفاده می‌کنند تا زمانی که قفل برداشته
            شود یا پلن دستی عوض شود.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-2xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            قیمت فهرست پلن فعلی:{" "}
            {`${toPersianDigits(formatPersianNumber(planMonthlyToman))} / ${toPersianDigits(formatPersianNumber(planAnnualToman))} تومان`}
          </p>
          {priceLock ? (
            <>
              <p>
                قفل فعلی:{" "}
                {`${toPersianDigits(formatPersianNumber(priceLock.lockedMonthlyToman))} / ${toPersianDigits(formatPersianNumber(priceLock.lockedAnnualToman))} تومان`}
              </p>
              <p>
                ثبت‌شده: {formatPersianDateTime(new Date(priceLock.lockedAt))}
              </p>
              {priceLock.reason ? <p>دلیل: {priceLock.reason}</p> : null}
            </>
          ) : (
            <p>هیچ قفل قیمتی برای این صفحه ثبت نشده است.</p>
          )}
        </div>

        <form action={setAction} className="space-y-3 pt-3">
          <input type="hidden" name="pageId" value={pageId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="lock-monthly">قیمت ماهانه (تومان)</Label>
              <Input
                id="lock-monthly"
                name="lockedMonthlyToman"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={priceLock?.lockedMonthlyToman ?? planMonthlyToman}
                required
              />
            </div>
            <div>
              <Label htmlFor="lock-annual">قیمت سالانه (تومان)</Label>
              <Input
                id="lock-annual"
                name="lockedAnnualToman"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={priceLock?.lockedAnnualToman ?? planAnnualToman}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lock-reason">دلیل</Label>
            <Textarea
              id="lock-reason"
              name="reason"
              required
              rows={3}
              placeholder="مثلاً: تخفیف قیمت برای کاربر دیرپا"
            />
          </div>
          {setState.status === "error" && setState.message ? (
            <p className="text-xs text-destructive">{setState.message}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="submit" disabled={setPending}>
              {setPending
                ? "در حال ثبت…"
                : priceLock
                  ? "به‌روزرسانی قفل"
                  : "ثبت قفل"}
            </Button>
          </div>
        </form>

        {priceLock ? (
          <form action={removeAction} className="space-y-3 border-t border-border pt-4">
            <input type="hidden" name="pageId" value={pageId} />
            <div>
              <Label htmlFor="lock-remove-reason">دلیل حذف قفل</Label>
              <Textarea
                id="lock-remove-reason"
                name="reason"
                required
                rows={2}
              />
            </div>
            {removeState.status === "error" && removeState.message ? (
              <p className="text-xs text-destructive">{removeState.message}</p>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                className="gap-1"
                disabled={removePending}
              >
                <UnlockIcon className="size-4" />
                {removePending ? "در حال ثبت…" : "حذف قفل قیمت"}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ApplyDiscountDialog({
  pageId,
  discountOptions,
  pendingDiscountCode,
}: {
  pageId: string;
  discountOptions: DiscountOption[];
  pendingDiscountCode: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    adminApplyDiscountToNextRenewalAction,
    idleState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="h-9 gap-1" type="button">
            <TicketIcon className="size-4" />
            اعمال تخفیف بر تمدید بعدی
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form action={action}>
          <input type="hidden" name="pageId" value={pageId} />
          <DialogHeader>
            <DialogTitle>اعمال کد تخفیف بر تمدید بعدی</DialogTitle>
            <DialogDescription>
              کد انتخاب‌شده در فاکتور تمدید بعدی این صفحه به‌طور خودکار اعمال
              می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {pendingDiscountCode ? (
              <p className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700">
                کد فعلی در صف:{" "}
                <span className="font-mono" dir="ltr">
                  {pendingDiscountCode}
                </span>
                {" "}— انتخاب کد جدید جای آن را می‌گیرد.
              </p>
            ) : null}
            <div>
              <Label htmlFor="ad-code">کد تخفیف</Label>
              <select
                id="ad-code"
                name="discountCodeId"
                required
                className="mt-1 h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm md:h-9"
              >
                <option value="">— انتخاب کنید —</option>
                {discountOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.nameFa}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ad-reason">دلیل</Label>
              <Textarea id="ad-reason" name="reason" required rows={3} />
            </div>
            {state.status === "error" && state.message ? (
              <p className="text-xs text-destructive">{state.message}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "در حال ثبت…" : "ثبت کد"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
