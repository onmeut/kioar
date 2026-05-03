"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CalendarDaysIcon,
  ImageIcon,
  InfoIcon,
  LinkIcon,
  MapPinIcon,
} from "lucide-react";

import { saveEventAction } from "@/app/admin/events/actions";
import { idleState } from "@/lib/action-state";
import { generateSlugSuggestion, normalizeSlug } from "@/lib/slug";
import { formatPersianDateTime } from "@/lib/persian";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EventStatus = "draft" | "published" | "closed";

type EventFormProps = {
  initialEvent?: {
    id: string;
    title: string;
    slug: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date | null;
    status: EventStatus;
    coverUrl: string | null;
  } | null;
};

function toDateTimeLocalValue(value?: Date | string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const normalized = new Date(date.getTime() - offset * 60_000);
  return normalized.toISOString().slice(0, 16);
}

const STATUS_OPTIONS: Array<{
  value: EventStatus;
  label: string;
  description: string;
}> = [
  {
    value: "draft",
    label: "پیش‌نویس",
    description: "روی صفحه عمومی نمایش داده نمی‌شود. برای آماده‌سازی.",
  },
  {
    value: "published",
    label: "منتشرشده",
    description: "روی صفحه رویدادها قابل مشاهده و ثبت‌نام است.",
  },
  {
    value: "closed",
    label: "بسته‌شده",
    description: "در صفحه عمومی نمایش داده نمی‌شود. ثبت‌نام متوقف شده است.",
  },
];

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm text-destructive">
      <InfoIcon className="size-3.5" />
      {message}
    </p>
  );
}

export function EventForm({ initialEvent }: EventFormProps) {
  const [state, formAction] = useActionState(saveEventAction, idleState);

  const initialStartsAt = toDateTimeLocalValue(initialEvent?.startsAt);
  const initialEndsAt = toDateTimeLocalValue(initialEvent?.endsAt);
  const initialSlug =
    initialEvent?.slug || generateSlugSuggestion(initialEvent?.title ?? "");

  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [slug, setSlug] = useState(initialSlug);
  const [slugEdited, setSlugEdited] = useState(Boolean(initialEvent?.slug));
  const [description, setDescription] = useState(
    initialEvent?.description ?? "",
  );
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [status, setStatus] = useState<EventStatus>(
    initialEvent?.status ?? "draft",
  );
  const [coverPreview, setCoverPreview] = useState(
    initialEvent?.coverUrl ?? "",
  );

  const lastHydratedStateRef = useRef(state);

  useEffect(() => {
    if (state === lastHydratedStateRef.current) return;
    lastHydratedStateRef.current = state;
    const values = state.values;
    if (!values) return;
    if (typeof values.title === "string") setTitle(values.title);
    if (typeof values.slug === "string") {
      setSlug(values.slug);
      setSlugEdited(true);
    }
    if (typeof values.description === "string")
      setDescription(values.description);
    if (typeof values.location === "string") setLocation(values.location);
    if (typeof values.startsAt === "string") setStartsAt(values.startsAt);
    if (typeof values.endsAt === "string") setEndsAt(values.endsAt);
    if (
      values.status === "draft" ||
      values.status === "published" ||
      values.status === "closed"
    ) {
      setStatus(values.status);
    }
  }, [state]);

  const endsBeforeStart =
    Boolean(startsAt) &&
    Boolean(endsAt) &&
    new Date(endsAt).getTime() < new Date(startsAt).getTime();

  const titleError = state.fieldErrors?.title?.[0];
  const slugError = state.fieldErrors?.slug?.[0];
  const descriptionError = state.fieldErrors?.description?.[0];
  const locationError = state.fieldErrors?.location?.[0];
  const startsAtError = state.fieldErrors?.startsAt?.[0];
  const endsAtError =
    state.fieldErrors?.endsAt?.[0] ??
    (endsBeforeStart ? "زمان پایان باید بعد از زمان شروع باشد." : undefined);

  return (
    <form
      action={formAction}
      className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr]"
      noValidate
    >
      <input type="hidden" name="id" value={initialEvent?.id ?? ""} />

      <Card className="border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="p-5 sm:p-6">
          <CardTitle className="text-xl font-bold">
            {initialEvent ? "ویرایش رویداد" : "ایجاد رویداد"}
          </CardTitle>
          <p className="text-sm leading-7 text-muted-foreground">
            همه فیلدهای علامت‌دار لازم‌اند. داده‌های شما در صورت خطا حفظ
            می‌شوند.
          </p>
        </CardHeader>
        <CardContent className="space-y-5 p-5 pt-0 sm:p-6 sm:pt-0">
          {state.status === "error" && state.message ? (
            <div
              role="alert"
              className="rounded-3xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {state.message}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="title">
              عنوان رویداد
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(event) => {
                const nextValue = event.target.value;
                setTitle(nextValue);
                if (!slugEdited) {
                  setSlug(generateSlugSuggestion(nextValue));
                }
              }}
              maxLength={100}
              required
              aria-invalid={Boolean(titleError)}
              className={cn(
                "h-12",
                titleError &&
                  "border-destructive focus-visible:ring-destructive/40",
              )}
              placeholder="مثلاً: نمایشگاه کارآفرینی تهران"
            />
            <FieldError message={titleError} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">
              اسلاگ نشانی
              <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
                onBlur={(event) => {
                  const normalized = normalizeSlug(event.target.value);
                  if (normalized) setSlug(normalized);
                }}
                className={cn(
                  "h-12 pl-10",
                  slugError &&
                    "border-destructive focus-visible:ring-destructive/40",
                )}
                dir="ltr"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
                required
                aria-invalid={Boolean(slugError)}
                placeholder="tehran-startup-summit"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              نشانی عمومی: /events/{slug || "نمونه-رویداد"}
            </p>
            <FieldError message={slugError} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              توضیح کوتاه
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={12}
              maxLength={1200}
              required
              aria-invalid={Boolean(descriptionError)}
              className={cn(
                "min-h-32 rounded-3xl",
                descriptionError &&
                  "border-destructive focus-visible:ring-destructive/40",
              )}
              placeholder="درباره رویداد، مخاطبان و چیزی که تجربه می‌کنند بنویسید."
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <FieldError message={descriptionError} />
              <span>{description.length}/1200</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">
              محل برگزاری
              <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <MapPinIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="location"
                name="location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
                aria-invalid={Boolean(locationError)}
                className={cn(
                  "h-12 pr-10",
                  locationError &&
                    "border-destructive focus-visible:ring-destructive/40",
                )}
                placeholder="تهران، برج میلاد - یا نشانی دقیق"
              />
            </div>
            <FieldError message={locationError} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startsAt">
                شروع
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
                aria-invalid={Boolean(startsAtError)}
                className={cn(
                  "h-12",
                  startsAtError &&
                    "border-destructive focus-visible:ring-destructive/40",
                )}
              />
              <FieldError message={startsAtError} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">پایان (اختیاری)</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                value={endsAt}
                min={startsAt || undefined}
                onChange={(event) => setEndsAt(event.target.value)}
                aria-invalid={Boolean(endsAtError)}
                className={cn(
                  "h-12",
                  endsAtError &&
                    "border-destructive focus-visible:ring-destructive/40",
                )}
              />
              <FieldError message={endsAtError} />
            </div>
          </div>

          <div className="space-y-3">
            <Label>وضعیت انتشار</Label>
            <RadioGroup
              name="status"
              value={status}
              onValueChange={(value) => setStatus(value as EventStatus)}
              className="grid gap-2"
            >
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-3 rounded-3xl bg-background/70 px-4 py-3 border border-border transition",
                    status === option.value
                      ? "border-primary/50 bg-primary/5"
                      : "hover:border-border",
                  )}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`status-${option.value}`}
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <span className="block font-semibold">{option.label}</span>
                    <span className="block text-xs leading-6 text-muted-foreground">
                      {option.description}
                    </span>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cover">تصویر کاور (اختیاری)</Label>
            <Input
              id="cover"
              name="cover"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              className="h-12"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setCoverPreview(URL.createObjectURL(file));
              }}
            />
            <p className="text-xs text-muted-foreground">
              پیشنهاد ابعاد: ۱۶۰۰×۹۰۰ — حداکثر ۵ مگابایت.
            </p>
          </div>

          <div className="pt-2">
            <SubmitButton
              type="submit"
              size="lg"
              className="h-12 w-full rounded-full sm:w-auto"
              pendingLabel="در حال ذخیره رویداد..."
            >
              {initialEvent ? "ذخیره تغییرات" : "ایجاد رویداد"}
            </SubmitButton>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-transparent shadow-none ring-0">
        <CardHeader className="p-5 sm:p-6">
          <CardTitle className="text-xl font-bold">پیش‌نمایش زنده</CardTitle>
          <p className="text-sm text-muted-foreground">
            این همان چیزی است که کاربران در صفحه رویداد می‌بینند.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="relative h-56 overflow-hidden rounded-[1.8rem] bg-[#e8f2ec]">
            {coverPreview ? (
              <Image
                src={coverPreview}
                alt={title || "پیش‌نمایش کاور"}
                fill
                className="object-cover"
                unoptimized={coverPreview.startsWith("blob:")}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageIcon className="size-8" />
              </div>
            )}
            <div className="absolute top-3 right-3">
              <Badge className="rounded-full bg-background/90 text-foreground">
                {
                  STATUS_OPTIONS.find((option) => option.value === status)
                    ?.label
                }
              </Badge>
            </div>
          </div>
          <div className="space-y-3 rounded-[1.8rem] border border-border/70 bg-background/80 p-4">
            <h3 className="text-xl font-bold">{title || "عنوان رویداد"}</h3>
            <p className="text-sm leading-7 text-muted-foreground">
              {description || "توضیح رویداد اینجا ظاهر می‌شود."}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDaysIcon className="size-4 text-primary" />
              <span>
                {startsAt
                  ? formatPersianDateTime(new Date(startsAt))
                  : "تاریخ و زمان رویداد"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinIcon className="size-4 text-primary" />
              <span>{location || "محل برگزاری"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
