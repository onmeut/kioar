"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import {
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  ImageIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { LinkIconPicker } from "@/components/dashboard/link-icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PROFILE_DOMAINS,
  type ProfileDomain,
  isProfileDomain,
} from "@/lib/profile-domains";
import { isIconKey, resolveIconEntry, type IconKey } from "@/lib/link-icons";
import { cn } from "@/lib/utils";
import { deletePageAction } from "@/app/(app)/dashboard/pages/actions";
import type { Route } from "next";

export type PageSettingsValues = {
  fullName: string;
  title: string;
  bio: string;
  slug: string;
  domain: ProfileDomain;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string | null;
  indexEnabled: boolean;
  appIconKey: IconKey | null;
  appIconColor: string;
};

type Result =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string[] | undefined> };

type PreviewProfile = {
  fullName: string;
  title: string;
  avatarUrl: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Page being edited. Required for the destructive "delete page" action. */
  pageId: string;
  initial: PageSettingsValues;
  /** Read-only profile data used by the preview cards. */
  preview: PreviewProfile;
  onSave: (
    next: PageSettingsValues & {
      ogImageFile?: File | null;
      ogImageRemove?: boolean;
    },
  ) => Promise<Result>;
};

/**
 * Curated palette for the app-icon background. Picked to look good as both
 * a tab favicon and a home-screen icon. The "+" button opens a native
 * color picker as a fallback for users who want a custom shade.
 */
const COLOR_SWATCHES = [
  "#195c54", // brand teal
  "#0f172a", // slate
  "#dc2626", // red
  "#ea580c", // orange
  "#d97706", // amber
  "#16a34a", // green
  "#0ea5e9", // sky
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
] as const;

const DEFAULT_ICON_COLOR = "#195c54";

export function PageSettingsSheet({
  open,
  onOpenChange,
  pageId,
  initial,
  preview,
  onSave,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<PageSettingsValues>(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [iconOpen, setIconOpen] = useState(false);
  const [ogFile, setOgFile] = useState<File | null>(null);
  const [ogPreview, setOgPreview] = useState<string | null>(null);
  const [ogRemove, setOgRemove] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, startDeleteTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) {
      setValues(initial);
      setErrors({});
      setOgFile(null);
      setOgPreview(null);
      setOgRemove(false);
    }
  }, [open, initial]);

  function patch<K extends keyof PageSettingsValues>(
    key: K,
    value: PageSettingsValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleOgPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f) {
      if (f.size > 4_000_000) {
        toast.error("حجم تصویر بیش‌از حد است (حداکثر ۴ مگابایت).");
        return;
      }
      setOgFile(f);
      setOgPreview(URL.createObjectURL(f));
      setOgRemove(false);
    }
  }

  function handleOgRemove() {
    setOgFile(null);
    if (ogPreview) URL.revokeObjectURL(ogPreview);
    setOgPreview(null);
    setOgRemove(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit() {
    startTransition(async () => {
      const result = await onSave({
        ...values,
        ogImageFile: ogFile,
        ogImageRemove: ogRemove,
      });
      if (result.ok) {
        toast.success("تغییرات ذخیره شد.");
        onOpenChange(false);
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      }
    });
  }

  const ogShown = ogPreview ?? (ogRemove ? null : values.ogImageUrl);

  // Effective values used for the live previews. Falls back to existing
  // profile data so the cards never look empty before the user types.
  const effectiveFullName = values.fullName.trim() || preview.fullName;
  const fallbackChar =
    effectiveFullName.trim().charAt(0).toUpperCase() ||
    values.slug.charAt(0).toUpperCase() ||
    "K";
  const previewTitle =
    values.seoTitle.trim() ||
    [effectiveFullName, preview.title].filter(Boolean).join(" — ") ||
    `@${values.slug || "your-handle"}`;
  const previewDescription =
    values.seoDescription.trim() ||
    `صفحه‌ی شخصی ${effectiveFullName || `@${values.slug || "your-handle"}`} روی کی‌یو‌آر — لینک‌ها، رویدادها و راه‌های ارتباطی.`;
  const previewUrl = `${values.domain}/${values.slug || "your-handle"}`;
  const iconColor = values.appIconColor || DEFAULT_ICON_COLOR;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 py-5 md:px-6">
        {/* ---- Page name (was buried in the title-bio modal) ---- */}
        <section className="space-y-2">
          <SectionTitle title="نام صفحه" />
          <Input
            id="page-fullName"
            value={values.fullName}
            onChange={(e) => patch("fullName", e.target.value.slice(0, 80))}
            placeholder="مثلاً «استودیو رویا»"
            maxLength={80}
            enterKeyHint="next"
          />
          {errors.fullName?.[0] ? (
            <p className="text-xs text-destructive">{errors.fullName[0]}</p>
          ) : null}

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="page-title" className="text-xs font-medium">
                عنوان
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {values.title.length}/۸۰
              </span>
            </div>
            <Input
              id="page-title-inline"
              value={values.title}
              onChange={(e) => patch("title", e.target.value.slice(0, 80))}
              placeholder="مثلاً «طراح محصول»"
              maxLength={80}
              enterKeyHint="next"
            />
            {errors.title?.[0] ? (
              <p className="text-xs text-destructive">{errors.title[0]}</p>
            ) : null}
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="page-bio" className="text-xs font-medium">
                بیو
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {values.bio.length}/۲۸۰
              </span>
            </div>
            <Textarea
              id="page-bio"
              value={values.bio}
              onChange={(e) => patch("bio", e.target.value.slice(0, 280))}
              placeholder="توضیح کوتاهی درباره خود بنویسید."
              maxLength={280}
              rows={3}
            />
            {errors.bio?.[0] ? (
              <p className="text-xs text-destructive">{errors.bio[0]}</p>
            ) : null}
          </div>
        </section>

        {/* ---- Address ---- */}
        <section className="space-y-2">
          <SectionTitle
            title="آدرس صفحه"
            hint="دامنه و نام کاربری صفحه‌ی شما."
          />

          <div
            dir="ltr"
            className="flex items-stretch overflow-hidden rounded-2xl border bg-background"
          >
            <DomainPopover
              value={values.domain}
              onChange={(d) => patch("domain", d)}
            />
            <div className="flex items-center px-2 text-muted-foreground">
              /
            </div>
            <input
              type="text"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="url"
              autoComplete="off"
              enterKeyHint="done"
              value={values.slug}
              onChange={(e) =>
                patch(
                  "slug",
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "")
                    .slice(0, 40),
                )
              }
              className="h-11 flex-1 bg-transparent px-2 text-sm font-semibold outline-none placeholder:text-muted-foreground"
              placeholder="your-handle"
            />
          </div>
          {errors.slug?.[0] ? (
            <p className="text-xs text-destructive">{errors.slug[0]}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              فقط حروف انگلیسی، عدد و خط تیره. اگر نام کاربری را عوض کنی، آدرس
              قبلی دیگر کار نمی‌کند — اما لینک <code>kioar.com/u/...</code>{" "}
              همیشه به آدرس فعلی هدایت می‌شود.
            </p>
          )}
        </section>

        {/* ---- Page identity (was "SEO") ---- */}
        <section className="space-y-3">
          <SectionTitle
            title="معرفی صفحه"
            hint="عنوان و توضیح کوتاهی که در گوگل و شبکه‌های اجتماعی نمایش داده می‌شود."
          />

          <GooglePreview
            url={previewUrl}
            title={previewTitle}
            description={previewDescription}
            iconColor={iconColor}
            iconKey={values.appIconKey}
            fallbackChar={fallbackChar}
          />

          <Field
            id="page-title"
            label="عنوان در نتایج جست‌وجو"
            counter={`${values.seoTitle.length}/۷۰`}
            error={errors.seoTitle?.[0]}
          >
            <Input
              id="page-title"
              value={values.seoTitle}
              onChange={(e) => patch("seoTitle", e.target.value.slice(0, 70))}
              placeholder="علی رضایی — طراح محصول"
              maxLength={70}
              enterKeyHint="next"
            />
          </Field>

          <Field
            id="page-desc"
            label="توضیح کوتاه"
            counter={`${values.seoDescription.length}/۲۰۰`}
            error={errors.seoDescription?.[0]}
          >
            <Textarea
              id="page-desc"
              value={values.seoDescription}
              onChange={(e) =>
                patch("seoDescription", e.target.value.slice(0, 200))
              }
              placeholder="در یک جمله بنویس چه می‌کنی و دنبال چه چیزی هستی. مثلاً: «طراح محصول و موسس استودیو X. اینجا رزومه، کارها و راه‌های تماس.»"
              rows={3}
              maxLength={200}
            />
          </Field>

          <div className="space-y-2">
            <Label className="text-xs font-medium">عکس اشتراک‌گذاری</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative aspect-[1.91/1] w-32 shrink-0 overflow-hidden rounded-2xl border bg-muted/40 transition-colors hover:bg-muted"
                aria-label={
                  ogShown ? "تغییر عکس اشتراک‌گذاری" : "انتخاب عکس اشتراک‌گذاری"
                }
              >
                {ogShown ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={ogShown}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                )}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <PencilIcon className="size-4" />
                </span>
              </button>
              {ogShown ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 self-start text-destructive hover:text-destructive"
                  onClick={handleOgRemove}
                >
                  <Trash2Icon className="size-4" />
                  حذف عکس
                </Button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleOgPick}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              نسبت پیشنهادی ۱۲۰۰×۶۳۰. اگر عکسی نگذاری، خودکار ساخته می‌شود.
            </p>
          </div>
        </section>

        {/* ---- App icon ---- */}
        <section className="space-y-3">
          <SectionTitle title="آیکون اپ و فاوآیکون" />

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setIconOpen(true)}
              className="group relative size-16 shrink-0 overflow-hidden rounded-2xl outline-none ring-foreground/40 transition-shadow focus-visible:ring-2"
              style={{ backgroundColor: iconColor }}
              aria-label="انتخاب آیکون"
            >
              <IconGlyph
                iconKey={values.appIconKey}
                fallback={fallbackChar}
                size={64}
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <PencilIcon className="size-4" />
              </span>
            </button>
            {values.appIconKey ? (
              <Button
                type="button"
                variant="ghost"
                className="h-9 self-start text-muted-foreground"
                onClick={() => patch("appIconKey", null)}
              >
                <XIcon className="size-4" />
                حذف آیکون
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">رنگ پس‌زمینه</Label>
            <ColorSwatches
              value={iconColor}
              onChange={(c) => patch("appIconColor", c)}
            />
          </div>
        </section>

        {/* ---- Live previews ---- */}
        <section className="space-y-3">
          <SectionTitle
            title="پیش‌نمایش زنده"
            hint="هرچه بالاتر تغییر می‌دهی، اینجا همان لحظه نشان داده می‌شود."
          />

          <SocialSharePreview
            url={previewUrl}
            title={previewTitle}
            description={previewDescription}
            ogUrl={ogShown}
            fallback={{
              name: effectiveFullName || `@${values.slug || "your-handle"}`,
              role: preview.title,
              avatarUrl: preview.avatarUrl,
              accent: iconColor,
              slug: values.slug || "your-handle",
            }}
          />

          <BrowserAndAppPreview
            title={previewTitle}
            url={previewUrl}
            slug={values.slug}
            iconColor={iconColor}
            iconKey={values.appIconKey}
            fallbackChar={fallbackChar}
          />
        </section>

        {/* ---- Search visibility (last, friendly copy) ---- */}
        <section>
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-3 py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                نمایش صفحه در نتایج گوگل
              </Label>
              <p className="text-[11px] text-muted-foreground">
                اگر روشن باشد، کسی که نامت را در گوگل جست‌وجو می‌کند می‌تواند
                صفحه‌ت را پیدا کند. خاموش که باشد، صفحه‌ت در گوگل پنهان می‌شود
                (خود لینک همچنان کار می‌کند).
              </p>
            </div>
            <Switch
              checked={values.indexEnabled}
              onCheckedChange={(c) => patch("indexEnabled", Boolean(c))}
            />
          </div>
        </section>

        {/* ---- Destructive: delete page ---- */}
        <section className="space-y-2 pt-2">
          <SectionTitle title="منطقه‌ی خطرناک" />
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                حذف کامل این صفحه
              </p>
              <p className="text-[11px] leading-relaxed text-destructive/80">
                صفحه و همه‌ی داده‌هایش (لینک‌ها، آمار، فرم‌ها، تنظیمات) برای
                همیشه پاک می‌شود. این عمل بازگشت‌پذیر نیست.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 self-start border-destructive/40 text-destructive hover:bg-destructive hover:text-white sm:self-auto"
              onClick={() => {
                setDeleteConfirm("");
                setDeleteOpen(true);
              }}
            >
              <Trash2Icon className="size-4" />
              حذف صفحه
            </Button>
          </div>
        </section>
      </div>

      <div className="safe-pb shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="h-11"
          >
            انصراف
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="h-11"
          >
            {isPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            ذخیره
          </Button>
        </div>
      </div>

      <IconPickerDialog
        open={iconOpen}
        onOpenChange={setIconOpen}
        onPick={(key) => {
          if (!key || key === "auto") {
            patch("appIconKey", null);
          } else if (isIconKey(key)) {
            patch("appIconKey", key);
            if (!values.appIconColor) {
              patch("appIconColor", DEFAULT_ICON_COLOR);
            }
          }
          setIconOpen(false);
        }}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => {
          if (!isDeleting) setDeleteOpen(o);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle className="text-destructive">حذف صفحه</DialogTitle>
          <DialogDescription>
            با حذف این صفحه، تمام لینک‌ها، آمار، فرم‌ها و تنظیمات آن برای همیشه
            از بین می‌رود. این عمل بازگشت‌پذیر نیست.
          </DialogDescription>
          <div className="space-y-2 pt-2">
            <Label htmlFor="delete-confirm" className="text-xs">
              برای تأیید، نام کاربری صفحه{" "}
              <span dir="ltr" className="font-mono font-bold">
                {initial.slug}
              </span>{" "}
              را وارد کن:
            </Label>
            <Input
              id="delete-confirm"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={initial.slug}
              disabled={isDeleting}
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
              className="h-11"
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                isDeleting ||
                deleteConfirm.trim().toLowerCase() !==
                  initial.slug.toLowerCase()
              }
              className="h-11"
              onClick={() => {
                startDeleteTransition(async () => {
                  const result = await deletePageAction(pageId, deleteConfirm);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  toast.success("صفحه حذف شد.");
                  setDeleteOpen(false);
                  onOpenChange(false);
                  router.push(result.redirectTo as Route);
                  router.refresh();
                });
              }}
            >
              {isDeleting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
              حذف نهایی
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const header = (
    <>
      <span className="text-base font-bold">تنظیمات صفحه</span>
      <span className="text-xs text-muted-foreground">
        آدرس، معرفی، آیکون و قابلیت پیدا شدن در گوگل.
      </span>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92dvh] overflow-hidden flex-col gap-0 rounded-t-3xl p-0"
        >
          <SheetHeader className="flex flex-col gap-0.5 border-b p-4 text-start">
            <SheetTitle className="text-base font-bold">
              تنظیمات صفحه
            </SheetTitle>
            <SheetDescription className="text-xs">
              آدرس، معرفی، آیکون و قابلیت پیدا شدن در گوگل.
            </SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90dvh,760px)] w-full max-w-xl flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
        <div className="flex shrink-0 flex-col gap-0.5 border-b px-5 py-4">
          <DialogTitle className="text-base font-bold">
            تنظیمات صفحه
          </DialogTitle>
          <DialogDescription className="text-xs">
            آدرس، معرفی، آیکون و قابلیت پیدا شدن در گوگل.
          </DialogDescription>
        </div>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- helpers ---------------- */

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-sm font-bold">{title}</Label>
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Field({
  id,
  label,
  counter,
  error,
  children,
}: {
  id?: string;
  label: string;
  counter?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        {counter ? (
          <span className="text-[10px] text-muted-foreground">{counter}</span>
        ) : null}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * Renders the chosen icon (white) absolutely positioned on whatever
 * background the parent supplies. The parent owns the box, color and
 * border-radius; this component only owns the glyph. This is what fixes
 * the bug where the bg color was overlaying the icon.
 */
function IconGlyph({
  iconKey,
  fallback,
  size,
}: {
  iconKey: IconKey | null;
  fallback: string;
  size: number;
}) {
  if (iconKey) {
    const entry = resolveIconEntry(iconKey, "");
    const Icon = entry.Icon;
    const inner = Math.round(size * 0.55);
    return (
      <span
        className="absolute inset-0 flex items-center justify-center text-white"
        aria-hidden
      >
        <Icon width={inner} height={inner} />
      </span>
    );
  }
  return (
    <span
      className="absolute inset-0 flex items-center justify-center font-black text-white"
      style={{ fontSize: Math.round(size * 0.55), lineHeight: 1 }}
      aria-hidden
    >
      {fallback}
    </span>
  );
}

/* ---------------- color swatches ---------------- */

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const customRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const isPreset = (COLOR_SWATCHES as readonly string[]).includes(
    value.toLowerCase(),
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLOR_SWATCHES.map((c) => {
        const selected = value.toLowerCase() === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            aria-pressed={selected}
            className={cn(
              "relative size-7 rounded-full transition-transform outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-foreground/40",
              selected ? "scale-110 ring-2 ring-foreground" : "hover:scale-105",
            )}
            style={{ backgroundColor: c }}
          >
            {selected ? (
              <CheckIcon
                className="absolute inset-0 m-auto size-3.5 text-white drop-shadow"
                strokeWidth={3}
              />
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => customRef.current?.click()}
        className={cn(
          "relative size-7 overflow-hidden rounded-full border-2 border-dashed border-border bg-background transition-colors hover:border-foreground",
          !isPreset && "border-foreground",
        )}
        aria-label="انتخاب رنگ دلخواه"
        style={
          !isPreset
            ? { backgroundColor: value, borderStyle: "solid" }
            : undefined
        }
      >
        {isPreset ? (
          <PlusIcon className="absolute inset-0 m-auto size-3.5 text-muted-foreground" />
        ) : (
          <CheckIcon
            className="absolute inset-0 m-auto size-3.5 text-white drop-shadow"
            strokeWidth={3}
          />
        )}
        <input
          ref={customRef}
          id={id}
          type="color"
          value={value || DEFAULT_ICON_COLOR}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </button>
    </div>
  );
}

/* ---------------- domain popover (dub.sh-style) ---------------- */

function DomainPopover({
  value,
  onChange,
}: {
  value: string;
  onChange: (d: ProfileDomain) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        className="flex h-11 min-w-34 items-center justify-between gap-2 border-e bg-muted/40 px-3 text-sm font-semibold transition-colors hover:bg-muted"
        type="button"
      >
        <span className="truncate" dir="ltr">
          {value}
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          sideOffset={6}
          align="start"
          className="z-50"
        >
          <PopoverPrimitive.Popup className="origin-(--transform-origin) w-56 overflow-hidden rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0">
            <ul role="listbox" className="flex flex-col">
              {PROFILE_DOMAINS.map((d) => {
                const selected = isProfileDomain(value) && d === value;
                return (
                  <li key={d}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(d);
                        setOpen(false);
                      }}
                      dir="ltr"
                      className={cn(
                        "flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm transition-colors",
                        selected
                          ? "bg-muted font-semibold"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <span>{d}</span>
                      {selected ? <CheckIcon className="size-4" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/* ---------------- icon picker dialog wrapper ---------------- */

function IconPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (key: IconKey | null) => void;
}) {
  const isMobile = useIsMobile();
  const body = (
    <LinkIconPicker
      url=""
      value={{ iconKey: null, iconUrl: null, imageUrl: null }}
      onChange={(v) => onPick(v.iconKey)}
    />
  );
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[80dvh] flex-col gap-0 rounded-t-3xl p-0"
        >
          <SheetTitle className="border-b px-4 py-3 text-center text-base font-bold">
            انتخاب آیکون
          </SheetTitle>
          <div className="flex min-h-0 flex-1 flex-col p-3">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(70dvh,560px)] w-full max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <DialogTitle className="border-b px-4 py-3 text-center text-base font-bold">
          انتخاب آیکون
        </DialogTitle>
        <div className="flex min-h-0 flex-1 flex-col p-3">{body}</div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- live previews ---------------- */

function PreviewLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  );
}

/** Mimics a Google search result card. Title -> URL -> description. */
function GooglePreview({
  url,
  title,
  description,
  iconColor,
  iconKey,
  fallbackChar,
}: {
  url: string;
  title: string;
  description: string;
  iconColor: string;
  iconKey: IconKey | null;
  fallbackChar: string;
}) {
  return (
    <div className="space-y-2">
      <PreviewLabel>نتیجه گوگل</PreviewLabel>
      <div
        className="rounded-2xl border bg-white p-4 shadow-sm"
        dir="ltr"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="relative inline-flex size-7 shrink-0 overflow-hidden rounded-full"
            style={{ backgroundColor: iconColor }}
          >
            <IconGlyph iconKey={iconKey} fallback={fallbackChar} size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-neutral-500">
              {url.split("/")[0]}
            </div>
            <div className="truncate text-xs text-neutral-700">
              https://{url}
            </div>
          </div>
        </div>
        <h3 className="mt-2 truncate text-lg font-medium text-[#1a0dab]">
          {title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
          {description}
        </p>
      </div>
    </div>
  );
}

/** Mimics how Telegram / iMessage / WhatsApp / Slack render a link card. */
function SocialSharePreview({
  url,
  title,
  description,
  ogUrl,
  fallback,
}: {
  url: string;
  title: string;
  description: string;
  ogUrl: string | null;
  fallback: {
    name: string;
    role: string;
    avatarUrl: string | null;
    accent: string;
    slug: string;
  };
}) {
  const host = url.split("/")[0];
  return (
    <div className="space-y-2">
      <PreviewLabel>وقتی لینک را در شبکه‌ای می‌فرستی</PreviewLabel>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div
          className="relative aspect-[1.91/1] w-full bg-neutral-100"
          dir="ltr"
        >
          {ogUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={ogUrl} alt="" className="size-full object-cover" />
          ) : (
            <AutoOgPreview
              name={fallback.name}
              avatarUrl={fallback.avatarUrl}
              slug={fallback.slug}
            />
          )}
        </div>
        <div className="space-y-1 p-3" dir="ltr">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            {host}
          </div>
          <div className="line-clamp-1 text-sm font-semibold text-neutral-900">
            {title}
          </div>
          <div className="line-clamp-2 text-xs text-neutral-600">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

/** When no OG image is uploaded, this mirrors the auto-generated fallback
 *  rendered by src/app/[slug]/opengraph-image/route.tsx. */
function AutoOgPreview({
  name,
  avatarUrl,
  slug,
}: {
  name: string;
  avatarUrl: string | null;
  slug: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "K";
  return (
    <div
      className="flex size-full flex-col items-center justify-center gap-2.5"
      style={{
        background: "#0a0a0a",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-white/10">
        {avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-xl font-black text-white">{initial}</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="line-clamp-1 text-sm font-black text-white">
          {name || "نام شما"}
        </span>
        <span className="text-[10px] text-white/50">
          @{slug || "your-handle"}
        </span>
      </div>
    </div>
  );
}

/** Two cards side by side: a desktop Chrome tab and an iOS home-screen tile. */
function BrowserAndAppPreview({
  title,
  url,
  slug,
  iconColor,
  iconKey,
  fallbackChar,
}: {
  title: string;
  url: string;
  slug: string;
  iconColor: string;
  iconKey: IconKey | null;
  fallbackChar: string;
}) {
  const appName = `@${slug || "your-handle"}`;
  return (
    <div className="space-y-2">
      <PreviewLabel>تب مرورگر و آیکون اپ</PreviewLabel>
      <div className="grid grid-cols-2 gap-3">
        {/* Browser tab */}
        <div className="space-y-2 rounded-2xl border bg-white p-3 shadow-sm">
          <div
            className="flex items-center gap-1.5 rounded-t-lg bg-neutral-100 p-1.5"
            dir="ltr"
          >
            <span className="size-2 rounded-full bg-red-400" />
            <span className="size-2 rounded-full bg-yellow-400" />
            <span className="size-2 rounded-full bg-green-400" />
          </div>
          <div
            className="flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5 shadow-sm"
            dir="ltr"
          >
            <span
              className="relative inline-flex size-4 shrink-0 overflow-hidden rounded"
              style={{ backgroundColor: iconColor }}
            >
              <IconGlyph iconKey={iconKey} fallback={fallbackChar} size={16} />
            </span>
            <span className="line-clamp-1 flex-1 text-[10px] font-medium text-neutral-700">
              {title}
            </span>
            <XIcon className="size-3 text-neutral-400" />
          </div>
          <div
            className="flex items-center gap-1 rounded-lg border bg-neutral-50 px-2 py-1 text-[10px] text-neutral-500"
            dir="ltr"
          >
            <GlobeIcon className="size-3" />
            <span className="truncate">{url}</span>
          </div>
        </div>

        {/* iOS home-screen tile */}
        <div
          className="relative flex flex-col items-center justify-center gap-2 rounded-2xl p-4 shadow-sm"
          style={{
            background: "#b8c4d0",
          }}
        >
          <div
            className="relative size-14 overflow-hidden shadow-md"
            style={{ backgroundColor: iconColor, borderRadius: 14 }}
          >
            <IconGlyph iconKey={iconKey} fallback={fallbackChar} size={56} />
          </div>
          <span
            className="line-clamp-1 max-w-full text-center text-[11px] font-medium text-white drop-shadow"
            dir="ltr"
          >
            {appName}
          </span>
        </div>
      </div>
    </div>
  );
}
