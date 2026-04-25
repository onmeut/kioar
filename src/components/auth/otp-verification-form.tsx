"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowRightIcon, RotateCcwIcon } from "lucide-react";

import { resendOtpAction, verifyOtpAction } from "@/app/auth/actions";
import { idleState } from "@/lib/action-state";
import { formatPhoneDisplay } from "@/lib/phone";
import { toPersianDigits } from "@/lib/persian";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

function useNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
}

export function OtpVerificationForm({
  phone,
  initialCooldownUntil,
}: {
  phone: string;
  initialCooldownUntil?: number;
}) {
  const [verifyState, verifyAction] = useActionState(
    verifyOtpAction,
    idleState,
  );
  const [resendState, resendAction] = useActionState(
    resendOtpAction,
    idleState,
  );
  const cooldownUntil = resendState.cooldownUntil ?? initialCooldownUntil ?? 0;
  const now = useNow();
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold">کد تایید</h1>
        <p className="text-sm text-muted-foreground">
          کد ۶ رقمی ارسال شده به{" "}
          <span dir="ltr" className="font-semibold text-foreground">
            {formatPhoneDisplay(phone)}
          </span>{" "}
          را وارد کنید
        </p>
      </div>

      <div className="grid gap-6">
        <form action={verifyAction} className="grid gap-4">
          <input type="hidden" name="phone" value={phone} />

          <div className="grid gap-3">
            <div className="flex justify-center">
              <InputOTP
                id="code"
                name="code"
                maxLength={6}
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {verifyState.fieldErrors?.code?.[0] ? (
              <p className="text-center text-sm text-destructive">
                {verifyState.fieldErrors.code[0]}
              </p>
            ) : null}

            {verifyState.message && !verifyState.fieldErrors?.code?.[0] ? (
              <p className="text-center text-sm text-destructive">
                {verifyState.message}
              </p>
            ) : null}
          </div>

          <SubmitButton
            type="submit"
            className="w-full"
            pendingLabel="در حال بررسی..."
          >
            تایید و ادامه
          </SubmitButton>
        </form>

        <form action={resendAction} className="grid gap-2">
          <input type="hidden" name="phone" value={phone} />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={remaining > 0}
          >
            <RotateCcwIcon className="me-2 size-4" />
            {remaining > 0
              ? `ارسال مجدد تا ${toPersianDigits(remaining)} ثانیه دیگر`
              : "ارسال دوباره کد"}
          </Button>

          {resendState.message ? (
            <p
              className={`text-center text-sm ${
                resendState.status === "success"
                  ? "text-primary"
                  : "text-destructive"
              }`}
            >
              {resendState.message}
            </p>
          ) : null}
        </form>

        <div className="text-center">
          <Link
            href="/auth"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowRightIcon className="size-3.5" />
            تغییر شماره
          </Link>
        </div>
      </div>
    </>
  );
}
