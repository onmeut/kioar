"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { updateAdminBankingAction } from "@/app/admin/affiliates/actions";

export function BankingForm({
  userId,
  defaults,
}: {
  userId: string;
  defaults: {
    sheba: string;
    holderName: string;
    nationalId: string;
    contactEmail: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const submit = (fd: FormData) => {
    fd.set("userId", userId);
    startTransition(() => updateAdminBankingAction(fd));
  };

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-2">
      <Field
        id={`sheba-${userId}`}
        name="sheba"
        label="شبا"
        defaultValue={defaults.sheba}
        mono
      />
      <Field
        id={`holder-${userId}`}
        name="holderName"
        label="صاحب حساب"
        defaultValue={defaults.holderName}
      />
      <Field
        id={`nid-${userId}`}
        name="nationalId"
        label="کد ملی"
        defaultValue={defaults.nationalId}
        mono
      />
      <Field
        id={`email-${userId}`}
        name="contactEmail"
        label="ایمیل تماس"
        defaultValue={defaults.contactEmail}
        ltr
        type="email"
      />
      <div className="sm:col-span-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="h-10 rounded-full px-6 text-[12px] font-bold"
        >
          {pending ? "در حال ذخیره…" : "ذخیره‌ی اطلاعات بانکی"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  defaultValue,
  mono,
  ltr,
  type,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  mono?: boolean;
  ltr?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        type={type}
        autoComplete="off"
        spellCheck={false}
        dir={mono || ltr ? "ltr" : undefined}
        className={`h-10 w-full rounded-xl border border-border bg-background px-3 text-[13px] outline-none focus:border-foreground/50 ${mono ? "font-mono font-bold" : ""}`}
      />
    </div>
  );
}
