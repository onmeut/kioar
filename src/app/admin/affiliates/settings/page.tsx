/**
 * `/admin/affiliates/settings` — global commission/holding settings.
 */
import { CheckCircle2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAffiliateSettings } from "@/lib/affiliate";
import { requireAdmin } from "@/lib/auth/session";
import { AdminAffiliatesNav } from "@/app/admin/affiliates/_components/nav";
import { updateSettingsAction } from "@/app/admin/affiliates/actions";

type SearchParams = Promise<{ saved?: string }>;

export default async function AdminAffiliateSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;
  const settings = await getAffiliateSettings();

  return (
    <section className="section-shell space-y-5 py-6">
      <AdminAffiliatesNav />

      <h2 className="text-[16px] font-semibold tracking-tight">
        تنظیمات همکاری در فروش
      </h2>
      <p className="max-w-2xl text-[12px] leading-7 text-muted-foreground">
        این مقادیر روی همکاران جدید اعمال می‌شه. همکاران فعلی ضرایب اختصاصی
        خودشون رو از زمان تأیید نگه می‌دارن (می‌تونی اون‌ها رو از کارت همکار
        تغییر بدی).
      </p>

      {params.saved ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          <CheckCircle2Icon className="size-4" />
          تنظیمات ذخیره شد.
        </div>
      ) : null}

      <form
        action={updateSettingsAction}
        className="max-w-xl space-y-4 rounded-2xl border border-border bg-background p-6"
      >
        <Field
          id="commissionPct"
          name="commissionPct"
          label="درصد پورسانت پیش‌فرض"
          hint="مقدار بین ۱ تا ۹۰. روی همکاران جدید اعمال می‌شه."
          defaultValue={String(settings.commissionPct)}
          mono
          inputMode="numeric"
        />
        <Field
          id="holdingPeriodDays"
          name="holdingPeriodDays"
          label="دوره‌ی نگه‌داری (روز)"
          hint="فاصله بین فروش و قابل‌برداشت‌شدن پورسانت."
          defaultValue={String(settings.holdingPeriodDays)}
          mono
          inputMode="numeric"
        />
        <Field
          id="minWithdrawalToman"
          name="minWithdrawalToman"
          label="حداقل تسویه (تومان)"
          hint="کم‌تر از این مقدار، همکار نمی‌تونه درخواست تسویه ثبت کنه."
          defaultValue={String(settings.minWithdrawalToman)}
          mono
          inputMode="numeric"
        />

        <div className="space-y-1.5">
          <label htmlFor="contentRulesMd" className="text-[12px] font-bold">
            قوانین محتوای تبلیغ (Markdown — اختیاری)
          </label>
          <textarea
            id="contentRulesMd"
            name="contentRulesMd"
            rows={8}
            defaultValue={settings.contentRulesMd ?? ""}
            className="w-full rounded-xl border border-border bg-background p-3 text-[13px] leading-7 outline-none focus:border-foreground/50"
            placeholder="# قوانین محتوای تبلیغ&#10;..."
          />
          <p className="text-[11px] text-muted-foreground">
            این متن روی لینک منابع همکار قابل نمایشه.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full rounded-full text-[13px] font-bold sm:w-auto sm:px-8"
        >
          ذخیره
        </Button>
      </form>
    </section>
  );
}

function Field({
  id,
  name,
  label,
  hint,
  defaultValue,
  mono,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  mono?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[12px] font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        inputMode={inputMode}
        dir={mono ? "ltr" : undefined}
        className={`h-10 w-full rounded-xl border border-border bg-background px-3 text-[14px] outline-none focus:border-foreground/50 ${mono ? "font-mono font-bold" : ""}`}
      />
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
