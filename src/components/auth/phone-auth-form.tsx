"use client";

import { useActionState } from "react";

import { requestOtpAction } from "@/app/auth/actions";
import { idleState } from "@/lib/action-state";
import { formatPhoneDisplay } from "@/lib/phone";
import { BrandMark } from "@/components/shared/brand-mark";
import { SlugInput } from "@/components/shared/slug-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PhoneAuthForm({
  pendingSlug,
}: {
  pendingSlug?: string | null;
}) {
  const [state, formAction] = useActionState(requestOtpAction, idleState);

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col items-center gap-3">
        <BrandMark variant="mark" href="/" className="size-12" />
        <div className="flex flex-col space-y-1 text-center">
          <h1 className="text-2xl font-semibold">
            ورود به حساب
          </h1>
          <p className="text-sm text-muted-foreground">
            شماره موبایل خود را وارد کنید تا کد تایید ارسال شود
          </p>
        </div>
      </div>

      <form action={formAction} className="grid gap-4">
        {pendingSlug ? (
          <div className="grid gap-2">
            <Label htmlFor="handle">نام کاربری</Label>
            <SlugInput
              name="handle"
              defaultValue={pendingSlug}
              autoFocus
              enterKeyHint="next"
              size="sm"
            />
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="phone">شماره موبایل</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="send"
            autoFocus={!pendingSlug}
            dir="ltr"
            placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
            aria-invalid={!!state.fieldErrors?.phone?.[0]}
            aria-describedby={
              state.fieldErrors?.phone?.[0] ? "phone-error" : "phone-hint"
            }
          />
          {state.fieldErrors?.phone?.[0] ? (
            <p id="phone-error" className="text-sm text-destructive">
              {state.fieldErrors.phone[0]}
            </p>
          ) : (
            <p id="phone-hint" className="text-xs text-muted-foreground">
              با پیش‌شماره ایران — مثال: {formatPhoneDisplay("+989121234567")}
            </p>
          )}
        </div>

        {state.message &&
        state.status === "error" &&
        !state.fieldErrors?.phone?.[0] ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : null}

        <SubmitButton
          type="submit"
          className="w-full py-3"
          pendingLabel="در حال ارسال..."
        >
          ورود با پیامک
        </SubmitButton>
      </form>
    </div>
  );
}
