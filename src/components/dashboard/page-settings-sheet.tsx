"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  CameraIcon,
  GlobeIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  RectangleStencil,
  Cropper,
  type CropperRef,
} from "react-mobile-cropper";
import "react-mobile-cropper/dist/style.css";

import { ProfileAvatarModal } from "@/components/dashboard/profile-avatar-modal";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { DISCOVER_CATEGORIES, IRANIAN_CITIES } from "@/lib/discover";
import { PAGE_TYPES } from "@/lib/page-type";
import { type ProfileDomain } from "@/lib/profile-domains";
import { type IconKey } from "@/lib/link-icons";
import { KioarAvatar } from "@/components/shared/kioar-avatar";
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
  discoverEnabled: boolean;
  discoverCategory: string | null;
  city: string | null;
  pageType: string | null;
};

type Result =
  | { ok: true }
  | { ok: false; fieldErrors?: Record<string, string[] | undefined> };

type PreviewProfile = {
  fullName: string;
  title: string;
  avatarUrl: string | null;
  avatarSeed: string | null;
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
  onAvatarUpload: (file: File) => Promise<{ ok: true } | { ok: false }>;
  onAvatarDelete?: () => Promise<{ ok: true } | { ok: false }>;
  onAvatarPickSeed: (seed: string) => Promise<{ ok: true } | { ok: false }>;
};

/** Default brand OG fallback shown in previews when no upload is set. */
const DEFAULT_OG_URL = "/brand/og-default.png";

export function PageSettingsSheet({
  open,
  onOpenChange,
  pageId,
  initial,
  preview,
  onSave,
  onAvatarUpload,
  onAvatarDelete,
  onAvatarPickSeed,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<PageSettingsValues>(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [ogFile, setOgFile] = useState<File | null>(null);
  const [ogPreview, setOgPreview] = useState<string | null>(null);
  const [ogRemove, setOgRemove] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("og.png");
  const cropperRef = useRef<CropperRef>(null);
  const [isPending, startTransition] = useTransition();
  const [isOgSaving, startOgSaveTransition] = useTransition();
  const [isOgRemoving, startOgRemoveTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, startDeleteTransition] = useTransition();
  const [avatarOpen, setAvatarOpen] = useState(false);
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
    if (!f) return;
    if (f.size > 8_000_000) {
      toast.error("حجم تصویر بیش‌از حد است (حداکثر ۸ مگابایت).");
      return;
    }
    // Open cropper at 1.91:1 (1200×630) to enforce OG ratio.
    setCropFileName(f.name || "og.png");
    setCropSrc(URL.createObjectURL(f));
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function handleCropSave() {
    const currentValues = values;
    const canvas = cropperRef.current?.getCanvas({
      width: 1200,
      height: 630,
    });
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const baseName = cropFileName.replace(/\.[^.]+$/, "") || "og";
        const file = new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
        });
        if (cropSrc) URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
        if (ogPreview) URL.revokeObjectURL(ogPreview);
        const blobUrl = URL.createObjectURL(file);
        setOgPreview(blobUrl);
        setOgFile(file);
        setOgRemove(false);
        // Auto-save the OG image immediately; keep the modal open.
        startOgSaveTransition(async () => {
          const result = await onSave({
            ...currentValues,
            ogImageFile: file,
            ogImageRemove: false,
          });
          if (result.ok) {
            setOgFile(null); // already on server — no re-upload on manual save
            toast.success("تصویر اشتراک‌گذاری ذخیره شد.");
          }
          // on failure ogFile stays set → ذخیره button will retry
        });
      },
      "image/jpeg",
      0.9,
    );
  }

  function handleOgRemove() {
    const currentValues = values;
    const hadUrl = values.ogImageUrl;
    setOgFile(null);
    if (ogPreview) URL.revokeObjectURL(ogPreview);
    setOgPreview(null);
    setOgRemove(true);
    if (fileRef.current) fileRef.current.value = "";
    // Auto-save removal immediately (also deletes file from storage on server).
    if (!hadUrl) return; // nothing to delete
    startOgRemoveTransition(async () => {
      const result = await onSave({
        ...currentValues,
        ogImageFile: null,
        ogImageRemove: true,
      });
      if (result.ok) {
        toast.success("تصویر حذف شد.");
        setOgRemove(false); // server already cleared it
      } else {
        toast.error("حذف تصویر ناموفق بود.");
        setOgRemove(false);
      }
    });
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

  // What to display for the OG image: pending crop > existing > brand default.
  const ogShown =
    ogPreview ??
    (ogRemove ? DEFAULT_OG_URL : (values.ogImageUrl ?? DEFAULT_OG_URL));
  const ogIsCustom =
    Boolean(ogPreview) || (!ogRemove && Boolean(values.ogImageUrl));

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
    `@${values.slug || "elonmusk"}`;
  const previewDescription =
    values.seoDescription.trim() ||
    `صفحه‌ی شخصی ${effectiveFullName || `@${values.slug || "elonmusk"}`} روی کی‌یو‌آر — لینک‌ها، رویدادها و راه‌های ارتباطی.`;
  const previewUrl = `kioar.com/${values.slug || "elonmusk"}`;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 py-5 md:px-6">
        {/* ---- Avatar ---- */}
        <div className="flex flex-col items-center gap-2 py-3">
          <button
            type="button"
            onClick={() => setAvatarOpen(true)}
            aria-label="تغییر تصویر پروفایل"
            className="group relative size-24 shrink-0 overflow-hidden rounded-full border border-foreground/10 bg-card"
          >
            {preview.avatarUrl ? (
              <Image
                src={preview.avatarUrl}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <KioarAvatar seed={preview.avatarSeed} size={96} />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <CameraIcon className="size-5 text-white" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAvatarOpen(true)}
            className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            تغییر تصویر
          </button>
        </div>

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
          <SectionTitle title="آدرس صفحه" hint="نام کاربری صفحه‌ی شما." />

          <div
            dir="ltr"
            className="flex items-stretch overflow-hidden rounded-2xl border bg-background"
          >
            <div className="flex h-11 items-center border-e bg-muted/40 px-3 text-sm font-semibold text-muted-foreground">
              kioar.com/
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
              placeholder="elonmusk"
            />
          </div>
          {errors.slug?.[0] ? (
            <p className="text-xs text-destructive">{errors.slug[0]}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              فقط حروف انگلیسی، عدد و خط تیره. اگر نام کاربری را عوض کنی، آدرس
              قبلی دیگر کار نمی‌کند
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
            avatarUrl={preview.avatarUrl}
            avatarSeed={preview.avatarSeed}
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
            ogIsCustom={ogIsCustom}
            isSaving={isOgSaving || isOgRemoving}
            onPick={() => fileRef.current?.click()}
            onRemove={handleOgRemove}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleOgPick}
          />

          <BrowserAndAppPreview
            title={previewTitle}
            url={previewUrl}
            appName={effectiveFullName || `@${values.slug || "elonmusk"}`}
            avatarUrl={preview.avatarUrl}
            avatarSeed={preview.avatarSeed}
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

        {/* ---- Discover ---- */}
        <section className="space-y-3">
          <SectionTitle
            title="دیسکاور"
            hint="اگر روشن باشد، صفحه‌ات در فهرست عمومی کیوآر (kioar.com/discover) دیده می‌شود تا کاربران تازه‌ای پیدایش کنند."
          />
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/40 px-3 py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">نمایش در دیسکاور</Label>
              <p className="text-[11px] text-muted-foreground">
                فقط صفحه‌های منتشرشده و کامل در دیسکاور لیست می‌شوند.
              </p>
            </div>
            <Switch
              checked={values.discoverEnabled}
              onCheckedChange={(c) => patch("discoverEnabled", Boolean(c))}
            />
          </div>

          <Field id="page-category" label="دسته‌بندی">
            <Select
              value={values.discoverCategory ?? "__none"}
              onValueChange={(v) =>
                patch("discoverCategory", v === "__none" ? null : v)
              }
              disabled={!values.discoverEnabled}
            >
              <SelectTrigger id="page-category" className="h-11 w-full">
                <SelectValue placeholder="یک دسته انتخاب کن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">بدون دسته‌بندی</SelectItem>
                {DISCOVER_CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    <span className="me-1">{c.emoji}</span>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="page-type" label="نوع صفحه">
            <Select
              value={values.pageType ?? "__none"}
              onValueChange={(v) =>
                patch("pageType", v === "__none" ? null : v)
              }
            >
              <SelectTrigger id="page-type" className="h-11 w-full">
                <SelectValue placeholder="نوع صفحه را انتخاب کن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">انتخاب نشده</SelectItem>
                {PAGE_TYPES.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field id="page-city" label="شهر">
            <Select
              value={values.city ?? "__none"}
              onValueChange={(v) => patch("city", v === "__none" ? null : v)}
              disabled={!values.discoverEnabled}
            >
              <SelectTrigger id="page-city" className="h-11 w-full">
                <SelectValue placeholder="شهرت را انتخاب کن" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">انتخاب نشده</SelectItem>
                {IRANIAN_CITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
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
    </>
  );

  // OG-image cropper overlay (portalled directly to <body> so no
  // ancestor `transform`/`isolation` can pin its z-index). Locked to
  // 1200×630 (1.91:1) — the real OG ratio Telegram, iMessage, X, etc.
  // render. Mirror of the avatar cropper, but rectangular.
  const cropOverlay =
    cropSrc && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 flex flex-col bg-black"
            style={{ zIndex: 9999 }}
            dir="ltr"
          >
            <div className="relative min-h-0 flex-1">
              <Cropper
                ref={cropperRef}
                src={cropSrc}
                stencilComponent={RectangleStencil}
                stencilProps={{ aspectRatio: 1200 / 630, grid: true }}
                style={{ width: "100%", height: "100%" }}
                className="size-full"
              />
            </div>
            <div className="safe-pb flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-black px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCropCancel}
                className="h-11 text-white hover:bg-white/10 hover:text-white"
              >
                انصراف
              </Button>
              <Button
                type="button"
                onClick={handleCropSave}
                className="h-11 bg-white text-black hover:bg-white/90"
              >
                ذخیره
              </Button>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="flex max-h-[92dvh] overflow-hidden flex-col gap-0 rounded-t-3xl p-0"
          >
            <SheetHeader className="flex flex-col gap-0.5 border-b p-4 text-start">
              <SheetTitle className="text-base font-bold">
                تنظیمات صفحه
              </SheetTitle>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
        <ProfileAvatarModal
          open={avatarOpen}
          onOpenChange={setAvatarOpen}
          currentUrl={preview.avatarUrl}
          avatarSeed={preview.avatarSeed}
          displayName={preview.fullName}
          onUpload={onAvatarUpload}
          onDelete={onAvatarDelete}
          onPickSeed={onAvatarPickSeed}
        />
        {cropOverlay}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[min(90dvh,760px)] w-full max-w-xl flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          <div className="flex shrink-0 flex-col gap-0.5 border-b px-5 py-4">
            <DialogTitle className="text-base font-bold">
              تنظیمات صفحه
            </DialogTitle>
          </div>
          {body}
        </DialogContent>
      </Dialog>
      <ProfileAvatarModal
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        currentUrl={preview.avatarUrl}
        avatarSeed={preview.avatarSeed}
        displayName={preview.fullName}
        onUpload={onAvatarUpload}
        onDelete={onAvatarDelete}
        onPickSeed={onAvatarPickSeed}
      />
      {cropOverlay}
    </>
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

/* ---------------- live previews ---------------- */

/** Mimics a Google search result card. Title -> URL -> description. */
function GooglePreview({
  url,
  title,
  description,
  avatarUrl,
  avatarSeed,
  fallbackChar,
}: {
  url: string;
  title: string;
  description: string;
  avatarUrl: string | null;
  avatarSeed: string | null;
  fallbackChar: string;
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-4 shadow-sm"
      dir="ltr"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="flex items-center gap-2">
        <span className="relative inline-flex size-7 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : avatarSeed ? (
            <KioarAvatar seed={avatarSeed} size={28} />
          ) : (
            <span className="flex size-full items-center justify-center text-xs font-bold text-neutral-700">
              {fallbackChar}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-neutral-500">
            {url.split("/")[0]}
          </div>
          <div className="truncate text-xs text-neutral-700">https://{url}</div>
        </div>
      </div>
      <h3
        className="mt-2 truncate text-lg font-medium text-[#1a0dab]"
        dir="rtl"
      >
        {title}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-neutral-600" dir="rtl">
        {description}
      </p>
    </div>
  );
}

/** Mimics how Telegram / iMessage / WhatsApp / Slack render a link card.
 *  The hero photo is also the click target for changing the OG image. */
function SocialSharePreview({
  url,
  title,
  description,
  ogUrl,
  ogIsCustom,
  isSaving,
  onPick,
  onRemove,
}: {
  url: string;
  title: string;
  description: string;
  ogUrl: string;
  ogIsCustom: boolean;
  isSaving?: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  const host = url.split("/")[0];
  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <button
          type="button"
          onClick={onPick}
          aria-label="تغییر عکس اشتراک‌گذاری"
          className="group relative block aspect-[1.91/1] w-full overflow-hidden bg-neutral-100"
          dir="ltr"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ogUrl} alt="" className="size-full object-cover" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-black">
              <PencilIcon className="size-3.5" />
              تغییر عکس
            </span>
          </span>
          {isSaving ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2Icon className="size-6 animate-spin text-white" />
            </span>
          ) : null}
          {ogIsCustom ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="حذف عکس اشتراک‌گذاری"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }
              }}
              className="absolute inset-e-2 top-2 inline-flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white outline-none ring-offset-2 ring-offset-black/40 transition-colors hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-white"
            >
              <Trash2Icon className="size-3.5" />
            </span>
          ) : null}
        </button>
        <div className="space-y-1 p-3" dir="ltr">
          <div className="text-xs uppercase text-neutral-500">{host}</div>
          <div className="line-clamp-1 text-sm font-semibold text-neutral-900">
            {title}
          </div>
          <div className="line-clamp-2 text-xs text-neutral-600">
            {description}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        نسبت پیشنهادی ۱۲۰۰×۶۳۰. اگر عکسی نگذاری، تصویر پیش‌فرض برند نمایش داده
        می‌شود.
      </p>
    </div>
  );
}

/** Two cards side by side: a desktop Chrome tab and an iOS home-screen tile.
 *  Both icons reuse the user's avatar so previews always match what the
 *  system actually generates for favicon / app icon. */
function BrowserAndAppPreview({
  title,
  url,
  appName,
  avatarUrl,
  avatarSeed,
  fallbackChar,
}: {
  title: string;
  url: string;
  appName: string;
  avatarUrl: string | null;
  avatarSeed: string | null;
  fallbackChar: string;
}) {
  const renderAvatar = (size: number, rounded: string) => (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden ${rounded} bg-neutral-100`}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : avatarSeed ? (
        <KioarAvatar seed={avatarSeed} size={size} />
      ) : (
        <span
          className="flex size-full items-center justify-center font-bold text-neutral-700"
          style={{ fontSize: Math.round(size * 0.55) }}
        >
          {fallbackChar}
        </span>
      )}
    </span>
  );

  return (
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
          {renderAvatar(16, "rounded")}
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
      <div className="relative flex flex-col items-center justify-center gap-2 rounded-2xl border bg-white p-4 shadow-sm">
        <div
          className="relative size-14 overflow-hidden shadow-md"
          style={{ borderRadius: 14 }}
        >
          {renderAvatar(56, "rounded-none")}
        </div>
        <span className="line-clamp-1 max-w-full text-center text-[11px] font-medium text-neutral-900">
          {appName}
        </span>
      </div>
    </div>
  );
}
