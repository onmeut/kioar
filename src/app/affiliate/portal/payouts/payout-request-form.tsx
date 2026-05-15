"use client";

import { useActionState } from "react";

import { Loader2Icon, BanknoteIcon } from "lucide-react";

import { requestPayoutAction } from "@/app/affiliate/portal/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { idleState } from "@/lib/action-state";

export function PayoutRequestForm({
  eligible,
  defaults,
}: {
  eligible: boolean;
  defaults: { sheba: string; holderName: string; nationalId: string };
}) {
  const [state, action, pending] = useActionState(
    requestPayoutAction,
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
      <div className="space-y-1.5">
        <label htmlFor="sheba" className="text-[12px] font-bold text-ink">
          شماره شبا
        </label>
        <Input
          id="sheba"
          name="sheba"
          defaultValue={v.sheba ?? defaults.sheba}
          placeholder="IR..."
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          inputMode="text"
          enterKeyHint="next"
          className="font-mono"
          required
        />
        {fe.sheba ? (
          <p className="text-[11px] text-rose-600">{fe.sheba[0]}</p>
        ) : (
          <p className="text-[11px] text-ink-soft">
            با IR شروع بشه و ۲۶ کاراکتر باشه.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="holderName" className="text-[12px] font-bold text-ink">
          نام کامل صاحب حساب
        </label>
        <Input
          id="holderName"
          name="holderName"
          defaultValue={v.holderName ?? defaults.holderName}
          autoComplete="name"
          enterKeyHint="next"
          required
        />
        {fe.holderName ? (
          <p className="text-[11px] text-rose-600">{fe.holderName[0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="nationalId" className="text-[12px] font-bold text-ink">
          کد ملی صاحب حساب
        </label>
        <Input
          id="nationalId"
          name="nationalId"
          defaultValue={v.nationalId ?? defaults.nationalId}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          dir="ltr"
          maxLength={10}
          enterKeyHint="send"
          required
        />
        {fe.nationalId ? (
          <p className="text-[11px] text-rose-600">{fe.nationalId[0]}</p>
        ) : (
          <p className="text-[11px] text-ink-soft">
            برای ثبت رسمی واریز لازمه. ۱۰ رقم بدون فاصله.
          </p>
        )}
      </div>

      {state.status === "error" && state.message ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-900">
          {state.message}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={!eligible || pending}
        className="h-12 w-full rounded-full text-[14px] font-bold"
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <BanknoteIcon className="size-4" />
        )}
        {pending
          ? "در حال ارسال…"
          : eligible
            ? "درخواست تسویه‌ی کل موجودی"
            : "موجودی کافی نداری"}
      </Button>

      <p className="text-[11px] leading-6 text-ink-soft">
        کل موجودی قابل برداشت در یک درخواست تسویه می‌شه. ظرف ۲ تا ۵ روز کاری به
        حسابت واریز و کد رهگیری برات پیامک می‌شه.
      </p>
    </form>
  );
}
