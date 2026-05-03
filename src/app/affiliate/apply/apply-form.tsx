"use client";

import { useActionState } from "react";

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

const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "lt_1k", label: "زیر ۱٬۰۰۰ نفر" },
  { value: "1k_10k", label: "۱٬۰۰۰ تا ۱۰٬۰۰۰" },
  { value: "10k_50k", label: "۱۰٬۰۰۰ تا ۵۰٬۰۰۰" },
  { value: "50k_200k", label: "۵۰٬۰۰۰ تا ۲۰۰٬۰۰۰" },
  { value: "200k_plus", label: "بیشتر از ۲۰۰٬۰۰۰" },
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

  return (
    <form action={action} className="space-y-5">
      {/* Phone (read-only display) */}
      <div className="rounded-2xl border border-hairline bg-paper-soft px-4 py-3">
        <p className="text-[11px] font-medium text-ink-soft">شماره ثبت‌شده</p>
        <p className="mt-1 font-mono text-[15px] font-bold text-ink" dir="ltr">
          {toPersianDigits(formatPhoneDisplay(userPhone))}
        </p>
      </div>

      <Field
        label="نام و نام خانوادگی"
        name="fullName"
        defaultValue={defaultFullName}
        autoComplete="name"
        enterKeyHint="next"
        errors={fe.fullName}
        required
      />

      <Field
        label="ایمیل (اختیاری)"
        name="email"
        type="email"
        inputMode="email"
        defaultValue=""
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        enterKeyHint="next"
        errors={fe.email}
      />

      <SelectField
        label="کانال اصلی شما"
        name="channelKind"
        defaultValue=""
        options={CHANNEL_OPTIONS}
        errors={fe.channelKind}
        required
      />

      <Field
        label="لینک یا آدرس کانال"
        name="channelUrl"
        defaultValue=""
        placeholder="@yourname یا https://..."
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        enterKeyHint="next"
        errors={fe.channelUrl}
        required
      />

      <SelectField
        label="تخمین تعداد مخاطب"
        name="audienceSize"
        defaultValue=""
        options={AUDIENCE_OPTIONS}
        errors={fe.audienceSize}
        required
      />

      <div className="space-y-1.5">
        <label
          htmlFor="promotionPlan"
          className="text-[13px] font-bold text-ink"
        >
          چطور قصد داری کی‌یو‌آر رو معرفی کنی؟{" "}
          <span className="text-rose-600">*</span>
        </label>
        <textarea
          id="promotionPlan"
          name="promotionPlan"
          defaultValue=""
          rows={4}
          maxLength={1000}
          enterKeyHint="send"
          placeholder="مثلاً: توی استوری اینستاگرام و کپشن یوتیوب درباره‌ی ابزارهای کاربردی برای فریلنسرها معرفی می‌کنم."
          className="w-full rounded-xl border border-hairline bg-paper px-3.5 py-3 text-[15px] leading-7 outline-hidden transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 sm:text-[14px]"
        />
        {fe.promotionPlan ? (
          <p className="text-[12px] text-rose-600">{fe.promotionPlan[0]}</p>
        ) : (
          <p className="text-[11px] text-ink-soft">
            چند خط کافیه — نمی‌خوایم سرت رو درد بیاریم.
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
        disabled={pending}
        className="h-12 w-full rounded-full text-[15px] font-bold sm:w-auto sm:min-w-56"
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <SendIcon className="size-4" />
        )}
        {pending ? "در حال ارسال…" : "ارسال درخواست"}
      </Button>

      <p className="text-[11px] leading-6 text-ink-soft">
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
      <label htmlFor={name} className="text-[13px] font-bold text-ink">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      <Input id={name} name={name} type={type} {...rest} />
      {errors?.[0] ? (
        <p className="text-[12px] text-rose-600">{errors[0]}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  errors,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  errors?: string[];
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-[13px] font-bold text-ink">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="h-11 w-full rounded-xl border border-hairline bg-paper px-3.5 text-[15px] outline-hidden transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 md:h-9 md:text-[14px]"
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
        <p className="text-[12px] text-rose-600">{errors[0]}</p>
      ) : null}
    </div>
  );
}
