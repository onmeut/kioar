"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageField } from "@/components/shared/image-field";
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
  paymentInstructions: string | null;
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
  onSuccess,
  submitLabel,
}: {
  pageId: string;
  initial: EventFormInitial | null;
  saveAction: (
    state: ActionState,
    formData: FormData,
  ) => Promise<ActionState>;
  /** Fired after the action returns a success status. The inline builder
   *  dialog uses this to close itself and refresh the blocks list. When the
   *  action redirects (the standalone /my-events flow) this never fires. */
  onSuccess?: (state: ActionState) => void;
  /** Override the submit button label (defaults to create/save wording). */
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(saveAction, idleState);

  // Fire onSuccess exactly once per successful submit. useActionState keeps
  // the same state object reference until the next dispatch, so guarding on
  // identity prevents repeat calls on unrelated re-renders.
  const lastHandledRef = useRef<ActionState | null>(null);
  useEffect(() => {
    if (state.status === "success" && lastHandledRef.current !== state) {
      lastHandledRef.current = state;
      onSuccess?.(state);
    }
  }, [state, onSuccess]);

  const [coverUrl, setCoverUrl] = useState<string | null>(
    initial?.coverUrl ?? null,
  );
  const coverHiddenInputRef = useRef<HTMLInputElement>(null);

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
  // Controlled text fields. React 19 auto-resets a `<form action={fn}>` after
  // the action runs — including the error path — which wipes any uncontrolled
  // (`defaultValue`) input. Holding these in state preserves what the host
  // typed when server validation rejects the submission.
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [locationAddress, setLocationAddress] = useState(
    initial?.locationAddress ?? "",
  );
  const [onlineUrl, setOnlineUrl] = useState(initial?.onlineUrl ?? "");
  const [capacity, setCapacity] = useState(
    initial?.capacity != null ? String(initial.capacity) : "",
  );
  const [priceToman, setPriceToman] = useState(
    initial?.priceToman ? String(initial.priceToman) : "",
  );
  const [paymentInstructions, setPaymentInstructions] = useState(
    initial?.paymentInstructions ?? "",
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
  // statusValue drives the hidden "status" input. Set via onPointerDown so the
  // DOM value updates synchronously before the form submit fires.
  const [statusValue, setStatusValue] = useState<"published" | "draft">(
    initial?.status === "published" ? "published" : "draft",
  );

  const tzOptions = buildTimezoneOptions(timezone);
  const fieldError = (k: string) => state.fieldErrors?.[k]?.[0];

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
      <input type="hidden" name="status" value={statusValue} />
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
      <ImageField
        mode="deferred"
        label="تصویر کاور (اختیاری)"
        emptyLabel="افزودن تصویر کاور"
        aspectRatio="free"
        imageUrl={coverUrl}
        onChange={setCoverUrl}
        onFileSelected={(file) => {
          if (coverHiddenInputRef.current) {
            if (file) {
              const dt = new DataTransfer();
              dt.items.add(file);
              coverHiddenInputRef.current.files = dt.files;
            } else {
              coverHiddenInputRef.current.value = "";
            }
          }
        }}
      />
      <input
        ref={coverHiddenInputRef}
        type="file"
        name="cover"
        accept="image/*"
        className="hidden"
        aria-hidden
      />

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="ev-title">عنوان رویداد</Label>
        <Input
          id="ev-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
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
              value={onlineUrl}
              onChange={(e) => setOnlineUrl(e.target.value)}
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
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
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
          <div className="space-y-3">
            <div className="space-y-1">
              <Input
                name="priceToman"
                type="number"
                inputMode="numeric"
                dir="ltr"
                value={priceToman}
                onChange={(e) => setPriceToman(e.target.value)}
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
            <div className="space-y-1">
              <Textarea
                name="paymentInstructions"
                rows={3}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                placeholder="نحوهٔ پرداخت را بنویس؛ مثلاً شمارهٔ کارت یا راه تماس."
              />
              <p className="text-xs text-muted-foreground">
                این توضیح روی صفحهٔ رویداد به شرکت‌کننده نشان داده می‌شود.
              </p>
            </div>
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

      {/* Action footer */}
      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-row items-center gap-2 border-t bg-background px-4 py-4 sm:-mx-5 sm:-mb-5 sm:px-5">
        {initial?.status === "published" ? (
          <SubmitButton
            type="submit"
            variant="outline"
            className="h-11 flex-1 sm:flex-none"
            pendingLabel="در حال ذخیره…"
            onPointerDown={() => setStatusValue("draft")}
          >
            لغو انتشار
          </SubmitButton>
        ) : (
          <SubmitButton
            type="submit"
            variant="outline"
            className="h-11 flex-1 sm:flex-none"
            pendingLabel="در حال ذخیره…"
            onPointerDown={() => setStatusValue("draft")}
          >
            ذخیره پیش‌نویس
          </SubmitButton>
        )}
        <SubmitButton
          type="submit"
          className="h-11 flex-1 sm:flex-none"
          pendingLabel="در حال انتشار…"
          onPointerDown={() => setStatusValue("published")}
        >
          {submitLabel ?? "انتشار رویداد"}
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
