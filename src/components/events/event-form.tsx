"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import { cn } from "@/lib/utils";
import { idleState, type ActionState } from "@/lib/action-state";
import { buildTimezoneOptions } from "@/lib/timezones";
import {
  ShamsiDateTimePicker,
  type ShamsiDateTimeValue,
} from "@/components/events/shamsi-datetime-picker";
import {
  QuestionBuilder,
  type DraftQuestion,
} from "@/components/events/question-builder";
import {
  DiscountCodesEditor,
  type DraftDiscountCode,
} from "@/components/events/discount-codes-editor";

export type EventFormInitial = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  locationType: "physical" | "online";
  locationAddress: string | null;
  onlineUrl: string | null;
  timezone: string;
  start: ShamsiDateTimeValue;
  end: ShamsiDateTimeValue;
  capacity: number | null;
  priceType: "free" | "paid";
  priceToman: number;
  approvalRequired: boolean;
  receiptUploadEnabled: boolean;
  waitlistEnabled: boolean;
  status: "draft" | "published" | "cancelled";
  questions: DraftQuestion[];
  discountCodes: DraftDiscountCode[];
};

export function EventForm({
  pageId,
  initial,
  saveAction,
}: {
  pageId: string;
  initial: EventFormInitial | null;
  saveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(saveAction, idleState);

  const [coverUrl, setCoverUrl] = useState<string | null>(
    initial?.coverUrl ?? null,
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [locationType, setLocationType] = useState<"physical" | "online">(
    initial?.locationType ?? "physical",
  );
  const [priceType, setPriceType] = useState<"free" | "paid">(
    initial?.priceType ?? "free",
  );
  const [approvalRequired, setApprovalRequired] = useState(
    initial?.approvalRequired ?? false,
  );
  const [receiptUploadEnabled, setReceiptUploadEnabled] = useState(
    initial?.receiptUploadEnabled ?? false,
  );
  const [waitlistEnabled, setWaitlistEnabled] = useState(
    initial?.waitlistEnabled ?? false,
  );
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Tehran");
  const [start, setStart] = useState<ShamsiDateTimeValue>(
    initial?.start ?? { date: "", time: "" },
  );
  const [end, setEnd] = useState<ShamsiDateTimeValue>(
    initial?.end ?? { date: "", time: "" },
  );
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initial?.questions ?? [],
  );
  const [discountCodes, setDiscountCodes] = useState<DraftDiscountCode[]>(
    initial?.discountCodes ?? [],
  );
  const [publishOnSave, setPublishOnSave] = useState(
    initial?.status === "published",
  );

  const tzOptions = buildTimezoneOptions(timezone);
  const fieldError = (k: string) => state.fieldErrors?.[k]?.[0];

  function pickCover(file: File | undefined) {
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="space-y-6">
      {initial ? (
        <input type="hidden" name="eventId" value={initial.id} />
      ) : null}
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="locationType" value={locationType} />
      <input type="hidden" name="priceType" value={priceType} />
      <input type="hidden" name="startDate" value={start.date} />
      <input type="hidden" name="startTime" value={start.time} />
      <input type="hidden" name="endDate" value={end.date} />
      <input type="hidden" name="endTime" value={end.time} />
      <input
        type="hidden"
        name="approvalRequired"
        value={approvalRequired ? "true" : "false"}
      />
      <input
        type="hidden"
        name="receiptUploadEnabled"
        value={receiptUploadEnabled ? "true" : "false"}
      />
      <input
        type="hidden"
        name="waitlistEnabled"
        value={waitlistEnabled ? "true" : "false"}
      />
      <input
        type="hidden"
        name="status"
        value={publishOnSave ? "published" : "draft"}
      />
      <input
        type="hidden"
        name="questions"
        value={JSON.stringify(questions)}
      />
      <input
        type="hidden"
        name="discountCodes"
        value={JSON.stringify(discountCodes)}
      />

      {state.status === "error" && state.message ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      {/* Cover */}
      <div className="space-y-2">
        <Label>تصویر کاور (اختیاری)</Label>
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-3xl border border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50"
        >
          {coverPreview || coverUrl ? (
            <Image
              src={coverPreview ?? coverUrl ?? ""}
              alt="کاور رویداد"
              fill
              className="object-cover"
              unoptimized={Boolean(coverPreview)}
            />
          ) : (
            <span className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="size-7" />
              <span className="text-sm">افزودن تصویر</span>
            </span>
          )}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          name="cover"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickCover(e.target.files?.[0])}
        />
        {coverFile ? (
          <button
            type="button"
            onClick={() => {
              setCoverFile(null);
              setCoverPreview(null);
              setCoverUrl(initial?.coverUrl ?? null);
              if (coverInputRef.current) coverInputRef.current.value = "";
            }}
            className="text-xs text-muted-foreground underline"
          >
            حذف تصویر انتخابی
          </button>
        ) : null}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="ev-title">عنوان رویداد</Label>
        <Input
          id="ev-title"
          name="title"
          defaultValue={initial?.title ?? ""}
          placeholder="میت‌آپ ماهانه جامعه…"
          enterKeyHint="next"
          autoFocus={!initial}
          required
        />
        {fieldError("title") ? (
          <p className="text-xs text-rose-600">{fieldError("title")}</p>
        ) : null}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="ev-desc">توضیحات</Label>
        <Textarea
          id="ev-desc"
          name="description"
          defaultValue={initial?.description ?? ""}
          placeholder="دستور جلسه، چه کسانی بیایند، و چه چیزی یاد می‌گیرند…"
          className="min-h-28"
        />
      </div>

      {/* Date & time */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ShamsiDateTimePicker
          label="شروع"
          value={start}
          onChange={setStart}
          required
        />
        <ShamsiDateTimePicker label="پایان (اختیاری)" value={end} onChange={setEnd} />
      </div>
      {fieldError("startDate") || fieldError("startTime") ? (
        <p className="text-xs text-rose-600">
          {fieldError("startDate") ?? fieldError("startTime")}
        </p>
      ) : null}
      {fieldError("endTime") ? (
        <p className="text-xs text-rose-600">{fieldError("endTime")}</p>
      ) : null}

      {/* Timezone */}
      <div className="space-y-2">
        <Label>منطقهٔ زمانی</Label>
        <Select
          value={timezone}
          onValueChange={(v) => setTimezone(v ?? "Asia/Tehran")}
        >
          <SelectTrigger className="h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tzOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div className="space-y-3">
        <Label>محل برگزاری</Label>
        <div className="inline-flex rounded-full border border-border p-0.5">
          {(["physical", "online"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLocationType(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                locationType === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground",
              )}
            >
              {t === "physical" ? "حضوری" : "آنلاین"}
            </button>
          ))}
        </div>
        {locationType === "physical" ? (
          <div className="space-y-1">
            <Input
              name="locationAddress"
              defaultValue={initial?.locationAddress ?? ""}
              placeholder="آدرس محل برگزاری"
            />
            {fieldError("locationAddress") ? (
              <p className="text-xs text-rose-600">
                {fieldError("locationAddress")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            <Input
              name="onlineUrl"
              defaultValue={initial?.onlineUrl ?? ""}
              placeholder="https://… (فقط برای ثبت‌نام‌های تأییدشده نمایش داده می‌شود)"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
            />
            {fieldError("onlineUrl") ? (
              <p className="text-xs text-rose-600">{fieldError("onlineUrl")}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                لینک رویداد آنلاین فقط پس از تأیید ثبت‌نام به شرکت‌کننده نشان
                داده می‌شود.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Capacity */}
      <div className="space-y-2">
        <Label htmlFor="ev-capacity">ظرفیت (خالی = نامحدود)</Label>
        <Input
          id="ev-capacity"
          name="capacity"
          type="number"
          inputMode="numeric"
          dir="ltr"
          defaultValue={initial?.capacity ?? ""}
          placeholder="نامحدود"
        />
        {fieldError("capacity") ? (
          <p className="text-xs text-rose-600">{fieldError("capacity")}</p>
        ) : null}
      </div>

      {/* Pricing */}
      <div className="space-y-3">
        <Label>هزینه</Label>
        <div className="inline-flex rounded-full border border-border p-0.5">
          {(["free", "paid"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPriceType(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                priceType === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground",
              )}
            >
              {t === "free" ? "رایگان" : "پولی"}
            </button>
          ))}
        </div>
        {priceType === "paid" ? (
          <div className="space-y-1">
            <Input
              name="priceToman"
              type="number"
              inputMode="numeric"
              dir="ltr"
              defaultValue={initial?.priceToman || ""}
              placeholder="مبلغ به تومان"
            />
            {fieldError("priceToman") ? (
              <p className="text-xs text-rose-600">
                {fieldError("priceToman")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                پرداختی واقعی انجام نمی‌شود؛ شرکت‌کننده رسید را آپلود می‌کند و
                شما تأیید می‌کنید.
              </p>
            )}
          </div>
        ) : (
          <input type="hidden" name="priceToman" value="0" />
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-3 rounded-3xl border border-border p-4">
        <ToggleRow
          label="نیاز به تأیید میزبان"
          hint="ثبت‌نام‌ها تا تأیید شما در انتظار می‌مانند."
          checked={approvalRequired}
          onChange={setApprovalRequired}
        />
        {priceType === "paid" ? (
          <ToggleRow
            label="آپلود رسید پرداخت"
            hint="شرکت‌کننده رسید را آپلود می‌کند تا شما بررسی کنید."
            checked={receiptUploadEnabled}
            onChange={setReceiptUploadEnabled}
          />
        ) : null}
        <ToggleRow
          label="فهرست انتظار"
          hint="پس از تکمیل ظرفیت، ثبت‌نام‌ها به فهرست انتظار می‌روند."
          checked={waitlistEnabled}
          onChange={setWaitlistEnabled}
        />
      </div>

      {/* Custom questions */}
      <div className="space-y-2">
        <Label>سؤالات ثبت‌نام (اختیاری)</Label>
        <QuestionBuilder questions={questions} onChange={setQuestions} />
      </div>

      {/* Discount codes */}
      <div className="space-y-2">
        <Label>کدهای تخفیف (اختیاری)</Label>
        <DiscountCodesEditor
          codes={discountCodes}
          onChange={setDiscountCodes}
        />
      </div>

      {/* Publish toggle + submit */}
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <ToggleRow
          label="انتشار رویداد"
          hint="رویداد منتشرشده روی صفحهٔ عمومی شما نمایش داده می‌شود."
          checked={publishOnSave}
          onChange={setPublishOnSave}
        />
        <SubmitButton
          type="submit"
          className="h-12 w-full sm:w-auto"
          pendingLabel="در حال ذخیره…"
        >
          {initial ? "ذخیره تغییرات" : "ساخت رویداد"}
        </SubmitButton>
      </div>
    </form>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
