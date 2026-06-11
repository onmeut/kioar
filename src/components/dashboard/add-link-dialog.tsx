"use client";

import { useCallback, useState } from "react";
import {
  ArrowRightIcon,
  CalendarIcon,
  CalendarDaysIcon,
  DownloadIcon,
  FileTextIcon,
  FormInputIcon,
  GlobeIcon,
  ImagesIcon,
  Link2Icon,
  LockIcon,
  Loader2Icon,
  MailIcon,
  MusicIcon,
  PhoneIcon,
  PlayIcon,
  PlayCircleIcon,
  SendIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TagIcon,
  TypeIcon,
  UsersIcon,
  UtensilsIcon,
  WrenchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LinkMetadata } from "@/lib/link-metadata";
import { detectIconKey, type IconKey } from "@/lib/link-icons";
import type { IconNode } from "@/lib/icons/icon-node";
import { cn } from "@/lib/utils";
import {
  isSafeLinkUrl,
  normalizeLinkUrl,
  type MediaBlockMode,
  type MediaBlockPreset,
  type ProductBlockPreset,
} from "@/lib/validations";
import type { MediaPanelCopy } from "@/components/dashboard/media-builder-dialog";
import {
  UpgradePlanModal,
  type UpgradePlanTier,
} from "@/components/dashboard/upgrade-plan-modal";

import type { EditableLink } from "./links-manager.types";
import { type LinkIconPickerValue } from "./link-icon-picker";
import { LinkIconPickerButton } from "./link-icon-picker-button";

export type LinkPresetKey =
  | "custom"
  | "website"
  | "instagram"
  | "youtube"
  | "twitter"
  | "telegram"
  | "linkedin"
  | "github"
  | "spotify"
  | "email"
  | "phone"
  | "shop";

export type LinkPreset = {
  key: LinkPresetKey;
  label: string;
  description: string;
  icon: LucideIcon;
  category: "suggested" | "social" | "media" | "contact" | "commerce";
  prefix?: string;
  defaultLabel?: string;
  /** When true, show a username (@) input instead of a full URL field.
   *  The full URL is built as `prefix + username` before saving. */
  usernameOnly?: boolean;
};

export const LINK_PRESETS: LinkPreset[] = [
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
    description: "پست\u200cها و ریلزهای خود را نمایش دهید",
    icon: UsersIcon,
    category: "social",
    prefix: "https://instagram.com/",
    defaultLabel: "اینستاگرام",
    usernameOnly: true,
  },
  {
    key: "youtube",
    label: "یوتیوب",
    description: "ویدیوهای یوتیوب را به اشتراک بگذارید",
    icon: PlayIcon,
    category: "media",
    prefix: "https://youtube.com/@",
    defaultLabel: "یوتیوب",
    usernameOnly: true,
  },
  {
    key: "twitter",
    label: "ایکس / توییتر",
    description: "پروفایل X خود را به اشتراک بگذارید",
    icon: UsersIcon,
    category: "social",
    prefix: "https://x.com/",
    defaultLabel: "ایکس",
    usernameOnly: true,
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
    key: "shop",
    label: "فروشگاه",
    description: "محصولات شما",
    icon: ShoppingBagIcon,
    category: "commerce",
    prefix: "https://",
    defaultLabel: "فروشگاه",
  },
];

const FEATURE_CARDS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: "link", label: "لینک", icon: Link2Icon },
  { key: "bookings", label: "هماهنگ", icon: CalendarIcon },
  { key: "product", label: "محصول", icon: TagIcon },
  { key: "menu", label: "منو", icon: UtensilsIcon },
  { key: "services", label: "خدمات", icon: WrenchIcon },
  { key: "form", label: "فرم", icon: FormInputIcon },
  { key: "event", label: "رویداد", icon: CalendarDaysIcon },
  { key: "text", label: "متن", icon: TypeIcon },
  // ---- media variants (all share the one media_block entitlement) ----
  { key: "gallery", label: "گالری", icon: ImagesIcon },
  { key: "video", label: "ویدئو", icon: PlayCircleIcon },
  { key: "resume", label: "رزومه", icon: FileTextIcon },
  { key: "download", label: "فایل", icon: DownloadIcon },
];

/** The "menu" and "services" cards are product blocks pre-set to a preset.
 * They share the product entitlement + lock state — only the seeded preset,
 * default name, and default slug differ. */
const PRODUCT_PRESET_CARDS: Record<string, ProductBlockPreset> = {
  product: "shop",
  menu: "menu",
  services: "services",
};

/** Config the chosen media variant card opens the builder with. All variants
 * are thin wrappers over the same media engine + entitlement — only the
 * default `mode`, `preset`, and panel `copy` differ. */
export type MediaCardConfig = {
  mode: MediaBlockMode;
  preset: MediaBlockPreset;
  copy: MediaPanelCopy;
};

const MEDIA_PRESET_CARDS: Record<string, MediaCardConfig> = {
  gallery: {
    mode: "photos",
    preset: "gallery",
    copy: {
      heading: "گالری تصاویر",
      hint: "عکس‌های خود را اضافه کنید؛ چند عکس به‌صورت اسلایدی نمایش داده می‌شود.",
      addLabel: "افزودن عکس",
    },
  },
  video: {
    mode: "video",
    preset: "video",
    copy: {
      heading: "ویدئو",
      hint: "یک ویدئو آپلود کنید یا لینک یوتیوب/آپارات را بچسبانید.",
      addLabel: "آپلود ویدئو",
    },
  },
  resume: {
    mode: "file",
    preset: "resume",
    copy: {
      heading: "رزومه",
      hint: "فایل رزومه (PDF) خود را بارگذاری کنید تا بازدیدکننده آن را ببیند یا دانلود کند.",
      addLabel: "آپلود رزومه (PDF)",
    },
  },
  download: {
    mode: "file",
    preset: "download",
    copy: {
      heading: "فایل",
      hint: "هر فایل قابل دانلودی را اضافه کنید: راهنما، لیست قیمت، فایل هدیه و…",
      addLabel: "آپلود فایل (PDF)",
    },
  },
};

type AddLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (link: Omit<EditableLink, "id" | "sortOrder">) => void;
  fetchMetadataAction: (
    url: string,
  ) => Promise<
    { ok: true; data: LinkMetadata } | { ok: false; message: string }
  >;
  /** Invoked when the "bookings" feature card is picked. The dialog closes
   *  itself; the caller is responsible for opening the booking flow. */
  onAddBooking?: () => void;
  /** Invoked when the "form" feature card is picked. The dialog closes
   *  itself; the caller is responsible for opening the form builder. */
  onAddForm?: () => void;
  /** Invoked when the "product" / "menu" / "services" feature card is picked.
   *  The dialog closes itself; the caller opens the product builder pre-set to
   *  the given preset. */
  onAddProduct?: (preset: ProductBlockPreset) => void;
  /** Invoked when the "event" feature card is picked. The dialog closes
   *  itself; the caller navigates to the event creation route. */
  onAddEvent?: () => void;
  /** When true, the bookings card shows a lock badge and opens upgrade modal on click. */
  bookingsLocked?: boolean;
  bookingsRequiredPlan?: UpgradePlanTier;
  /** When true, the form card shows a lock badge and opens upgrade modal on click. */
  formsLocked?: boolean;
  formsRequiredPlan?: UpgradePlanTier;
  /** When true, the product card shows a lock badge and opens upgrade modal on click. */
  productsLocked?: boolean;
  productsRequiredPlan?: UpgradePlanTier;
  /** When true, the event card shows a lock badge and opens upgrade modal on click. */
  eventsLocked?: boolean;
  eventsRequiredPlan?: UpgradePlanTier;
  /** Invoked when the "text" feature card is picked. The dialog closes
   *  itself; the caller opens the text block editor. */
  onAddText?: () => void;
  /** When true, the text card shows a lock badge and opens upgrade modal on click. */
  textLocked?: boolean;
  textRequiredPlan?: UpgradePlanTier;
  /** Invoked when any media variant card (gallery/video/resume/…) is picked.
   *  The dialog closes itself; the caller opens the media builder pre-set to
   *  the given config. All variants share the one media entitlement. */
  onAddMedia?: (config: MediaCardConfig) => void;
  /** When true, media cards show a lock badge and open upgrade modal on click.
   *  (Media is granted on every plan today, so this is normally false.) */
  mediaLocked?: boolean;
  mediaRequiredPlan?: UpgradePlanTier;
};

export function AddLinkDialog({
  open,
  onOpenChange,
  onSubmit,
  fetchMetadataAction,
  onAddBooking,
  onAddForm,
  onAddProduct,
  onAddEvent,
  bookingsLocked = false,
  bookingsRequiredPlan = "business",
  formsLocked = false,
  formsRequiredPlan = "business",
  productsLocked = false,
  productsRequiredPlan = "pro",
  eventsLocked = false,
  eventsRequiredPlan = "business",
  onAddText,
  textLocked = false,
  textRequiredPlan = "pro",
  onAddMedia,
  mediaLocked = false,
  mediaRequiredPlan = "pro",
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
          <SheetTitle className="sr-only">افزودن بلوک</SheetTitle>
          <AddLinkDialogBody
            onClose={() => onOpenChange(false)}
            onSubmit={onSubmit}
            fetchMetadataAction={fetchMetadataAction}
            onAddBooking={onAddBooking}
            onAddForm={onAddForm}
            onAddProduct={onAddProduct}
            onAddEvent={onAddEvent}
            bookingsLocked={bookingsLocked}
            bookingsRequiredPlan={bookingsRequiredPlan}
            formsLocked={formsLocked}
            formsRequiredPlan={formsRequiredPlan}
            productsLocked={productsLocked}
            productsRequiredPlan={productsRequiredPlan}
            eventsLocked={eventsLocked}
            eventsRequiredPlan={eventsRequiredPlan}
            onAddText={onAddText}
            textLocked={textLocked}
            textRequiredPlan={textRequiredPlan}
            onAddMedia={onAddMedia}
            mediaLocked={mediaLocked}
            mediaRequiredPlan={mediaRequiredPlan}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">افزودن بلوک</DialogTitle>
        <AddLinkDialogBody
          onClose={() => onOpenChange(false)}
          onSubmit={onSubmit}
          fetchMetadataAction={fetchMetadataAction}
          onAddBooking={onAddBooking}
          onAddForm={onAddForm}
          onAddProduct={onAddProduct}
          onAddEvent={onAddEvent}
          bookingsLocked={bookingsLocked}
          bookingsRequiredPlan={bookingsRequiredPlan}
          formsLocked={formsLocked}
          formsRequiredPlan={formsRequiredPlan}
          productsLocked={productsLocked}
          productsRequiredPlan={productsRequiredPlan}
          eventsLocked={eventsLocked}
          eventsRequiredPlan={eventsRequiredPlan}
          onAddText={onAddText}
          textLocked={textLocked}
          textRequiredPlan={textRequiredPlan}
          onAddMedia={onAddMedia}
          mediaLocked={mediaLocked}
          mediaRequiredPlan={mediaRequiredPlan}
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
  onAddBooking,
  onAddForm,
  onAddProduct,
  onAddEvent,
  bookingsLocked,
  bookingsRequiredPlan,
  formsLocked,
  formsRequiredPlan,
  productsLocked,
  productsRequiredPlan,
  eventsLocked,
  eventsRequiredPlan,
  onAddText,
  textLocked,
  textRequiredPlan,
  onAddMedia,
  mediaLocked,
  mediaRequiredPlan,
}: {
  onClose: () => void;
  onSubmit: (link: Omit<EditableLink, "id" | "sortOrder">) => void;
  fetchMetadataAction: AddLinkDialogProps["fetchMetadataAction"];
  onAddBooking?: () => void;
  onAddForm?: () => void;
  onAddProduct?: (preset: ProductBlockPreset) => void;
  onAddEvent?: () => void;
  bookingsLocked?: boolean;
  bookingsRequiredPlan?: UpgradePlanTier;
  formsLocked?: boolean;
  formsRequiredPlan?: UpgradePlanTier;
  productsLocked?: boolean;
  productsRequiredPlan?: UpgradePlanTier;
  eventsLocked?: boolean;
  eventsRequiredPlan?: UpgradePlanTier;
  onAddText?: () => void;
  textLocked?: boolean;
  textRequiredPlan?: UpgradePlanTier;
  onAddMedia?: (config: MediaCardConfig) => void;
  mediaLocked?: boolean;
  mediaRequiredPlan?: UpgradePlanTier;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [preset, setPreset] = useState<LinkPreset | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [iconKey, setIconKey] = useState<IconKey | null>("auto");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [iconNodes, setIconNodes] = useState<IconNode[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{
    plan: UpgradePlanTier;
    featureName: string;
  } | null>(null);


  const runMetadataFetch = useCallback(
    async (value: string, opts: { force?: boolean } = {}) => {
      const trimmed = normalizeLinkUrl(value);
      if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
      if (!opts.force && trimmed === lastFetchedUrl) return;
      setLastFetchedUrl(trimmed);
      setFetchError(null);
      setIsFetching(true);
      try {
        const result = await fetchMetadataAction(trimmed);
        if (!result.ok) {
          setFetchError(result.message);
          return;
        }
        const data = result.data;
        const gotAnything = Boolean(
          data.title || data.description || data.image,
        );
        if (data.title && (opts.force || !label)) setLabel(data.title);
        if (data.description && (opts.force || !description))
          setDescription(data.description);
        if (data.image && (opts.force || !imageUrl)) setImageUrl(data.image);
        if (!gotAnything) {
          // Server fetched fine but the target hid OG tags from us
          // (Medium, sites behind CDN bot protection, etc.). Tell the user
          // explicitly instead of leaving the click looking like a no-op.
          setFetchError(
            "اطلاعاتی از این لینک پیدا نکردیم. لطفاً عنوان و توضیح را دستی وارد کنید.",
          );
        }
      } catch {
        setFetchError("دریافت اطلاعات با خطا مواجه شد.");
      } finally {
        setIsFetching(false);
      }
    },
    [fetchMetadataAction, label, description, imageUrl, lastFetchedUrl],
  );

  function resetState() {
    setStep("pick");
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
    // For username-only presets, start with an empty string.
    // For regular presets, seed the URL with the prefix.
    const seedUrl = preset.usernameOnly ? "" : (preset.prefix ?? "");
    setUrl(seedUrl);
    if (preset.defaultLabel) setLabel(preset.defaultLabel);
    // Detect icon using the prefix URL so the correct brand icon is shown.
    setIconKey(detectIconKey(preset.prefix ?? seedUrl) ?? "auto");
    setIconUrl(null);
  }

  function pickCustom() {
    setPreset(null);
    setStep("compose");
    setUrl("");
    setIconKey("auto");
    setIconUrl(null);
  }

  function handleSubmit() {
    const trimmedLabel = label.trim();
    let normalizedUrl: string;
    if (preset?.usernameOnly && preset.prefix) {
      normalizedUrl = normalizeLinkUrl(
        preset.prefix + url.trim().replace(/^@/, ""),
      );
    } else {
      normalizedUrl = normalizeLinkUrl(url);
    }
    if (!trimmedLabel || !isSafeLinkUrl(normalizedUrl)) return;
    onSubmit({
      label: trimmedLabel,
      url: normalizedUrl,
      description: description.trim() || null,
      imageUrl: imageUrl || null,
      iconKey,
      iconUrl,
      isActive: true,
      spotlight: "none",
      animationStyle: null,
    });
    resetState();
    onClose();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="grid shrink-0 grid-cols-[40px_1fr_40px] items-center border-b px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex">
          {step === "compose" ? (
            <button
              type="button"
              onClick={() => {
                setStep("pick");
                setPreset(null);
              }}
              aria-label="بازگشت"
              className="tap-target inline-flex size-10 items-center justify-center rounded-2xl border border-border bg-background text-foreground transition-colors hover:bg-muted"
            >
              <ArrowRightIcon className="size-5" />
            </button>
          ) : null}
        </div>
        <h2 className="text-center text-lg font-bold">افزودن بلوک</h2>
        <div className="flex justify-end">
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
      </div>

      {step === "pick" ? (
        <>
          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {/* Feature cards (Linktree style) */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {FEATURE_CARDS.map((card) => {
                const CardIcon = card.icon;
                const isProductCard = card.key in PRODUCT_PRESET_CARDS;
                const isMediaCard = card.key in MEDIA_PRESET_CARDS;
                const isLocked =
                  (card.key === "bookings" && bookingsLocked) ||
                  (card.key === "form" && formsLocked) ||
                  (isProductCard && productsLocked) ||
                  (card.key === "event" && eventsLocked) ||
                  (card.key === "text" && textLocked) ||
                  (isMediaCard && mediaLocked);
                const lockedPlan =
                  card.key === "bookings"
                    ? bookingsRequiredPlan
                    : card.key === "form"
                      ? formsRequiredPlan
                      : isProductCard
                        ? productsRequiredPlan
                        : card.key === "event"
                          ? eventsRequiredPlan
                          : card.key === "text"
                            ? textRequiredPlan
                            : isMediaCard
                              ? mediaRequiredPlan
                              : undefined;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => {
                      if (card.key === "bookings") {
                        if (bookingsLocked) {
                          setUpgradeModal({
                            plan: bookingsRequiredPlan ?? "business",
                            featureName: "بلاک هماهنگ",
                          });
                        } else {
                          onClose();
                          onAddBooking?.();
                        }
                      } else if (card.key === "form") {
                        if (formsLocked) {
                          setUpgradeModal({
                            plan: formsRequiredPlan ?? "business",
                            featureName: "بلاک فرم",
                          });
                        } else {
                          onClose();
                          onAddForm?.();
                        }
                      } else if (isProductCard) {
                        if (productsLocked) {
                          setUpgradeModal({
                            plan: productsRequiredPlan ?? "pro",
                            featureName:
                              card.key === "menu"
                                ? "بلاک منو"
                                : card.key === "services"
                                  ? "بلاک خدمات"
                                  : "بلاک محصول",
                          });
                        } else {
                          onClose();
                          onAddProduct?.(PRODUCT_PRESET_CARDS[card.key]);
                        }
                      } else if (card.key === "event") {
                        if (eventsLocked) {
                          setUpgradeModal({
                            plan: eventsRequiredPlan ?? "business",
                            featureName: "بلاک رویداد",
                          });
                        } else {
                          onClose();
                          onAddEvent?.();
                        }
                      } else if (card.key === "text") {
                        if (textLocked) {
                          setUpgradeModal({
                            plan: textRequiredPlan ?? "pro",
                            featureName: "بلاک متن",
                          });
                        } else {
                          onClose();
                          onAddText?.();
                        }
                      } else if (isMediaCard) {
                        if (mediaLocked) {
                          setUpgradeModal({
                            plan: mediaRequiredPlan ?? "pro",
                            featureName: MEDIA_PRESET_CARDS[card.key].copy.heading,
                          });
                        } else {
                          onClose();
                          onAddMedia?.(MEDIA_PRESET_CARDS[card.key]);
                        }
                      } else {
                        pickCustom();
                      }
                    }}
                    className={cn(
                      "group relative flex h-24 flex-col items-start justify-between rounded-3xl border bg-muted/30 p-3 text-start transition-colors",
                      isLocked
                        ? "cursor-pointer opacity-80 hover:border-border hover:bg-muted/40"
                        : "hover:border-primary hover:bg-primary/5",
                    )}
                  >
                    {isLocked && lockedPlan ? (
                      <span
                        className={cn(
                          "absolute end-2.5 top-2.5 inline-flex size-5 items-center justify-center rounded-full",
                          lockedPlan === "pro"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-purple-100 text-purple-700",
                        )}
                        aria-label={
                          lockedPlan === "pro" ? "پلن حرفه‌ای" : "پلن کسب‌وکار"
                        }
                      >
                        <LockIcon className="size-3" aria-hidden />
                      </span>
                    ) : null}
                    <span className="text-sm font-bold">{card.label}</span>
                    <CardIcon
                      className={cn(
                        "size-5 text-muted-foreground",
                        !isLocked && "group-hover:text-primary",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {/* Preset list */}
            <div className="mt-4">
              <ul className="space-y-1.5">
                  {LINK_PRESETS.map((preset) => {
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
          iconNodes={iconNodes}
          isFetching={isFetching}
          fetchError={fetchError}
          onChangeUrl={setUrl}
          onChangeLabel={setLabel}
          onChangeDescription={setDescription}
          onChangeIcon={(next: LinkIconPickerValue) => {
            setIconKey(next.iconKey);
            setIconUrl(next.iconUrl);
            setImageUrl(next.imageUrl);
            setIconNodes(next.iconNodes ?? null);
          }}
          onRefetch={() => runMetadataFetch(url, { force: true })}
          onCancel={() => {
            resetState();
            onClose();
          }}
          onSubmit={handleSubmit}
        />
      )}

      {upgradeModal ? (
        <UpgradePlanModal
          open={true}
          onClose={() => setUpgradeModal(null)}
          plan={upgradeModal.plan}
          featureName={upgradeModal.featureName}
        />
      ) : null}
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
  iconNodes,
  isFetching,
  fetchError,
  onChangeUrl,
  onChangeLabel,
  onChangeDescription,
  onChangeIcon,
  onRefetch,
  onCancel,
  onSubmit,
}: {
  preset: LinkPreset | null;
  url: string;
  label: string;
  description: string;
  imageUrl: string | null;
  iconKey: IconKey | null;
  iconUrl: string | null;
  iconNodes?: IconNode[] | null;
  isFetching: boolean;
  fetchError: string | null;
  onChangeUrl: (v: string) => void;
  onChangeLabel: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onChangeIcon: (next: LinkIconPickerValue) => void;
  onRefetch: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const isUsernameOnly = Boolean(preset?.usernameOnly);
  const urlPrefix = preset?.prefix ?? "";
  // For username-only presets, the effective URL is built from prefix + typed username.
  const effectiveUrl = isUsernameOnly
    ? urlPrefix + url.trim().replace(/^@/, "")
    : url;
  const normalizedUrl = normalizeLinkUrl(effectiveUrl);
  const urlValid = isSafeLinkUrl(normalizedUrl);
  const canSubmit =
    (isUsernameOnly ? Boolean(url.trim()) : urlValid) && Boolean(label.trim());

  // Fields appear once URL is valid (or username is typed for username-only).
  const showFields = isUsernameOnly ? Boolean(url.trim()) : urlValid;
  const showSkeleton = showFields && isFetching && !isUsernameOnly;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="space-y-2">
          <Label htmlFor="new-link-url">
            {isUsernameOnly ? "نام کاربری" : "نشانی"}
          </Label>
          <div
            dir="ltr"
            className="flex h-14 items-center gap-2 rounded-2xl border border-border bg-transparent px-4 transition-colors duration-200 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
          >
            {isUsernameOnly ? (
              <span className="shrink-0 text-base font-medium text-muted-foreground">
                @
              </span>
            ) : (
              <GlobeIcon
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            )}
            <input
              id="new-link-url"
              value={url}
              onChange={(event) =>
                onChangeUrl(event.target.value.replace(/^@/, ""))
              }
              type={isUsernameOnly ? "text" : "url"}
              inputMode={isUsernameOnly ? "text" : "url"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              placeholder={isUsernameOnly ? "username" : "example.com"}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {isFetching ? (
              <Loader2Icon
                className="size-4 shrink-0 animate-spin text-muted-foreground"
                aria-hidden
              />
            ) : urlValid && !isUsernameOnly ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefetch}
                className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs font-semibold"
              >
                <SparklesIcon className="size-3.5" />
                دریافت خودکار
              </Button>
            ) : null}
          </div>
          {fetchError && !isFetching ? (
            <p className="text-xs text-muted-foreground">{fetchError}</p>
          ) : null}
        </div>

        {showFields ? (
          <>
            {/* Preview card (above the title, opens icon picker) */}
            {showSkeleton ? (
              <div className="rounded-4xl bg-muted/30 p-3 border border-border">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-14 shrink-0 rounded-2xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-4xl bg-muted/30 p-3 border border-border">
                <div className="flex items-center gap-3">
                  <LinkIconPickerButton
                    url={normalizedUrl}
                    iconKey={iconKey}
                    iconUrl={iconUrl}
                    imageUrl={imageUrl}
                    iconNodes={iconNodes}
                    size={56}
                    onChange={onChangeIcon}
                    onRefetch={onRefetch}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {label || "عنوان لینک"}
                    </p>
                    {description ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        برای تغییر آیکون روی تصویر بزنید
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-link-label">عنوان</Label>
              {showSkeleton ? (
                <Skeleton className="h-11 w-full rounded-md" />
              ) : (
                <Input
                  id="new-link-label"
                  value={label}
                  onChange={(event) => onChangeLabel(event.target.value)}
                  enterKeyHint="next"
                  placeholder="مثلاً کانال تلگرام من"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-link-description">
                توضیح کوتاه (اختیاری)
              </Label>
              {showSkeleton ? (
                <Skeleton className="h-20 w-full rounded-md" />
              ) : (
                <>
                  <Textarea
                    id="new-link-description"
                    value={description}
                    onChange={(event) =>
                      onChangeDescription(event.target.value)
                    }
                    placeholder="در یک جمله بگویید مخاطب در این لینک چه می‌بیند."
                    className="min-h-20"
                    maxLength={160}
                  />
                  <p className="text-xs text-muted-foreground">
                    {description.length}/۱۶۰
                  </p>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t p-4 sm:p-5">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={onCancel}
        >
          انصراف
        </Button>
        <Button
          type="button"
          className="h-11 px-6"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          افزودن لینک
        </Button>
      </div>
    </div>
  );
}
