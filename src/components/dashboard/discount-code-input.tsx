"use client";

/**
 * Phase 11 — discount code input client island.
 *
 * Two-step UX:
 *
 *   1. User types a code, picks a target plan + cycle from the props,
 *      hits "اعمال" → POSTs to `/api/billing/discount/validate`. The
 *      server returns either a price preview or a Persian error
 *      message keyed off `errorCode`.
 *
 *   2. On a successful preview, "ادامه به پرداخت" POSTs to
 *      `/api/billing/checkout` with the code field populated. The user
 *      is redirected to Zarinpal (or to a paid-thank-you when the code
 *      brings the total to zero).
 *
 * The component is intentionally low-noise: it does NOT replicate the
 * full plan picker (that lives in `BillingActionsCard`). It's a
 * focused tool for redeeming a single code against a specific plan,
 * matching the screenshot pattern of "صورت‌حساب صفحه › کد تخفیف".
 */

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPersianNumber, toPersianDigits } from "@/lib/persian";

export type DiscountCodeInputPlan = {
  id: string;
  key: "pro" | "business";
  nameFa: string;
  priceMonthlyToman: number;
  priceAnnualToman: number;
};

type Props = {
  pageId: string;
  /** Active paid plans, sourced from the registry. */
  plans: DiscountCodeInputPlan[];
};

type Preview = {
  nameFa: string;
  discountType: "percent" | "fixed_amount" | "free_months";
  freeMonths: number;
  subtotalToman: number;
  discountAmountToman: number;
  vatToman: number;
  totalToman: number;
};

function formatToman(value: number) {
  return toPersianDigits(formatPersianNumber(value));
}

export function DiscountCodeInput({ pageId, plans }: Props) {
  const [code, setCode] = useState("");
  const [planKey, setPlanKey] = useState<"pro" | "business">(
    plans[0]?.key ?? "pro",
  );
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setPreview(null);
    setError(null);
  };

  const handleApply = () => {
    if (!code.trim()) return;
    reset();
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/discount/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pageId,
            planKey,
            billingCycle: cycle,
            code: code.trim(),
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | (Preview & { ok: true })
          | { ok: false; errorCode: string; message: string }
          | { error: string }
          | null;

        if (!res.ok || !data) {
          setError("ارتباط با سرور برقرار نشد.");
          return;
        }
        if ("error" in data) {
          setError("درخواست نامعتبر است.");
          return;
        }
        if (data.ok === false) {
          setError(data.message ?? "کد تخفیف نامعتبر است.");
          return;
        }
        setPreview(data);
      } catch (err) {
        setError(`ارتباط با سرور برقرار نشد: ${(err as Error).message}`);
      }
    });
  };

  const handleCheckout = () => {
    if (!preview) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pageId,
            planKey,
            billingCycle: cycle,
            discountCode: code.trim(),
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; redirectUrl: string }
          | { error: string; message?: string }
          | null;

        if (!res.ok || !data || (data as { ok?: boolean }).ok !== true) {
          const msg =
            (data && "message" in data && data.message) ||
            (data && "error" in data && data.error) ||
            "خطای ناشناخته";
          toast.error(`عملیات انجام نشد: ${msg}`);
          return;
        }
        if ("redirectUrl" in data && typeof data.redirectUrl === "string") {
          window.location.href = data.redirectUrl;
        }
      } catch (err) {
        toast.error(`ارتباط با سرور برقرار نشد: ${(err as Error).message}`);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">کد تخفیف</CardTitle>
        <p className="mt-1 text-xs text-zinc-500">
          اگر کد تخفیف دارید، وارد کنید تا روی پلن انتخابی شما اعمال شود.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="discount-plan">پلن</Label>
            <Select
              value={planKey}
              onValueChange={(v) => {
                setPlanKey(v as "pro" | "business");
                reset();
              }}
            >
              <SelectTrigger id="discount-plan" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.key}>
                    {p.nameFa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>چرخه</Label>
            <Tabs
              value={cycle}
              onValueChange={(v) => {
                setCycle(v as "monthly" | "annual");
                reset();
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="monthly">ماهانه</TabsTrigger>
                <TabsTrigger value="annual">سالانه</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount-code">کد تخفیف</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="discount-code"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              enterKeyHint="go"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                reset();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApply();
                }
              }}
              placeholder="WELCOME20"
              className="h-11 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:w-auto"
              disabled={!code.trim() || isPending}
              onClick={handleApply}
            >
              {isPending && !preview ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                "اعمال"
              )}
            </Button>
          </div>
          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {preview ? (
          <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-semibold text-emerald-800">
              کد «{preview.nameFa}» اعمال شد.
            </p>
            <div className="space-y-1 text-xs text-emerald-900">
              <Row
                label="مبلغ پلن"
                value={`${formatToman(preview.subtotalToman)} تومان`}
              />
              <Row
                label="تخفیف"
                value={`- ${formatToman(preview.discountAmountToman)} تومان`}
              />
              {preview.vatToman > 0 ? (
                <Row
                  label="مالیات"
                  value={`${formatToman(preview.vatToman)} تومان`}
                />
              ) : null}
              {preview.discountType === "free_months" &&
              preview.freeMonths > 0 ? (
                <Row
                  label="ماه رایگان"
                  value={`${toPersianDigits(preview.freeMonths)} ماه`}
                />
              ) : null}
              <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2 text-sm font-semibold">
                <span>قابل پرداخت</span>
                <span dir="ltr">{formatToman(preview.totalToman)} تومان</span>
              </div>
            </div>
            <Button
              type="button"
              className="mt-2 h-11 w-full"
              onClick={handleCheckout}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : preview.totalToman === 0 ? (
                "اعمال رایگان و فعال‌سازی"
              ) : (
                "ادامه به پرداخت"
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-emerald-700">{label}</span>
      <span dir="ltr" className="font-medium">
        {value}
      </span>
    </div>
  );
}
