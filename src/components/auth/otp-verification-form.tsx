"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { resendOtpAction, verifyOtpAction } from "@/app/auth/actions";
import { idleState } from "@/lib/action-state";
import { formatPhoneDisplay } from "@/lib/phone";
import { toPersianDigits } from "@/lib/persian";
import { BrandMark } from "@/components/shared/brand-mark";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function VerifyButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={cn(
        "tap-target inline-flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed",
        isDisabled
          ? "bg-muted text-muted-foreground"
          : "bg-foreground text-background hover:bg-foreground/90 active:translate-y-px",
      )}
    >
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          <span>در حال بررسی…</span>
        </>
      ) : (
        <span>تایید کد</span>
      )}
    </button>
  );
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

  const [code, setCode] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const autoSubmittedFor = useRef<string | null>(null);

  const codeError = verifyState.fieldErrors?.code?.[0];
  const generalError =
    verifyState.message && verifyState.status === "error" && !codeError
      ? verifyState.message
      : null;
  const hasError = !!codeError || !!generalError;

  // Reset auto-submit guard whenever the user edits the code.
  useEffect(() => {
    if (code.length < 6) {
      autoSubmittedFor.current = null;
    }
  }, [code]);

  // Auto-submit once the user fills all 6 digits.
  useEffect(() => {
    if (code.length !== 6) return;
    if (autoSubmittedFor.current === code) return;
    autoSubmittedFor.current = code;
    formRef.current?.requestSubmit();
  }, [code]);

  const phoneDisplay = useMemo(() => formatPhoneDisplay(phone), [phone]);

  return (
    <div className="flex flex-col items-center gap-7">
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandMark variant="mark" className="size-14" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            به کیوآر خوش آمدید
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            کد ۶ رقمی ارسال‌شده به شماره موبایل خود را وارد کنید
          </p>
        </div>
      </div>

      {/* Verify form — no nested forms inside */}
      <form
        ref={formRef}
        action={verifyAction}
        className="flex w-full flex-col gap-3"
      >
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="code" value={code} />

        <div className="flex justify-center" dir="ltr">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => setCode(value)}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            aria-invalid={hasError}
            containerClassName="w-full"
          >
            <InputOTPGroup className="w-full gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className={cn(
                    "size-auto min-w-0 flex-1 aspect-square text-2xl",
                    hasError && "border-destructive",
                  )}
                  aria-invalid={hasError}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {codeError ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {codeError}
          </p>
        ) : generalError ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {generalError}
          </p>
        ) : null}

        <div className="mt-2 flex flex-col gap-2">
          <VerifyButton disabled={code.length !== 6} />
        </div>
      </form>

      {/* Resend + edit — sibling of verify form, never nested */}
      <div className="flex w-full flex-col gap-2">
        {resendState.status === "success" && resendState.message ? (
          <p className="text-center text-sm text-primary">
            {resendState.message}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">کد ارسال شد به</span>
            <span dir="ltr" className="text-sm font-semibold text-foreground">
              {phoneDisplay}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <form action={resendAction}>
              <input type="hidden" name="phone" value={phone} />
              <button
                type="submit"
                disabled={remaining > 0}
                className={cn(
                  "text-xs font-semibold transition-colors disabled:cursor-not-allowed",
                  remaining > 0
                    ? "text-muted-foreground"
                    : "text-primary hover:text-primary/80",
                )}
              >
                {remaining > 0
                  ? `${toPersianDigits(remaining)}ث`
                  : "ارسال مجدد"}
              </button>
            </form>
            <span className="h-4 w-px bg-border" />
            <a
              href="/auth"
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              ویرایش
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
