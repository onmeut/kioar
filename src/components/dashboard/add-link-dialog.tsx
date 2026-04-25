"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CalendarIcon,
  FileTextIcon,
  FormInputIcon,
  GlobeIcon,
  ImageIcon,
  Link2Icon,
  Loader2Icon,
  MailIcon,
  MusicIcon,
  PhoneIcon,
  PlayIcon,
  SearchIcon,
  SendIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LinkMetadata } from "@/lib/link-metadata";
import { detectIconKey, type IconKey } from "@/lib/link-icons";
import { cn } from "@/lib/utils";

import type { EditableLink } from "./links-manager.types";
import {
  LinkIconBubble,
  LinkIconPicker,
  type LinkIconPickerValue,
} from "./link-icon-picker";

export type LinkPresetKey =
  | "custom"
  | "website"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "telegram"
  | "linkedin"
  | "github"
  | "spotify"
  | "email"
  | "phone"
  | "calendar"
  | "shop";

export type LinkPreset = {
  key: LinkPresetKey;
  label: string;
  description: string;
  icon: LucideIcon;
  category: "suggested" | "social" | "media" | "contact" | "commerce";
  prefix?: string;
  defaultLabel?: string;
};

export const LINK_PRESETS: LinkPreset[] = [
  {
    key: "custom",
    label: "لینک دلخواه",
    description: "هر نشانی‌ای که خودتان دارید",
    icon: Link2Icon,
    category: "suggested",
  },
  {
    key: "website",
    label: "وب‌سایت",
    description: "سایت شخصی یا وبلاگ",
    icon: GlobeIcon,
    category: "suggested",
    prefix: "https://",
  },
  {
    key: "instagram",
    label: "اینستاگرام",
    description: "پست‌ها و ریلزهای شما",
    icon: UsersIcon,
    category: "social",
    prefix: "https://instagram.com/",
    defaultLabel: "اینستاگرام",
  },
  {
    key: "tiktok",
    label: "تیک‌تاک",
    description: "ویدیوهای کوتاه",
    icon: PlayIcon,
    category: "social",
    prefix: "https://www.tiktok.com/@",
    defaultLabel: "تیک‌تاک",
  },
  {
    key: "youtube",
    label: "یوتیوب",
    description: "کانال یوتیوب",
    icon: PlayIcon,
    category: "media",
    prefix: "https://youtube.com/@",
    defaultLabel: "یوتیوب",
  },
  {
    key: "twitter",
    label: "ایکس / توییتر",
    description: "پروفایل X",
    icon: UsersIcon,
    category: "social",
    prefix: "https://x.com/",
    defaultLabel: "ایکس",
  },
  {
    key: "telegram",
    label: "تلگرام",
    description: "کانال یا آیدی",
    icon: SendIcon,
    category: "social",
    prefix: "https://t.me/",
    defaultLabel: "تلگرام",
  },
  {
    key: "linkedin",
    label: "لینکدین",
    description: "پروفایل حرفه‌ای",
    icon: UsersIcon,
    category: "social",
    prefix: "https://linkedin.com/in/",
    defaultLabel: "لینکدین",
  },
  {
    key: "github",
    label: "گیت‌هاب",
    description: "پروفایل توسعه‌دهنده",
    icon: FileTextIcon,
    category: "social",
    prefix: "https://github.com/",
    defaultLabel: "گیت‌هاب",
  },
  {
    key: "spotify",
    label: "اسپاتیفای",
    description: "موزیک و پادکست",
    icon: MusicIcon,
    category: "media",
    prefix: "https://open.spotify.com/",
    defaultLabel: "اسپاتیفای",
  },
  {
    key: "email",
    label: "ایمیل",
    description: "آدرس ایمیل مستقیم",
    icon: MailIcon,
    category: "contact",
    prefix: "mailto:",
    defaultLabel: "ایمیل",
  },
  {
    key: "phone",
    label: "تماس",
    description: "شماره تلفن مستقیم",
    icon: PhoneIcon,
    category: "contact",
    prefix: "tel:",
    defaultLabel: "تماس",
  },
  {
    key: "calendar",
    label: "رزرو جلسه",
    description: "Cal.com یا Calendly",
    icon: CalendarIcon,
    category: "suggested",
    prefix: "https://cal.com/",
    defaultLabel: "رزرو جلسه",
  },
  {
    key: "shop",
    label: "فروشگاه",
    description: "محصولات شما",
    icon: ShoppingBagIcon,
    category: "commerce",
    prefix: "https://",
    defaultLabel: "فروشگاه",
  },
];

const CATEGORIES: Array<{
  key: LinkPreset["category"] | "suggested";
  label: string;
  icon: LucideIcon;
}> = [
  { key: "suggested", label: "پیشنهادی", icon: SparklesIcon },
  { key: "social", label: "اجتماعی", icon: UsersIcon },
  { key: "media", label: "رسانه", icon: PlayIcon },
  { key: "contact", label: "تماس", icon: MailIcon },
  { key: "commerce", label: "فروش", icon: ShoppingBagIcon },
];

const FEATURE_CARDS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "link", label: "لینک", icon: Link2Icon },
  { key: "bookings", label: "رزرو جلسه", icon: CalendarIcon },
  { key: "product", label: "محصول", icon: TagIcon },
  { key: "form", label: "فرم", icon: FormInputIcon },
];

type AddLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (link: Omit<EditableLink, "id" | "sortOrder">) => void;
  fetchMetadataAction: (
    url: string,
  ) => Promise<
    { ok: true; data: LinkMetadata } | { ok: false; message: string }
  >;
  uploadImage: (
    file: File,
    folder: "link-covers" | "link-icons",
  ) => Promise<string | null>;
  /** Invoked when the "bookings" feature card is picked. The dialog closes
   *  itself; the caller is responsible for opening the booking flow. */
  onAddBooking?: () => void;
};

export function AddLinkDialog({
  open,
  onOpenChange,
  onSubmit,
  fetchMetadataAction,
  uploadImage,
  onAddBooking,
}: AddLinkDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-hidden rounded-t-3xl p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">افزودن لینک</SheetTitle>
          <AddLinkDialogBody
            onClose={() => onOpenChange(false)}
            onSubmit={onSubmit}
            fetchMetadataAction={fetchMetadataAction}
            uploadImage={uploadImage}
            onAddBooking={onAddBooking}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-xl p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">افزودن لینک</DialogTitle>
        <AddLinkDialogBody
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
          fetchMetadataAction={fetchMetadataAction}
          uploadImage={uploadImage}
          onAddBooking={onAddBooking}
        />
      </DialogContent>
    </Dialog>
  );
}

type Step = "pick" | "compose";

function AddLinkDialogBody({
  onClose,
  onSubmit,
  fetchMetadataAction,
  uploadImage,
  onAddBooking,
}: {
  onClose: () => void;
  onSubmit: (link: Omit<EditableLink, "id" | "sortOrder">) => void;
  fetchMetadataAction: AddLinkDialogProps["fetchMetadataAction"];
  uploadImage: AddLinkDialogProps["uploadImage"];
  onAddBooking?: () => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<LinkPreset["category"]>("suggested");
  const [preset, setPreset] = useState<LinkPreset | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [iconKey, setIconKey] = useState<IconKey | null>("auto");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);

  const filteredPresets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return LINK_PRESETS.filter((item) =>
        activeCategory === "suggested"
          ? item.category === "suggested" ||
            ["instagram", "youtube", "tiktok"].includes(item.key)
          : item.category === activeCategory,
      );
    }
    return LINK_PRESETS.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        item.key.toLowerCase().includes(term),
    );
  }, [activeCategory, search]);

  const isUrlLike = /^(https?:\/\/|mailto:|tel:)/i.test(search.trim());

  const runMetadataFetch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
      if (trimmed === lastFetchedUrl) return;
      setLastFetchedUrl(trimmed);
      setFetchError(null);
      startFetch(async () => {
        const result = await fetchMetadataAction(trimmed);
        if (!result.ok) {
          setFetchError(result.message);
          return;
        }
        const data = result.data;
        if (data.title && !label) setLabel(data.title);
        else if (data.title && label === "") setLabel(data.title);
        if (data.description && !description) setDescription(data.description);
        if (data.image && !imageUrl) setImageUrl(data.image);
        if (data.url && data.url !== trimmed) setUrl(data.url);
      });
    },
    [fetchMetadataAction, label, description, imageUrl, lastFetchedUrl],
  );

  // Auto-fetch on URL changes while composing.
  useEffect(() => {
    if (step !== "compose") return;
    if (!url || !/^https?:\/\//i.test(url)) return;
    const handle = setTimeout(() => runMetadataFetch(url), 450);
    return () => clearTimeout(handle);
  }, [url, step, runMetadataFetch]);

  function resetState() {
    setStep("pick");
    setSearch("");
    setActiveCategory("suggested");
    setPreset(null);
    setUrl("");
    setLabel("");
    setDescription("");
    setImageUrl(null);
    setIconKey("auto");
    setIconUrl(null);
    setFetchError(null);
    setLastFetchedUrl(null);
  }

  function pick(preset: LinkPreset) {
    setPreset(preset);
    setStep("compose");
    const seedUrl = preset.prefix ?? "";
    setUrl(seedUrl);
    if (preset.defaultLabel) setLabel(preset.defaultLabel);
    setIconKey(detectIconKey(seedUrl) ?? "auto");
    setIconUrl(null);
  }

  function handlePasteUrl(value: string) {
    setPreset(LINK_PRESETS[0]);
    setStep("compose");
    setUrl(value);
    // Try to fetch metadata immediately too.
    runMetadataFetch(value);
  }

  function handleSubmit() {
    if (!label.trim() || !url.trim()) return;
    onSubmit({
      label: label.trim(),
      url: url.trim(),
      description: description.trim() || null,
      imageUrl: imageUrl || null,
      iconKey,
      iconUrl,
      isActive: true,
    });
    resetState();
    onClose();
  }

  return (
    <div className="flex max-h-[92dvh] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="text-lg font-bold">افزودن</h2>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => {
            resetState();
            onClose();
          }}
          aria-label="بستن"
        >
          <XIcon className="size-5" />
        </Button>
      </div>

      {step === "pick" ? (
        <>
          {/* Search */}
          <div className="border-b p-4 sm:p-5">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isUrlLike) {
                    event.preventDefault();
                    handlePasteUrl(search.trim());
                  }
                }}
                type="search"
                inputMode="url"
                enterKeyHint="go"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                dir="ltr"
                placeholder="نشانی لینک را پیست کنید یا جست‌وجو کنید"
                className="h-12 rounded-full ps-9 pe-24"
              />
              {isUrlLike ? (
                <Button
                  type="button"
                  size="sm"
                  className="absolute end-1.5 top-1/2 h-9 -translate-y-1/2 rounded-full px-4"
                  onClick={() => handlePasteUrl(search.trim())}
                >
                  ادامه
                </Button>
              ) : null}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {/* Feature cards (Linktree style) */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {FEATURE_CARDS.map((card) => {
                const CardIcon = card.icon;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => {
                      if (card.key === "bookings") {
                        onClose();
                        onAddBooking?.();
                      } else {
                        pick(LINK_PRESETS[0]);
                      }
                    }}
                    className="group flex aspect-square flex-col items-start justify-between rounded-3xl border bg-muted/30 p-3 text-start transition-colors hover:border-primary hover:bg-primary/5 sm:aspect-auto sm:h-24"
                  >
                    <span className="text-sm font-bold">{card.label}</span>
                    <CardIcon className="size-5 text-muted-foreground group-hover:text-primary" />
                  </button>
                );
              })}
            </div>

            {/* Category chips */}
            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const active = activeCategory === category.key;
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() =>
                      setActiveCategory(category.key as LinkPreset["category"])
                    }
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {category.label}
                  </button>
                );
              })}
            </div>

            {/* Suggested label */}
            <p className="mt-4 text-xs font-bold text-muted-foreground">
              {CATEGORIES.find((c) => c.key === activeCategory)?.label ??
                "پیشنهادی"}
            </p>

            {/* Preset list */}
            <div className="mt-2">
              {filteredPresets.length === 0 ? (
                <div className="rounded-4xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  موردی یافت نشد. می‌توانید نشانی لینک را مستقیماً پیست کنید.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {filteredPresets.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <li key={preset.key}>
                        <button
                          type="button"
                          onClick={() => pick(preset)}
                          className="group flex w-full items-center gap-3 rounded-3xl border border-transparent p-2.5 text-start transition-colors hover:border-border hover:bg-muted/50"
                        >
                          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                            <Icon className="size-5" />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-bold">
                              {preset.label}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {preset.description}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <ComposeStep
          preset={preset}
          url={url}
          label={label}
          description={description}
          imageUrl={imageUrl}
          iconKey={iconKey}
          iconUrl={iconUrl}
          isFetching={isFetching}
          fetchError={fetchError}
          onChangeUrl={setUrl}
          onChangeLabel={setLabel}
          onChangeDescription={setDescription}
          onChangeIcon={(next: LinkIconPickerValue) => {
            setIconKey(next.iconKey);
            setIconUrl(next.iconUrl);
          }}
          onChangeCover={setImageUrl}
          onClearImage={() => setImageUrl(null)}
          uploadImage={uploadImage}
          onBack={() => {
            setStep("pick");
            setPreset(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function ComposeStep({
  preset,
  url,
  label,
  description,
  imageUrl,
  iconKey,
  iconUrl,
  isFetching,
  fetchError,
  onChangeUrl,
  onChangeLabel,
  onChangeDescription,
  onChangeIcon,
  onChangeCover,
  onClearImage,
  uploadImage,
  onBack,
  onSubmit,
}: {
  preset: LinkPreset | null;
  url: string;
  label: string;
  description: string;
  imageUrl: string | null;
  iconKey: IconKey | null;
  iconUrl: string | null;
  isFetching: boolean;
  fetchError: string | null;
  onChangeUrl: (v: string) => void;
  onChangeLabel: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeIcon: (next: LinkIconPickerValue) => void;
  onChangeCover: (url: string | null) => void;
  onClearImage: () => void;
  uploadImage: (
    file: File,
    folder: "link-covers" | "link-icons",
  ) => Promise<string | null>;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  async function handleCoverFile(file: File) {
    setUploadingCover(true);
    try {
      const uploaded = await uploadImage(file, "link-covers");
      if (uploaded) onChangeCover(uploaded);
    } finally {
      setUploadingCover(false);
    }
  }
  const canSubmit = Boolean(url.trim()) && Boolean(label.trim());
  const Icon = preset?.icon ?? Link2Icon;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 rounded-full px-3 text-sm"
          onClick={onBack}
        >
          بازگشت
        </Button>
        <div className="ms-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4" />
          <span>{preset?.label ?? "لینک"}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="new-link-url">نشانی</Label>
          <div className="relative">
            <Input
              id="new-link-url"
              value={url}
              onChange={(event) => onChangeUrl(event.target.value)}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              placeholder="https://..."
              className="h-11 pe-10"
              autoFocus
            />
            {isFetching ? (
              <Loader2Icon className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {fetchError ? (
            <p className="text-xs text-muted-foreground">{fetchError}</p>
          ) : null}
        </div>

        {/* Preview card */}
        <div className="rounded-4xl bg-muted/30 p-3 border border-border">
          <div className="flex items-center gap-3">
            <LinkIconBubble
              iconKey={iconKey}
              iconUrl={iconUrl}
              imageUrl={imageUrl}
              url={url}
              size={56}
              className="rounded-2xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {label || "عنوان لینک"}
              </p>
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {url || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>آیکون</Label>
          <LinkIconPicker
            url={url}
            value={{ iconKey, iconUrl }}
            onChange={onChangeIcon}
            uploadIcon={(file) => uploadImage(file, "link-icons")}
          />
        </div>

        <div className="space-y-2">
          <Label>کاور (اختیاری)</Label>
          <div className="flex items-center gap-3">
            <div className="relative inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  className="size-full object-cover"
                  onError={onClearImage}
                />
              ) : (
                <ImageIcon className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
              >
                {uploadingCover ? "در حال آپلود…" : "بارگذاری کاور"}
              </Button>
              {imageUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-muted-foreground"
                  onClick={onClearImage}
                >
                  حذف کاور
                </Button>
              ) : null}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const f = event.target.files?.[0];
                event.target.value = "";
                if (f) handleCoverFile(f);
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-link-label">عنوان</Label>
          <Input
            id="new-link-label"
            value={label}
            onChange={(event) => onChangeLabel(event.target.value)}
            enterKeyHint="next"
            placeholder="مثلاً کانال تلگرام من"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-link-description">توضیح کوتاه (اختیاری)</Label>
          <Textarea
            id="new-link-description"
            value={description}
            onChange={(event) => onChangeDescription(event.target.value)}
            placeholder="در یک جمله بگویید مخاطب در این لینک چه می‌بیند."
            className="min-h-20"
            maxLength={160}
          />
          <p className="text-xs text-muted-foreground">
            {description.length}/۱۶۰
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t p-4 sm:p-5">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={onBack}
        >
          انصراف
        </Button>
        <Button
          type="button"
          className="h-11 px-6"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          افزودن به لینک‌ها
        </Button>
      </div>
    </div>
  );
}
