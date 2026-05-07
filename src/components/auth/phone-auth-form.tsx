"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { requestOtpAction } from "@/app/auth/actions";
import { idleState } from "@/lib/action-state";
import { isIranianPhone } from "@/lib/phone";
import { toEnglishDigits } from "@/lib/persian";
import { BrandMark } from "@/components/shared/brand-mark";
import { cn } from "@/lib/utils";

function ContinueButton({ disabled }: { disabled: boolean }) {
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
          <span>در حال ارسال…</span>
        </>
      ) : (
        <span>ادامه</span>
      )}
    </button>
  );
}

export function PhoneAuthForm() {
  const [state, formAction] = useActionState(requestOtpAction, idleState);
  const [phone, setPhone] = useState("");

  const isValid = useMemo(() => isIranianPhone(phone), [phone]);

  const phoneError = state.fieldErrors?.phone?.[0];
  const generalError =
    state.message && state.status === "error" && !phoneError
      ? state.message
      : null;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandMark variant="mark" className="size-14" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
            به کیوآر خوش آمدید
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            شماره موبایل خود را وارد کنید تا ادامه دهید
          </p>
        </div>
      </div>

      <form action={formAction} className="flex w-full flex-col gap-4">
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="send"
          autoFocus
          dir="ltr"
          placeholder="09123456789"
          value={phone}
          onChange={(event) => {
            const next = toEnglishDigits(event.target.value).replace(
              /[^\d+]/g,
              "",
            );
            setPhone(next);
          }}
          maxLength={14}
          aria-invalid={!!phoneError}
          aria-describedby={phoneError ? "phone-error" : undefined}
          className={cn(
            "h-14 w-full rounded-full bg-muted px-5 text-base font-medium text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors",
            "focus-visible:ring-3 focus-visible:ring-ring/20",
            phoneError && "ring-3 ring-destructive/30",
          )}
        />

        {phoneError ? (
          <p
            id="phone-error"
            className="text-center text-sm text-destructive"
            role="alert"
          >
            {phoneError}
          </p>
        ) : null}

        {generalError ? (
          <p className="text-center text-sm text-destructive" role="alert">
            {generalError}
          </p>
        ) : null}

        <ContinueButton disabled={!isValid} />

        <p className="px-2 text-center text-xs leading-relaxed text-muted-foreground">
          با ادامه، شما{" "}
          <Link
            href="#"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            شرایط استفاده
          </Link>
          {" "}و{" "}
          <Link
            href="#"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            سیاست حریم خصوصی
          </Link>
          {" "}
          را می‌پذیرید.
        </p>
      </form>
    </div>
  );
}
