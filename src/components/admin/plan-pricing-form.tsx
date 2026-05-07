"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { adminUpdatePlanPricingAction } from "@/app/admin/billing/plans-pricing/actions";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";
import { toPersianDigits } from "@/lib/persian";

type Props = {
  planId: string;
  planKey: "free" | "pro" | "business";
  planNameFa: string;
  priceMonthlyToman: number;
  priceAnnualToman: number;
  annualDiscountPercent: number | null;
  activeCount: number;
};

function fmtToman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${toPersianDigits(n.toLocaleString("en-US"))} تومان`;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(95, Math.round(n)));
}

function computeAnnualFromPercent(monthly: number, percent: number): number {
  const raw = monthly * 12 * (1 - percent / 100);
  return Math.max(0, Math.round(raw));
}

function backComputePercent(monthly: number, annual: number): number {
  if (monthly <= 0) return 0;
  const full = monthly * 12;
  if (annual >= full) return 0;
  return Math.round(((full - annual) / full) * 100);
}

export function PlanPricingForm({
  planId,
  planKey,
  planNameFa,
  priceMonthlyToman,
  priceAnnualToman,
  annualDiscountPercent,
  activeCount,
}: Props) {
  const [monthly, setMonthly] = useState(String(priceMonthlyToman));
  const [annual, setAnnual] = useState(String(priceAnnualToman));
  const [computeFromPercent, setComputeFromPercent] = useState(
    annualDiscountPercent !== null && annualDiscountPercent > 0,
  );
  const [percent, setPercent] = useState(
    String(
      annualDiscountPercent ??
        backComputePercent(priceMonthlyToman, priceAnnualToman),
    ),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [policy, setPolicy] = useState<"always_current" | "grandfather">(
    "always_current",
  );
  const [notify, setNotify] = useState(false);
  const [reason, setReason] = useState("");

  const monthlyN = Number.parseInt(monthly || "0", 10) || 0;
  const annualN = Number.parseInt(annual || "0", 10) || 0;
  const percentN = clampPercent(Number.parseInt(percent || "0", 10) || 0);

  // When toggle is ON, derive annual from monthly + %.
  useEffect(() => {
    if (computeFromPercent) {
      const next = computeAnnualFromPercent(monthlyN, percentN);
      setAnnual(String(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeFromPercent, monthlyN, percentN]);

  const dirty = useMemo(() => {
    const samePct =
      (annualDiscountPercent ?? null) ===
      (computeFromPercent ? percentN : null);
    return (
      monthlyN !== priceMonthlyToman ||
      annualN !== priceAnnualToman ||
      !samePct
    );
  }, [
    monthlyN,
    annualN,
    percentN,
    computeFromPercent,
    priceMonthlyToman,
    priceAnnualToman,
    annualDiscountPercent,
  ]);

  const annualSavings = monthlyN * 12 - annualN;
  const annualSavingsPercent = backComputePercent(monthlyN, annualN);

  const [state, action, pending] = useActionState(
    adminUpdatePlanPricingAction,
    idleState,
  );

  // Close dialog on success.
  useEffect(() => {
    if (state.status === "success") {
      setConfirmOpen(false);
      setReason("");
    }
  }, [state.status, state.message]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`monthly-${planId}`}>ماهانه (تومان)</Label>
          <Input
            id={`monthly-${planId}`}
            value={monthly}
            onChange={(e) =>
              setMonthly(e.target.value.replace(/[^\d]/g, ""))
            }
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
          />
          <p className="text-[11px] text-muted-foreground" dir="ltr">
            {fmtToman(monthlyN)}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`annual-${planId}`}>سالانه (تومان)</Label>
          <Input
            id={`annual-${planId}`}
            value={annual}
            onChange={(e) => setAnnual(e.target.value.replace(/[^\d]/g, ""))}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            disabled={computeFromPercent}
          />
          <p className="text-[11px] text-muted-foreground" dir="ltr">
            {fmtToman(annualN)}
            {monthlyN > 0 && annualN > 0 && annualN < monthlyN * 12
              ? ` — صرفه‌جویی ${toPersianDigits(annualSavingsPercent)}٪`
              : ""}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor={`compute-${planId}`} className="text-sm">
              محاسبه‌ی سالانه از درصد تخفیف
            </Label>
            <p className="text-[11px] text-muted-foreground">
              وقتی روشن باشد، عدد سالانه از ماهانه × ۱۲ × (۱ − درصد) محاسبه
              می‌شود.
            </p>
          </div>
          <Switch
            id={`compute-${planId}`}
            checked={computeFromPercent}
            onCheckedChange={setComputeFromPercent}
          />
        </div>
        {computeFromPercent ? (
          <div className="space-y-1.5">
            <Label htmlFor={`percent-${planId}`}>درصد تخفیف سالانه</Label>
            <Input
              id={`percent-${planId}`}
              value={percent}
              onChange={(e) =>
                setPercent(e.target.value.replace(/[^\d]/g, ""))
              }
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              className="max-w-32"
            />
            <p className="text-[11px] text-muted-foreground">
              معادل صرفه‌جویی{" "}
              {toPersianDigits(monthlyN * 12 - annualN > 0 ? annualSavings : 0)}{" "}
              تومان در سال.
            </p>
          </div>
        ) : null}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              disabled={!dirty || pending}
              className="w-full sm:w-auto"
            >
              ذخیره‌ی تغییرات
            </Button>
          }
        />
        <DialogContent className="sm:max-w-lg">
          <form action={action}>
            <input type="hidden" name="planId" value={planId} />
            <input
              type="hidden"
              name="priceMonthlyToman"
              value={String(monthlyN)}
            />
            <input
              type="hidden"
              name="priceAnnualToman"
              value={String(annualN)}
            />
            <input
              type="hidden"
              name="annualDiscountPercent"
              value={computeFromPercent ? String(percentN) : ""}
            />
            <input type="hidden" name="policy" value={policy} />
            <input
              type="hidden"
              name="notifySubscribers"
              value={notify ? "on" : "off"}
            />

            <DialogHeader>
              <DialogTitle>تأیید تغییر قیمت «{planNameFa}»</DialogTitle>
              <DialogDescription>
                {toPersianDigits(activeCount)} اشتراک فعال روی این پلن وجود
                دارد. لطفاً سیاست اعمال را انتخاب کنید.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">قیمت قبلی ماهانه</div>
                  <div className="font-mono" dir="ltr">
                    {fmtToman(priceMonthlyToman)}
                  </div>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">قیمت جدید ماهانه</div>
                  <div className="font-mono" dir="ltr">
                    {fmtToman(monthlyN)}
                  </div>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">قیمت قبلی سالانه</div>
                  <div className="font-mono" dir="ltr">
                    {fmtToman(priceAnnualToman)}
                  </div>
                </div>
                <div className="rounded-md border border-border p-2">
                  <div className="text-muted-foreground">قیمت جدید سالانه</div>
                  <div className="font-mono" dir="ltr">
                    {fmtToman(annualN)}
                  </div>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  سیاست اعمال
                </legend>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
                  <input
                    type="radio"
                    name="policy_radio"
                    value="always_current"
                    checked={policy === "always_current"}
                    onChange={() => setPolicy("always_current")}
                    className="mt-1"
                  />
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium">
                      همه به قیمت جدید (پیش‌فرض)
                    </div>
                    <p className="text-xs text-muted-foreground">
                      هر اشتراک فعلی در تجدید بعدی قیمت جدید را خواهد پرداخت.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40">
                  <input
                    type="radio"
                    name="policy_radio"
                    value="grandfather"
                    checked={policy === "grandfather"}
                    onChange={() => setPolicy("grandfather")}
                    className="mt-1"
                  />
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium">
                      قفل قیمت قدیم برای {toPersianDigits(activeCount)} اشتراک
                      فعلی
                    </div>
                    <p className="text-xs text-muted-foreground">
                      برای هر اشتراک فعال یک ردیف در{" "}
                      <code dir="ltr">subscription_price_locks</code> ساخته
                      می‌شود تا تجدیدش با قیمت قدیم انجام شود. اشتراک‌های
                      جدید قیمت جدید را می‌بینند.
                    </p>
                  </div>
                </label>
              </fieldset>

              {policy === "always_current" ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={`notify-${planId}`}
                      className="text-sm"
                    >
                      اطلاع‌رسانی پیامکی به مشترکان
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      ارسال پیامک «اعلام تغییر قیمت» به همه‌ی مشترکان فعال این
                      پلن. (نیازمند فعال‌بودن قالب{" "}
                      <code dir="ltr">price_change_notice</code>)
                    </p>
                  </div>
                  <Switch
                    id={`notify-${planId}`}
                    checked={notify}
                    onCheckedChange={setNotify}
                  />
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor={`reason-${planId}`}>دلیل</Label>
                <Textarea
                  id={`reason-${planId}`}
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="مثلاً: همسویی با تورم سالانه"
                />
              </div>

              {state.status === "error" && state.message ? (
                <p className="text-xs text-destructive">{state.message}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                انصراف
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "در حال اعمال…" : "تأیید و اعمال"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {state.status === "success" && state.message ? (
        <p className="text-xs text-emerald-700">{state.message}</p>
      ) : null}
      {/* planKey is used to disambiguate which plan in audit metadata; keep accessible. */}
      <span className="sr-only" data-plan-key={planKey} />
    </div>
  );
}
