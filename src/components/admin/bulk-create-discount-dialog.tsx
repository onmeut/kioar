"use client";

/**
 * Phase 7 — bulk discount code creator.
 *
 * Generates N codes that share a single `batch_id`. After success,
 * shows a CSV download link (route handler reads the batch and streams
 * an Excel-friendly UTF-8 BOM file).
 */

import { useActionState, useState } from "react";
import { LayersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

import { bulkCreateDiscountCodesAction } from "@/app/admin/discounts/actions";
import type { BulkCreateResult } from "@/app/admin/discounts/actions";

const PLAN_KEYS = [
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
];
const CYCLES = [
  { value: "monthly", label: "ماهانه" },
  { value: "annual", label: "سالانه" },
];

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}

export function BulkCreateDiscountDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    bulkCreateDiscountCodesAction,
    idleState,
  );
  const [discountType, setDiscountType] = useState<
    "percent" | "fixed_amount" | "free_months"
  >("percent");

  const fieldErr = (k: string) => state.fieldErrors?.[k]?.[0] ?? null;

  const successBatchId =
    state.status === "success" ? ((state as BulkCreateResult).batchId ?? null) : null;
  const successCount =
    state.status === "success" ? ((state as BulkCreateResult).count ?? 0) : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1"
            type="button"
          >
            <LayersIcon className="size-4" />
            ساخت گروهی
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ساخت گروهی کدهای تخفیف</DialogTitle>
        </DialogHeader>

        {successBatchId ? (
          <div className="space-y-4 rounded-3xl border border-emerald-500/40 bg-emerald-500/5 p-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-700">
                {state.message}
              </p>
              <p className="text-xs text-muted-foreground">
                {`${toPersianDigits(successCount)} کد ساخته شد. برای دریافت فایل CSV روی دکمهٔ زیر بزنید.`}
              </p>
              <p
                className="font-mono text-[11px] text-muted-foreground"
                dir="ltr"
              >
                batch: {successBatchId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/admin/discounts/batches/${successBatchId}/csv`}
                download
              >
                <Button type="button" size="sm" className="h-10 gap-1">
                  دانلود CSV
                </Button>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => setOpen(false)}
              >
                بستن
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-5">
            {state.status === "error" && state.message ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {state.message}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bcd-name">نام برنامه</Label>
                <Input
                  id="bcd-name"
                  name="nameFa"
                  required
                  placeholder="کمپین زمستانه"
                />
                <FieldError msg={fieldErr("nameFa")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcd-prefix">پیشوند کد (اختیاری)</Label>
                <Input
                  id="bcd-prefix"
                  name="prefix"
                  dir="ltr"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="WINTER"
                />
                <p className="text-[11px] text-muted-foreground">
                  مثلاً WINTER → WINTER-A4K9PQXR
                </p>
                <FieldError msg={fieldErr("prefix")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bcd-desc">توضیحات</Label>
              <Textarea id="bcd-desc" name="descriptionFa" rows={2} />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bcd-count">تعداد کد</Label>
                <Input
                  id="bcd-count"
                  name="count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  defaultValue={10}
                  required
                />
                <FieldError msg={fieldErr("count")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcd-tlen">طول توکن</Label>
                <Input
                  id="bcd-tlen"
                  name="tokenLength"
                  type="number"
                  inputMode="numeric"
                  min={4}
                  max={24}
                  defaultValue={8}
                />
                <FieldError msg={fieldErr("tokenLength")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcd-cycles">چرخه‌های تکرار</Label>
                <Input
                  id="bcd-cycles"
                  name="recurringCycles"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={120}
                  defaultValue={1}
                />
                <FieldError msg={fieldErr("recurringCycles")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="bcd-type">نوع تخفیف</Label>
                <select
                  id="bcd-type"
                  name="discountType"
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(
                      e.target.value as
                        | "percent"
                        | "fixed_amount"
                        | "free_months",
                    )
                  }
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="percent">درصدی</option>
                  <option value="fixed_amount">مبلغ ثابت</option>
                  <option value="free_months">ماه رایگان</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bcd-amount">
                  {discountType === "percent"
                    ? "درصد (۱ تا ۱۰۰)"
                    : discountType === "fixed_amount"
                      ? "مبلغ (تومان)"
                      : "تعداد ماه"}
                </Label>
                <Input
                  id="bcd-amount"
                  name="amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  required
                />
                <FieldError msg={fieldErr("amount")} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bcd-starts">شروع اعتبار</Label>
                <Input
                  id="bcd-starts"
                  name="startsAt"
                  type="datetime-local"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcd-ends">پایان اعتبار</Label>
                <Input id="bcd-ends" name="endsAt" type="datetime-local" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bcd-mr">سقف کل استفاده‌ها (هر کد)</Label>
                <Input
                  id="bcd-mr"
                  name="maxRedemptions"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="نامحدود"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bcd-mpu">سقف برای هر کاربر</Label>
                <Input
                  id="bcd-mpu"
                  name="maxPerUser"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="نامحدود"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-border p-4">
              <Label className="text-xs text-muted-foreground">
                محدوده پلن‌ها (هیچ‌کدام = همهٔ پلن‌های پولی)
              </Label>
              <div className="flex flex-wrap gap-3">
                {PLAN_KEYS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="appliesToPlanKeys"
                      value={p.value}
                      className="size-4"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              <Label className="mt-2 text-xs text-muted-foreground">
                چرخه‌های صورت‌حساب
              </Label>
              <div className="flex flex-wrap gap-3">
                {CYCLES.map((c) => (
                  <label
                    key={c.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="appliesToBillingCycles"
                      value={c.value}
                      className="size-4"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
              <span className="text-sm">فقط برای کاربران تازه‌وارد</span>
              <Switch name="firstTimeOnly" />
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="bcd-reason">دلیل ساخت گروه</Label>
              <Textarea
                id="bcd-reason"
                name="reason"
                rows={2}
                required
                placeholder="ذکر دلیل برای حسابرسی"
              />
              <FieldError msg={fieldErr("reason")} />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10"
                onClick={() => setOpen(false)}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-10"
                disabled={pending}
              >
                {pending ? "در حال ساخت..." : "ساخت کدها"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
