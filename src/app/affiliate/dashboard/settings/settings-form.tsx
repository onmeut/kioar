"use client";

import { useActionState } from "react";

import { CheckCircle2Icon, Loader2Icon, SaveIcon } from "lucide-react";

import { updateBankingAction } from "@/app/affiliate/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { idleState } from "@/lib/action-state";

export function SettingsForm({
  defaults,
}: {
  defaults: {
    sheba: string;
    holderName: string;
    nationalId: string;
    contactEmail: string;
  };
}) {
  const [state, action, pending] = useActionState(
    updateBankingAction,
    idleState,
  );
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};

  return (
    <form
      action={action}
      className="space-y-4"
      onReset={(e) => e.preventDefault()}
    >
      <Field
        id="sheba"
        name="sheba"
        label="شماره شبا"
        hint="با IR شروع بشه و ۲۶ کاراکتر باشه."
        defaultValue={v.sheba ?? defaults.sheba}
        error={fe.sheba?.[0]}
        mono
        autoCapitalize="characters"
      />
      <Field
        id="holderName"
        name="holderName"
        label="نام صاحب حساب"
        defaultValue={v.holderName ?? defaults.holderName}
        error={fe.holderName?.[0]}
        autoComplete="name"
      />
      <Field
        id="nationalId"
        name="nationalId"
        label="کد ملی"
        hint="۱۰ رقم بدون فاصله."
        defaultValue={v.nationalId ?? defaults.nationalId}
        error={fe.nationalId?.[0]}
        mono
        inputMode="numeric"
        maxLength={10}
      />
      <Field
        id="contactEmail"
        name="contactEmail"
        label="ایمیل تماس (اختیاری)"
        hint="برای تماس‌های مهم پشتیبانی همکاری در فروش."
        defaultValue={v.contactEmail ?? defaults.contactEmail}
        error={fe.contactEmail?.[0]}
        type="email"
        inputMode="email"
        autoComplete="email"
        ltr
      />

      {state.status === "error" && state.message ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-900">
          {state.message}
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          <CheckCircle2Icon className="size-4" />
          ذخیره شد.
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-12 w-full rounded-full text-[14px] font-bold sm:w-auto sm:px-8"
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <SaveIcon className="size-4" />
        )}
        ذخیره
      </Button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  hint,
  defaultValue,
  error,
  mono,
  ltr,
  type,
  inputMode,
  maxLength,
  autoComplete,
  autoCapitalize,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  error?: string;
  mono?: boolean;
  ltr?: boolean;
  type?: string;
  inputMode?:
    | "text"
    | "email"
    | "tel"
    | "url"
    | "numeric"
    | "decimal"
    | "search";
  maxLength?: number;
  autoComplete?: string;
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[12px] font-bold text-ink">
        {label}
      </label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        autoCorrect="off"
        spellCheck={false}
        dir={mono || ltr ? "ltr" : undefined}
        className={mono ? "font-mono" : undefined}
      />
      {error ? (
        <p className="text-[11px] text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}
