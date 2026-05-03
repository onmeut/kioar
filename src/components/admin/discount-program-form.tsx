"use client";

/**
 * Phase 11 — admin discount program form (create + edit).
 *
 * Fed by `upsertDiscountCodeAction`. The same form handles both
 * create and edit: when `existing` is `null` we render a blank form,
 * otherwise we pre-fill every field. Empty string values for nullable
 * fields are sent as-is and treated as `null` server-side.
 *
 * Field layout follows the screenshot pattern of the Linktree-style
 * "Discount Programs" admin UI: name + code at the top, then type +
 * amount, then validity window, caps, plan/cycle scoping, recurring.
 */

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { idleState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

import { upsertDiscountCodeAction } from "@/app/admin/discounts/actions";

export type DiscountFormValues = {
  id: string | null;
  code: string;
  nameFa: string;
  descriptionFa: string | null;
  discountType: "percent" | "fixed_amount" | "free_months";
  amount: number;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  maxPerUser: number | null;
  firstTimeOnly: boolean;
  appliesToPlanKeys: string[] | null;
  appliesToBillingCycles: string[] | null;
  recurringCycles: number;
  isActive: boolean;
};

type Props = {
  existing: DiscountFormValues | null;
  onCancel?: () => void;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` (no tz).
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function DiscountProgramForm({ existing, onCancel }: Props) {
  const [state, action] = useActionState(upsertDiscountCodeAction, idleState);

  const [discountType, setDiscountType] = useState<
    DiscountFormValues["discountType"]
  >(existing?.discountType ?? "percent");

  const fieldErr = (key: string) => state.fieldErrors?.[key]?.[0] ?? null;

  return (
    <form
      action={action}
      className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-sm"
      onReset={(e) => e.preventDefault()}
    >
      {existing?.id ? (
        <input type="hidden" name="id" value={existing.id} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="df-code">کد</Label>
          <Input
            id="df-code"
            name="code"
            dir="ltr"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={existing?.code ?? ""}
            placeholder="WELCOME20"
            required
          />
          <FieldError msg={fieldErr("code")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="df-name">نام برنامه</Label>
          <Input
            id="df-name"
            name="nameFa"
            defaultValue={existing?.nameFa ?? ""}
            placeholder="تخفیف خوش‌آمدگویی"
            required
          />
          <FieldError msg={fieldErr("nameFa")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="df-desc">توضیحات</Label>
        <Textarea
          id="df-desc"
          name="descriptionFa"
          defaultValue={existing?.descriptionFa ?? ""}
          rows={2}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="df-type">نوع تخفیف</Label>
          <select
            id="df-type"
            name="discountType"
            defaultValue={existing?.discountType ?? "percent"}
            onChange={(e) =>
              setDiscountType(
                e.target.value as DiscountFormValues["discountType"],
              )
            }
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="percent">درصدی</option>
            <option value="fixed_amount">مبلغ ثابت</option>
            <option value="free_months">ماه‌های رایگان</option>
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="df-amount">
            {discountType === "percent"
              ? "درصد (۱ تا ۱۰۰)"
              : discountType === "fixed_amount"
                ? "مبلغ (تومان)"
                : "تعداد ماه"}
          </Label>
          <Input
            id="df-amount"
            name="amount"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={existing?.amount ?? ""}
            required
          />
          <FieldError msg={fieldErr("amount")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="df-starts">شروع اعتبار</Label>
          <Input
            id="df-starts"
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(existing?.startsAt ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="df-ends">پایان اعتبار</Label>
          <Input
            id="df-ends"
            name="endsAt"
            type="datetime-local"
            defaultValue={toLocalInput(existing?.endsAt ?? null)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="df-maxr">سقف کل (خالی = نامحدود)</Label>
          <Input
            id="df-maxr"
            name="maxRedemptions"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={existing?.maxRedemptions ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="df-maxu">سقف هر کاربر</Label>
          <Input
            id="df-maxu"
            name="maxPerUser"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={existing?.maxPerUser ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="df-cycles">چرخه‌های تکرار</Label>
          <Input
            id="df-cycles"
            name="recurringCycles"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={existing?.recurringCycles ?? 1}
            required
          />
          <p className="text-[11px] text-muted-foreground">
            ۱ یعنی فقط اولین فاکتور؛ ۱۲ یعنی این فاکتور + ۱۱ تمدید بعدی.
          </p>
        </div>
      </div>

      <fieldset className="space-y-2 rounded-2xl border border-dashed border-border p-3">
        <legend className="px-2 text-xs text-muted-foreground">
          محدوده اعمال
        </legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <CheckboxField
            name="appliesToPlanKeys"
            value="pro"
            label="پلن Pro"
            defaultChecked={
              existing?.appliesToPlanKeys?.includes("pro") ?? false
            }
          />
          <CheckboxField
            name="appliesToPlanKeys"
            value="business"
            label="پلن Business"
            defaultChecked={
              existing?.appliesToPlanKeys?.includes("business") ?? false
            }
          />
          <CheckboxField
            name="appliesToBillingCycles"
            value="monthly"
            label="ماهانه"
            defaultChecked={
              existing?.appliesToBillingCycles?.includes("monthly") ?? false
            }
          />
          <CheckboxField
            name="appliesToBillingCycles"
            value="annual"
            label="سالانه"
            defaultChecked={
              existing?.appliesToBillingCycles?.includes("annual") ?? false
            }
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          اگر هیچ‌کدام انتخاب نشود، روی همه پلن‌ها/چرخه‌ها اعمال می‌شود.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3 text-sm">
          <span>فقط برای اولین خرید</span>
          <Switch
            name="firstTimeOnly"
            defaultChecked={existing?.firstTimeOnly ?? false}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3 text-sm">
          <span>فعال</span>
          <Switch name="isActive" defaultChecked={existing?.isActive ?? true} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11">
          {existing?.id ? "ذخیره تغییرات" : "ایجاد کد"}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={onCancel}
          >
            انصراف
          </Button>
        ) : null}
        {state.message ? (
          <p
            className={cn(
              "text-xs",
              state.status === "success"
                ? "text-emerald-700"
                : "text-destructive",
            )}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function CheckboxField({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="size-4 rounded border-input"
      />
      <span>{label}</span>
    </label>
  );
}

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive">{msg}</p>;
}
