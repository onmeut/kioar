"use client";

import { useActionState, useState } from "react";

import { Loader2Icon, SendIcon } from "lucide-react";

import { submitAffiliateApplicationAction } from "@/app/affiliate/apply/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { idleState } from "@/lib/action-state";
import { formatPhoneDisplay } from "@/lib/phone";
import { toPersianDigits } from "@/lib/persian";

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "instagram", label: "اینستاگرام" },
  { value: "telegram", label: "تلگرام" },
  { value: "youtube", label: "یوتیوب" },
  { value: "blog", label: "بلاگ یا سایت" },
  { value: "podcast", label: "پادکست" },
  { value: "agency", label: "آژانس / استودیو" },
  { value: "other", label: "بقیه" },
];

export function ApplyForm({
  defaultFullName,
  userPhone,
}: {
  defaultFullName: string;
  userPhone: string;
}) {
  const [state, action, pending] = useActionState(
    submitAffiliateApplicationAction,
    idleState,
  );
  const fe = state.fieldErrors ?? {};

  // Controlled state — persists across server action re-renders so users
  // don't lose their input when a validation error is returned.
  const [fullName, setFullName] = useState(defaultFullName);
  const [channelKind, setChannelKind] = useState("");
  const [channelUrl, setChannelUrl] = useState("");

  return (
    <form action={action} className="space-y-4">
      {/* Phone (read-only display) */}
      <div className="rounded-2xl bg-muted px-4 py-3">
        <p className="text-[11px] font-medium text-muted-foreground">
          شماره ثبت‌شده
        </p>
        <p className="mt-1 font-mono text-[15px] font-bold" dir="ltr">
          {toPersianDigits(formatPhoneDisplay(userPhone))}
        </p>
      </div>

      <Field
        label="نام و نام خانوادگی"
        name="fullName"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
        enterKeyHint="next"
        errors={fe.fullName}
        required
      />

      <SelectField
        label="کانال اصلی شما"
        name="channelKind"
        value={channelKind}
        onChange={(e) => setChannelKind(e.target.value)}
        options={CHANNEL_OPTIONS}
        errors={fe.channelKind}
        required
      />

      <Field
        label="لینک یا آدرس کانال"
        name="channelUrl"
        value={channelUrl}
        onChange={(e) => setChannelUrl(e.target.value)}
        placeholder="@username یا https://..."
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        enterKeyHint="send"
        errors={fe.channelUrl}
        required
      />

      {state.status === "error" && state.message ? (
        <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {state.message}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-12 w-full rounded-full text-[15px] font-bold"
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <SendIcon className="size-4" />
        )}
        {pending ? "در حال ارسال…" : "ارسال درخواست"}
      </Button>

      <p className="text-center text-[11px] leading-6 text-muted-foreground">
        با ارسال، با قواعد برنامه و سیاست‌های کی‌یو‌آر موافقت می‌کنی.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  errors,
  required,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-[13px] font-bold">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      <Input id={name} name={name} type={type} {...rest} />
      {errors?.[0] ? (
        <p className="text-[12px] text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  errors,
  required,
}: {
  label: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options: { value: string; label: string }[];
  errors?: string[];
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-[13px] font-bold">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-[15px] text-foreground outline-hidden transition focus:border-ring focus:ring-2 focus:ring-ring/20 md:h-9 md:text-[14px]"
      >
        <option value="" disabled>
          انتخاب کن…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors?.[0] ? (
        <p className="text-[12px] text-destructive">{errors[0]}</p>
      ) : null}
    </div>
  );
}
