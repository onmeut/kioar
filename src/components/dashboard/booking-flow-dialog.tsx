"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  EyeOffIcon,
  GlobeIcon,
  Link2Icon,
  MapPinIcon,
  PencilIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
  VideoIcon,
  WalletIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useFeatureIntroSeen } from "@/hooks/use-feature-intro";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";
import {
  buildTimezoneOptions,
  detectTimezone,
  formatOffset,
} from "@/lib/timezones";

import {
  BUFFER_OPTIONS_MIN,
  CURRENCY_OPTIONS,
  DEFAULT_BOOKING_BLOCK,
  DURATION_OPTIONS_MIN,
  FA_DAY_ORDER,
  WEEKDAY_LABELS_FA,
  type EditableBookingBlock,
  type ProviderConnection,
} from "./booking.types";

type Stage =
  | { kind: "intro"; slide: 0 | 1 | 2 }
  | { kind: "wizard"; step: 1 | 2 | 3 }
  | { kind: "type-editor"; index: number | "new" };

export type BookingFlowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: EditableBookingBlock | null;
  onSubmit: (block: EditableBookingBlock) => Promise<void> | void;
  submitting?: boolean;
  title?: string;
  /** OAuth status for Google / Zoom — used to render real connect buttons. */
  providerConnections?: ProviderConnection[];
};

export function BookingFlowDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  submitting,
  title = "هماهنگ",
  providerConnections = [],
}: BookingFlowDialogProps) {
  const isMobile = useIsMobile();
  const { seen: introSeen, markSeen } = useFeatureIntroSeen("bookings.intro");

  // Until we know whether the user has seen the intro, default to the wizard
  // (returning users) and switch to the carousel on first paint if needed.
  const initialStage = (): Stage => {
    if (initial) return { kind: "wizard", step: 1 };
    return introSeen === false
      ? { kind: "intro", slide: 0 }
      : { kind: "wizard", step: 1 };
  };

  const [stage, setStage] = useState<Stage>(initialStage);
  const [draft, setDraft] = useState<EditableBookingBlock>(() =>
    initial ? cloneDraft(initial) : cloneDraft(DEFAULT_BOOKING_BLOCK),
  );
  // Reset stage + draft only when the dialog opens or switches create↔edit.
  // intentionally excludes introSeen — it loading from localStorage must not
  // wipe a draft the user is actively editing.
  useEffect(() => {
    if (open) {
      setStage(initialStage());
      setDraft(
        initial ? cloneDraft(initial) : cloneDraft(DEFAULT_BOOKING_BLOCK),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  // Once introSeen loads from localStorage (null → false) while the dialog is
  // already open, switch to the intro carousel without clearing the draft.
  useEffect(() => {
    if (open && !initial && introSeen === false) {
      setStage({ kind: "intro", slide: 0 });
    }
  }, [open, initial, introSeen]);

  const patch = useCallback((p: Partial<EditableBookingBlock>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const Container = isMobile ? Sheet : Dialog;
  const ContentC = isMobile ? SheetContent : DialogContent;
  const contentProps = isMobile
    ? {
        side: "bottom" as const,
        className:
          "h-[92dvh] rounded-t-3xl p-0 flex flex-col bg-background gap-0",
      }
    : {
        className:
          "p-0 sm:max-w-[480px] max-h-[92vh] flex flex-col overflow-hidden gap-0",
      };

  const showProgress = stage.kind === "wizard";

  return (
    <Container open={open} onOpenChange={onOpenChange}>
      <ContentC {...contentProps}>
        <div className="border-b">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5">
            <BackButton stage={stage} setStage={setStage} />
            <DialogTitle className="text-base font-semibold">
              {title}
            </DialogTitle>
            <IconButton ariaLabel="بستن" onClick={() => onOpenChange(false)}>
              <XIcon className="size-5" />
            </IconButton>
          </div>

          {showProgress ? (
            <div className="h-1 w-full bg-foreground/10">
              <div
                className="h-full bg-foreground transition-[width] duration-300"
                style={{ width: `${(stage.step / 3) * 100}%` }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {stage.kind === "intro" ? (
            <IntroCarousel slide={stage.slide} />
          ) : stage.kind === "wizard" && stage.step === 1 ? (
            <LocationStep
              draft={draft}
              patch={patch}
              providerConnections={providerConnections}
            />
          ) : stage.kind === "wizard" && stage.step === 2 ? (
            <AvailabilityStep draft={draft} patch={patch} />
          ) : stage.kind === "wizard" && stage.step === 3 ? (
            <DetailsStep
              draft={draft}
              patch={patch}
              onOpenTypeEditor={(index) =>
                setStage({ kind: "type-editor", index })
              }
              onRemoveType={(index) => {
                setDraft((d) => ({
                  ...d,
                  types: d.types.filter((_, i) => i !== index),
                }));
              }}
            />
          ) : stage.kind === "type-editor" ? (
            <BookingTypeEditor
              initial={
                stage.index === "new"
                  ? null
                  : (draft.types[stage.index as number] ?? null)
              }
              onSave={(value) => {
                setDraft((d) => {
                  const next = [...d.types];
                  if (stage.index === "new") next.push(value);
                  else next[stage.index as number] = value;
                  return { ...d, types: next };
                });
                setStage({ kind: "wizard", step: 3 });
              }}
            />
          ) : null}
        </div>

        <div className="border-t bg-background p-4 safe-pb">
          <FooterActions
            stage={stage}
            setStage={setStage}
            onIntroDone={markSeen}
            draft={draft}
            submitting={submitting}
            onFinalize={async () => {
              await onSubmit(draft);
            }}
          />
        </div>
      </ContentC>
    </Container>
  );
}

function cloneDraft(d: EditableBookingBlock): EditableBookingBlock {
  return {
    ...d,
    availability: d.availability.map((a) => ({ ...a })),
    types: d.types.map((t) => ({ ...t })),
  };
}

// ────────────────────────────────────────────────────────────────────────
// Header icon buttons — fixed 44×44, no hover-grow.
// ────────────────────────────────────────────────────────────────────────

function IconButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:bg-foreground/10"
    >
      {children}
    </button>
  );
}

function BackButton({
  stage,
  setStage,
}: {
  stage: Stage;
  setStage: (s: Stage) => void;
}) {
  if (stage.kind === "intro" && stage.slide === 0) {
    return <span className="size-11 shrink-0" aria-hidden />;
  }
  if (stage.kind === "intro") {
    return (
      <IconButton
        ariaLabel="قبلی"
        onClick={() =>
          setStage({ kind: "intro", slide: (stage.slide - 1) as 0 | 1 })
        }
      >
        <ArrowRightIcon className="size-5" />
      </IconButton>
    );
  }
  if (stage.kind === "wizard" && stage.step === 1) {
    return <span className="size-11 shrink-0" aria-hidden />;
  }
  if (stage.kind === "wizard") {
    return (
      <IconButton
        ariaLabel="مرحله قبل"
        onClick={() =>
          setStage({
            kind: "wizard",
            step: (stage.step - 1) as 1 | 2,
          })
        }
      >
        <ArrowRightIcon className="size-5" />
      </IconButton>
    );
  }
  if (stage.kind === "type-editor") {
    return (
      <IconButton
        ariaLabel="بازگشت"
        onClick={() => setStage({ kind: "wizard", step: 3 })}
      >
        <ArrowRightIcon className="size-5" />
      </IconButton>
    );
  }
  return <span className="size-11 shrink-0" aria-hidden />;
}

// ────────────────────────────────────────────────────────────────────────
// Intro slides
// ────────────────────────────────────────────────────────────────────────

function IntroCarousel({ slide }: { slide: 0 | 1 | 2 }) {
  const slides = [
    {
      title: "هماهنگی‌ها بدون دردسر",
      body: "بدون ابزار جانبی، یک صفحه‌ی شخصی برای رزرو هماهنگ بسازید. مهمان‌ها زمان‌های خالی شما را می‌بینند و انتخاب می‌کنند.",
      emoji: "📅",
    },
    {
      title: "وقت = پول",
      body: "برای هر نوع هماهنگ مدت و قیمت تعیین کنید. مشاوره‌ی رایگان، جلسه‌ی پولی، تماس فالوآپ — همه در یک صفحه.",
      emoji: "💸",
    },
    {
      title: "روی برنامه‌ی خودتان",
      body: "ساعت‌های در دسترس را برای هر روز هفته تعریف کنید؛ ما خودکار اسلات‌های خالی را به مهمان‌ها نشان می‌دهیم.",
      emoji: "✨",
    },
  ] as const;
  const s = slides[slide];
  return (
    <div className="flex h-full flex-col">
      <div className="m-4 flex aspect-5/4 items-center justify-center rounded-3xl bg-amber-400/60 text-7xl">
        {s.emoji}
      </div>
      <div className="px-6 pb-6">
        <h2 className="text-2xl font-bold">{s.title}</h2>
        <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
          {s.body}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-center gap-1.5 pb-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === slide ? "bg-primary" : "bg-foreground/15",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 1 — Location
// ────────────────────────────────────────────────────────────────────────

type MeetingProvider = "google_meet" | "zoom" | "custom";

const PROVIDER_DEFS: Record<
  Exclude<MeetingProvider, "custom">,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
  }
> = {
  google_meet: {
    label: "Google Meet",
    icon: VideoIcon,
    description:
      "با اتصال، خودکار رویداد در Google Calendar ساخته می‌شود و لینک Google Meet به آن چسبانده می‌شود.",
  },
  zoom: {
    label: "Zoom",
    icon: VideoIcon,
    description:
      "با اتصال، برای هر رزرو خودکار یک Zoom Meeting ساخته و لینکش به مهمان ارسال می‌شود.",
  },
};

function detectProviderFromUrl(
  _url: string | null | undefined,
): MeetingProvider {
  // Intentionally unused — we no longer infer provider from a free-form static
  // link. The provider is only set by the user clicking a provider tile.
  return "custom";
}
void detectProviderFromUrl;

function LocationStep({
  draft,
  patch,
  providerConnections,
}: {
  draft: EditableBookingBlock;
  patch: (p: Partial<EditableBookingBlock>) => void;
  providerConnections: ProviderConnection[];
}) {
  const provider: MeetingProvider =
    draft.locationType === "online"
      ? draft.meetingProvider === "google_meet" ||
        draft.meetingProvider === "zoom"
        ? draft.meetingProvider
        : "custom"
      : "custom";

  // Selecting again toggles back to "custom" (no provider). When set to a
  // provider, we clear any stale meetingLink so the connect-card UX is
  // unambiguous.
  const setProvider = (p: MeetingProvider) => {
    if (p === provider) {
      patch({ meetingProvider: "custom" });
    } else {
      patch({ meetingProvider: p });
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <Label htmlFor="bk-name" className="flex items-center gap-1">
          نام صفحه‌ی هماهنگ
          <span aria-hidden className="text-foreground">
            *
          </span>
          <span className="sr-only">(الزامی)</span>
        </Label>
        <Input
          id="bk-name"
          value={draft.name}
          enterKeyHint="next"
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="مثلاً: مشاوره‌ی رشد محصول، یا نشست با احمد"
          aria-required="true"
          aria-invalid={undefined}
          autoFocus={!draft.name}
        />
        <p className="text-[11px] text-muted-foreground">
          این نام در پروفایل عمومی شما به مهمان‌ها نمایش داده می‌شود.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bk-desc">توضیح کوتاه</Label>
        <Textarea
          id="bk-desc"
          rows={3}
          value={draft.description ?? ""}
          onChange={(e) => patch({ description: e.target.value || null })}
          placeholder="چه اتفاقی در این هماهنگ می‌افتد؟ مثلاً: «۳۰ دقیقه گفتگو درباره‌ی استراتژی برند»"
        />
      </div>

      <div className="space-y-2">
        <Label>نوع هماهنگ</Label>
        <div className="grid gap-2">
          <LocationTypeCard
            active={draft.locationType === "online"}
            onClick={() => patch({ locationType: "online" })}
            icon={<VideoIcon className="size-5" />}
            title="آنلاین"
            desc="هماهنگ مجازی — لینک به مهمان فرستاده می‌شود."
          />
          <LocationTypeCard
            active={draft.locationType === "in_person"}
            onClick={() => patch({ locationType: "in_person" })}
            icon={<MapPinIcon className="size-5" />}
            title="حضوری"
            desc="یک آدرس مشخص یا روی نقشه."
          />
        </div>
      </div>

      {draft.locationType === "online" ? (
        <OnlineProviderPicker
          provider={provider}
          setProvider={setProvider}
          link={draft.meetingLink}
          onLinkChange={(link) => patch({ meetingLink: link })}
          providerConnections={providerConnections}
        />
      ) : (
        <InPersonLocation
          address={draft.locationAddress}
          placeId={draft.locationPlaceId}
          onSelect={(s) =>
            patch({
              locationAddress: s.address,
              locationLat: s.lat,
              locationLng: s.lng,
              locationPlaceId: s.placeId,
            })
          }
        />
      )}
    </div>
  );
}

function LocationTypeCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-start transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:bg-foreground/5",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          active ? "bg-primary text-primary-foreground" : "bg-foreground/5",
        )}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {desc}
        </span>
      </span>
      {active ? <CheckIcon className="size-5 text-primary" /> : null}
    </button>
  );
}

function OnlineProviderPicker({
  provider,
  setProvider,
  link,
  onLinkChange,
  providerConnections,
}: {
  provider: MeetingProvider;
  setProvider: (p: MeetingProvider) => void;
  link: string | null;
  onLinkChange: (v: string | null) => void;
  providerConnections: ProviderConnection[];
}) {
  const googleConn = providerConnections.find((c) => c.provider === "google");
  const zoomConn = providerConnections.find((c) => c.provider === "zoom");
  const providers = ["google_meet", "zoom"] as const;

  return (
    <div className="space-y-3">
      <Label>سرویس هماهنگ (اختیاری)</Label>
      <p className="text-[11px] text-muted-foreground">
        یکی از سرویس‌ها را انتخاب کنید تا برای هر رزرو خودکار لینک ساخته شود، یا
        هیچ‌کدام را انتخاب نکنید و در پایین یک لینک ثابت بگذارید (یا خالی
        بماند).
      </p>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((p) => {
          const d = PROVIDER_DEFS[p];
          const Icon = d.icon;
          const active = p === provider;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              aria-pressed={active}
              className={cn(
                "relative flex items-center gap-2 rounded-2xl border p-3 text-start transition-colors",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-foreground/5",
              )}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {d.label}
              </span>
              {active ? <CheckIcon className="size-4 text-primary" /> : null}
            </button>
          );
        })}
      </div>

      {provider === "google_meet" ? (
        <ProviderConnectCard
          provider="google"
          label="Google"
          status={googleConn}
          description={PROVIDER_DEFS.google_meet.description}
        />
      ) : null}

      {provider === "zoom" ? (
        <ProviderConnectCard
          provider="zoom"
          label="Zoom"
          status={zoomConn}
          description={PROVIDER_DEFS.zoom.description}
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="bk-meeting-link">
          {provider === "custom" ? "لینک ثابت (اختیاری)" : "لینک ثابت"}
        </Label>
        <Input
          id="bk-meeting-link"
          type="url"
          inputMode="url"
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={
            provider === "google_meet"
              ? "https://meet.google.com/abc-defg-hij"
              : provider === "zoom"
                ? "https://us02web.zoom.us/j/1234567890"
                : "https://example.com/meeting"
          }
          value={link ?? ""}
          onChange={(e) => onLinkChange(e.target.value.trim() || null)}
        />
        <p className="text-xs text-muted-foreground">
          {provider === "custom"
            ? "هر لینک دیگری (Teams، Webex، Google Meet، …) — اینجا بگذارید. خالی هم می‌تواند بماند؛ لینک نهایی را بعد از تأیید رزرو برای مهمان می‌فرستید."
            : "اگر هنوز اتصال انجام نشده، این لینک ثابت پشتیبان به مهمان فرستاده می‌شود."}
        </p>
      </div>
    </div>
  );
}

function ProviderConnectCard({
  provider,
  label,
  status,
  description,
}: {
  provider: "google" | "zoom";
  label: string;
  status: ProviderConnection | undefined;
  description: string;
}) {
  const connected = status?.connected ?? false;
  const available = status?.available ?? false;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const returnTo =
    typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/me";
  const startHref = `/api/oauth/${provider}/start?returnTo=${encodeURIComponent(returnTo)}`;

  async function disconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/oauth/${provider}/disconnect`, { method: "POST" });
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!available) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">
          اتصال {label} هنوز پیکربندی نشده است
        </p>
        <p className="mt-1 leading-6">
          مدیر سیستم باید کلیدهای OAuth را در فایل <code>.env</code> تنظیم کند.
          فعلاً می‌توانید لینک را به‌صورت دستی وارد کنید.
        </p>
      </div>
    );
  }

  if (connected) {
    return (
      <>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            حساب متصل
          </p>
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
              {provider === "google" ? <GoogleCalendarMark /> : <ZoomMark />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {provider === "google" ? "Google Calendar" : "Zoom"}
              </p>
              <p
                className="mt-0.5 truncate text-xs text-muted-foreground"
                dir="ltr"
              >
                {status?.email ?? "—"}
              </p>
            </div>
            <button
              type="button"
              aria-label={`قطع اتصال ${label}`}
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5"
            >
              <Trash2Icon className="size-4" />
            </button>
          </div>
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>قطع اتصال {label}</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                پیامدهای قطع اتصال را مرور کنید و در صورت تمایل تأیید کنید.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="space-y-3 py-2 text-sm">
              <li className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    هماهنگی‌های فعلی در تقویم شما باقی می‌مانند
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    اگر نمی‌توانید در هماهنگی شرکت کنید، خودتان به مهمان اطلاع
                    دهید.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <PlugIcon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    هر زمان خواستید دوباره وصل کنید
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    می‌توانید در آینده دوباره به این حساب متصل شوید.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  <EyeOffIcon className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">لینک رزرو فعلاً پنهان می‌شود</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    تا وقتی دوباره متصل نشوید، مهمان‌ها این هماهنگ را در پروفایل
                    شما نمی‌بینند.
                  </p>
                </div>
              </li>
            </ul>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void disconnect();
                }}
                disabled={disconnecting}
                className="h-12 w-full rounded-full bg-destructive text-base text-destructive-foreground hover:bg-destructive/90"
              >
                {disconnecting ? "در حال قطع اتصال…" : "بله، قطع شود"}
              </AlertDialogAction>
              <AlertDialogCancel className="h-12 w-full rounded-full text-base">
                انصراف
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <div className="rounded-2xl border bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-background">
          {provider === "google" ? (
            <CalendarIcon className="size-4 text-muted-foreground" />
          ) : (
            <VideoIcon className="size-4 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">اتصال به {label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <a
          href={startHref}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          اتصال
        </a>
      </div>
    </div>
  );
}

function GoogleCalendarMark() {
  return (
    <span
      aria-hidden
      className="grid size-7 place-items-center rounded-md bg-white text-[10px] font-extrabold text-[#1a73e8] shadow-sm ring-1 ring-black/5"
    >
      31
    </span>
  );
}

function ZoomMark() {
  return (
    <span
      aria-hidden
      className="grid size-7 place-items-center rounded-md bg-[#2D8CFF] text-white"
    >
      <VideoIcon className="size-4" />
    </span>
  );
}

function InPersonLocation({
  address,
  placeId,
  onSelect,
}: {
  address: string | null;
  placeId: string | null;
  onSelect: (s: {
    address: string | null;
    lat: string | null;
    lng: string | null;
    placeId: string | null;
  }) => void;
}) {
  const [query, setQuery] = useState(address ?? "");
  const [predictions, setPredictions] = useState<
    Array<{ placeId: string; label: string; sublabel: string }>
  >([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sessionToken] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  );

  // Debounce queries to the server-side proxy.
  useEffect(() => {
    if (!query.trim() || query === address) {
      setPredictions([]);
      setSearchError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setSearchError(null);
      try {
        const res = await fetch(
          `/api/places/autocomplete?q=${encodeURIComponent(query)}&session=${sessionToken}`,
          { signal: ctrl.signal },
        );
        if (res.status === 501) {
          setNotConfigured(true);
          setPredictions([]);
          setOpen(true); // still open so user sees "use as text"
          return;
        }
        if (!res.ok) {
          const errJson = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          setSearchError(errJson?.message ?? "جستجوی نقشه در دسترس نیست.");
          setPredictions([]);
          setOpen(true);
          return;
        }
        const json = (await res.json()) as {
          predictions: Array<{
            placeId: string;
            label: string;
            sublabel: string;
          }>;
        };
        setPredictions(json.predictions);
        setOpen(true);
      } catch {
        // aborted or transient — ignore
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, address, sessionToken]);

  async function pick(p: { placeId: string; label: string; sublabel: string }) {
    setOpen(false);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/places/details?placeId=${encodeURIComponent(p.placeId)}`,
      );
      if (!res.ok) throw new Error("details failed");
      const json = (await res.json()) as {
        placeId: string;
        address: string | null;
        lat: number | null;
        lng: number | null;
      };
      const fullAddress = json.address ?? `${p.label} — ${p.sublabel}`;
      setQuery(fullAddress);
      onSelect({
        address: fullAddress,
        lat: json.lat != null ? String(json.lat) : null,
        lng: json.lng != null ? String(json.lng) : null,
        placeId: json.placeId,
      });
    } catch {
      // fall back to label-only
      const fallback = `${p.label}${p.sublabel ? ` — ${p.sublabel}` : ""}`;
      setQuery(fallback);
      onSelect({
        address: fallback,
        lat: null,
        lng: null,
        placeId: p.placeId,
      });
    } finally {
      setLoading(false);
    }
  }

  function useAsPlainText() {
    const text = query.trim();
    if (!text) return;
    setOpen(false);
    onSelect({ address: text, lat: null, lng: null, placeId: null });
  }

  const trimmed = query.trim();
  const showDropdown =
    open && trimmed.length > 0 && (predictions.length > 0 || !placeId);

  return (
    <div className="space-y-2">
      <Label htmlFor="bk-address">آدرس محل ملاقات</Label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute inset-e-3 top-3 size-4 text-muted-foreground" />
        <Input
          id="bk-address"
          className="pe-9"
          placeholder="نام مکان یا آدرس — مثلاً «کافه دوباره تهران»"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // typing invalidates the previously-picked place
            if (placeId)
              onSelect({
                address: e.target.value,
                lat: null,
                lng: null,
                placeId: null,
              });
          }}
          onFocus={() => trimmed.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              useAsPlainText();
            }
          }}
          // Defeat password-manager / browser autofill on this free-form
          // location field.
          name="search-location"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-form-type="other"
          data-1p-ignore
          data-lpignore="true"
        />
        {showDropdown ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border bg-popover p-1 shadow-md">
            {predictions.map((p) => (
              <li key={p.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                  className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-start hover:bg-foreground/5"
                >
                  <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {p.label}
                    </span>
                    {p.sublabel ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.sublabel}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
            {predictions.length > 0 ? (
              <li className="my-1 h-px bg-border" aria-hidden />
            ) : null}
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={useAsPlainText}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-start hover:bg-foreground/5"
              >
                <PencilIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-primary">
                    استفاده‌ی همین متن به‌عنوان آدرس
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    «{trimmed}»
                  </span>
                </span>
              </button>
            </li>
          </ul>
        ) : null}
      </div>
      {placeId ? (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
          <CheckIcon className="size-3.5" />
          مکان روی نقشه ثبت شد.
        </p>
      ) : notConfigured ? (
        <p className="text-[11px] text-muted-foreground">
          جستجوی نقشه فعال نیست — هرچه می‌نویسید همان به‌عنوان آدرس ذخیره می‌شود
          (Enter یا گزینه‌ی پایین لیست).
        </p>
      ) : searchError ? (
        <p
          className="text-[11px] text-amber-700 dark:text-amber-400"
          dir="ltr"
          title={searchError}
        >
          {searchError.length > 120
            ? `${searchError.slice(0, 120)}…`
            : searchError}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {loading
            ? "در حال جستجو…"
            : "از پیشنهادها یکی را انتخاب کنید، یا Enter بزنید تا همان متن به‌عنوان آدرس ذخیره شود."}
        </p>
      )}
    </div>
  );
}

function CalendarConnectField(_props: {
  value: string | null;
  onChange: (v: string | null) => void;
  providerConnections: ProviderConnection[];
}) {
  // Deprecated — kept as a no-op stub to avoid stale imports while the dialog
  // moves the Google Calendar connection inline with the Meet provider card.
  return null;
}
void CalendarConnectField;

// ────────────────────────────────────────────────────────────────────────
// Step 2 — Availability
// ────────────────────────────────────────────────────────────────────────

function AvailabilityStep({
  draft,
  patch,
}: {
  draft: EditableBookingBlock;
  patch: (p: Partial<EditableBookingBlock>) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<number, Array<{ start: number; end: number }>>();
    for (const dow of FA_DAY_ORDER) map.set(dow, []);
    for (const a of draft.availability) {
      const arr = map.get(a.dayOfWeek) ?? [];
      arr.push({ start: a.startMinute, end: a.endMinute });
      map.set(a.dayOfWeek, arr);
    }
    return map;
  }, [draft.availability]);

  const writeAvailability = (
    next: Map<number, Array<{ start: number; end: number }>>,
  ) => {
    const flat: typeof draft.availability = [];
    for (const dow of FA_DAY_ORDER) {
      for (const w of next.get(dow) ?? []) {
        flat.push({
          dayOfWeek: dow,
          startMinute: w.start,
          endMinute: w.end,
        });
      }
    }
    patch({ availability: flat });
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-xl font-bold">دسترس‌پذیری</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ساعت‌های هفتگی که برای هماهنگ آماده‌اید را مشخص کنید.
        </p>
      </div>

      <TimezoneField
        value={draft.timezone}
        onChange={(v) => patch({ timezone: v })}
      />

      <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">
        ساعت‌های دسترس‌پذیری شما در منطقهٔ زمانی بالا ذخیره می‌شود. مهمان‌ها
        ساعت‌های شما را به‌صورت خودکار به منطقهٔ زمانی خودشان تبدیل‌شده
        می‌بینند.
      </div>

      <div className="space-y-2">
        <Label>ساعت‌های هفتگی</Label>
        <p className="text-xs text-muted-foreground">
          برای هر روز می‌توانید چند بازه‌ی زمانی اضافه کنید (مثلاً صبح +
          بعدازظهر).
        </p>
        <div className="space-y-2">
          {FA_DAY_ORDER.map((dow, i) => (
            <DayRow
              key={dow}
              label={WEEKDAY_LABELS_FA[i]}
              ranges={grouped.get(dow) ?? []}
              onChange={(next) => {
                const map = new Map(grouped);
                map.set(dow, next);
                writeAvailability(map);
              }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>فاصله بین هماهنگی‌ها</Label>
        <div className="grid grid-cols-2 gap-3">
          <BufferField
            label="قبل از هر هماهنگ"
            value={draft.bufferBeforeMin}
            onChange={(v) => patch({ bufferBeforeMin: v })}
          />
          <BufferField
            label="بعد از هر هماهنگ"
            value={draft.bufferAfterMin}
            onChange={(v) => patch({ bufferAfterMin: v })}
          />
        </div>
      </div>
    </div>
  );
}

function DayRow({
  label,
  ranges,
  onChange,
}: {
  label: string;
  ranges: Array<{ start: number; end: number }>;
  onChange: (next: Array<{ start: number; end: number }>) => void;
}) {
  const enabled = ranges.length > 0;

  const toggle = () => {
    if (enabled) onChange([]);
    else onChange([{ start: 9 * 60, end: 17 * 60 }]);
  };

  const updateAt = (i: number, next: { start: number; end: number }) => {
    const arr = [...ranges];
    arr[i] = next;
    onChange(arr);
  };
  const removeAt = (i: number) =>
    onChange(ranges.filter((_, idx) => idx !== i));
  const addAfter = (i: number) => {
    const arr = [...ranges];
    const base = arr[i] ?? { start: 9 * 60, end: 17 * 60 };
    arr.splice(i + 1, 0, {
      start: Math.min(base.end, 22 * 60),
      end: Math.min(base.end + 60, 24 * 60),
    });
    onChange(arr);
  };

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3 transition-colors",
        !enabled && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors",
            enabled
              ? "bg-foreground text-background"
              : "border border-border bg-background text-muted-foreground",
          )}
        >
          {label.slice(0, 1)}
        </button>
        <span className="flex-1 text-sm font-semibold">{label}</span>
        {!enabled ? (
          <button
            type="button"
            onClick={toggle}
            className="text-xs font-semibold text-primary"
          >
            افزودن ساعت
          </button>
        ) : null}
      </div>

      {enabled ? (
        <div className="mt-3 space-y-2">
          {ranges.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2"
            >
              <TimeSelect
                value={r.start}
                onChange={(v) => updateAt(i, { ...r, start: v })}
              />
              <span className="text-muted-foreground">—</span>
              <TimeSelect
                value={r.end}
                onChange={(v) => updateAt(i, { ...r, end: v })}
              />
              <IconMicroButton ariaLabel="حذف بازه" onClick={() => removeAt(i)}>
                <XIcon className="size-4" />
              </IconMicroButton>
              <IconMicroButton
                ariaLabel="افزودن بازه"
                onClick={() => addAfter(i)}
              >
                <PlusIcon className="size-4" />
              </IconMicroButton>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IconMicroButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function TimezoneField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const detected = detectTimezone();

  const options = useMemo(() => buildTimezoneOptions(detected), [detected]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.value.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q) ||
        o.region.includes(q),
    );
  }, [options, query]);

  const offset = formatOffset(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId}>منطقه‌ی زمانی</Label>
        {value !== detected ? (
          <button
            type="button"
            onClick={() => onChange(detected)}
            className="text-xs font-semibold text-primary"
          >
            استفاده از منطقه‌ی فعلی
          </button>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring md:h-9"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <GlobeIcon className="size-4 shrink-0 text-muted-foreground" />
            <span dir="ltr" className="truncate">
              {value}
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span dir="ltr" className="text-xs text-muted-foreground">
              {offset}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
        </button>

        {open ? (
          <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-hidden rounded-2xl border bg-popover shadow-xl">
            <div className="border-b p-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute inset-e-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id={inputId}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-9 pe-8"
                  placeholder="جستجو: تهران، Tokyo، UTC…"
                />
              </div>
            </div>
            <ul className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                  چیزی پیدا نشد.
                </li>
              ) : (
                filtered.slice(0, 100).map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-sm hover:bg-accent",
                        value === o.value && "bg-primary/10",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      <span
                        dir="ltr"
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {formatOffset(o.value)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const options = useMemo(() => {
    const out: number[] = [];
    for (let m = 0; m <= 24 * 60; m += 15) out.push(m);
    return out;
  }, []);
  return (
    <div className="relative">
      <select
        dir="ltr"
        className="h-11 w-full appearance-none rounded-xl border bg-card px-3 text-center text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-ring md:h-9"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {formatMinute(m)}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute inset-e-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function BufferField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="relative">
        <select
          dir="rtl"
          className="h-11 w-full appearance-none rounded-xl border bg-card px-3 pe-8 text-start text-sm focus-visible:outline-2 focus-visible:outline-ring md:h-9"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {BUFFER_OPTIONS_MIN.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? "بدون فاصله" : `${toPersianDigits(m)} دقیقه`}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute inset-e-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function formatMinute(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────────────
// Step 3 — Details + Types
// ────────────────────────────────────────────────────────────────────────

function DetailsStep({
  draft,
  patch,
  onOpenTypeEditor,
  onRemoveType,
}: {
  draft: EditableBookingBlock;
  patch: (p: Partial<EditableBookingBlock>) => void;
  onOpenTypeEditor: (index: number | "new") => void;
  onRemoveType: (index: number) => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="text-xl font-bold">گزینه‌های میت</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          مهمان‌ها از بین این گزینه‌ها (با مدت / قیمت متفاوت) یکی را انتخاب
          می‌کنند.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="sr-only">گزینه‌های میت</Label>
          <span className="text-xs text-muted-foreground">
            {toPersianDigits(draft.types.length)} گزینه
          </span>
        </div>

        {draft.types.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-foreground/2 p-4 text-center text-sm text-muted-foreground">
            برای ادامه حداقل یک گزینه‌ی هماهنگ اضافه کنید.
          </div>
        ) : (
          <ul className="space-y-2">
            {draft.types.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{t.title}</p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="size-3.5" />
                      {toPersianDigits(t.durationMin)} دقیقه
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <WalletIcon className="size-3.5" />
                      {t.priceAmount === 0
                        ? "رایگان"
                        : `${toPersianDigits(t.priceAmount.toLocaleString("en-US"))} ${currencyLabel(t.priceCurrency)}`}
                    </span>
                  </p>
                </div>
                <IconMicroButton
                  ariaLabel="ویرایش"
                  onClick={() => onOpenTypeEditor(i)}
                >
                  <PencilIcon className="size-4" />
                </IconMicroButton>
                <IconMicroButton
                  ariaLabel="حذف"
                  onClick={() => onRemoveType(i)}
                >
                  <Trash2Icon className="size-4" />
                </IconMicroButton>
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          className="w-full"
          onClick={() => onOpenTypeEditor("new")}
        >
          <PlusIcon className="size-4" />
          افزودن گزینه‌ی میت
        </Button>
      </div>
    </div>
  );
}

function currencyLabel(code: string) {
  return CURRENCY_OPTIONS.find((c) => c.code === code)?.label ?? code;
}

// ────────────────────────────────────────────────────────────────────────
// Type editor (sub-stage)
// ────────────────────────────────────────────────────────────────────────

function BookingTypeEditor({
  initial,
  onSave,
}: {
  initial: EditableBookingBlock["types"][number] | null;
  onSave: (v: EditableBookingBlock["types"][number]) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [duration, setDuration] = useState(initial?.durationMin ?? 30);
  const [priceAmount, setPriceAmount] = useState(initial?.priceAmount ?? 0);
  const [priceCurrency, setPriceCurrency] = useState(
    initial?.priceCurrency ?? "IRT",
  );

  const canSave = title.trim().length > 0 && duration >= 5;

  return (
    <form
      id="booking-type-form"
      className="space-y-5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSave({
          id: initial?.id ?? null,
          title: title.trim(),
          durationMin: duration,
          priceAmount: Math.max(0, Math.round(priceAmount)),
          priceCurrency,
        });
      }}
    >
      <div>
        <h2 className="text-xl font-bold">
          {initial ? "ویرایش گزینه‌ی هماهنگ" : "افزودن گزینه‌ی هماهنگ"}
        </h2>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bt-title">عنوان</Label>
        <Input
          id="bt-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً: مشاوره‌ی رایگان، تماس فالوآپ، جلسه‌ی استراتژی"
          enterKeyHint="next"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>مدت‌زمان</Label>
        <div className="relative">
          <select
            dir="rtl"
            className="h-11 w-full appearance-none rounded-xl border bg-card px-3 pe-8 text-start text-sm focus-visible:outline-2 focus-visible:outline-ring md:h-9"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATION_OPTIONS_MIN.map((m) => (
              <option key={m} value={m}>
                {toPersianDigits(m)} دقیقه
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute inset-e-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>قیمت</Label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            value={priceAmount}
            onChange={(e) => setPriceAmount(Number(e.target.value) || 0)}
            dir="ltr"
            placeholder="0 برای رایگان"
          />
          <div className="relative">
            <select
              dir="rtl"
              className="h-11 appearance-none rounded-xl border bg-card px-3 pe-8 text-start text-sm focus-visible:outline-2 focus-visible:outline-ring md:h-9"
              value={priceCurrency}
              onChange={(e) => setPriceCurrency(e.target.value)}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute inset-e-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          برای هماهنگ رایگان، مبلغ را روی صفر بگذارید.
        </p>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Footer
// ────────────────────────────────────────────────────────────────────────

function FooterActions({
  stage,
  setStage,
  onIntroDone,
  draft,
  submitting,
  onFinalize,
}: {
  stage: Stage;
  setStage: (s: Stage) => void;
  onIntroDone: () => void;
  draft: EditableBookingBlock;
  submitting?: boolean;
  onFinalize: () => Promise<void> | void;
}) {
  if (stage.kind === "intro") {
    const isLast = stage.slide === 2;
    return (
      <Button
        className="h-12 w-full rounded-full text-base"
        onClick={() => {
          if (isLast) {
            onIntroDone();
            setStage({ kind: "wizard", step: 1 });
          } else {
            setStage({
              kind: "intro",
              slide: (stage.slide + 1) as 1 | 2,
            });
          }
        }}
      >
        {isLast ? "بزن بریم" : "ادامه"}
      </Button>
    );
  }

  if (stage.kind === "type-editor") {
    return (
      <Button
        type="submit"
        form="booking-type-form"
        className="h-12 w-full rounded-full text-base"
      >
        ذخیره
      </Button>
    );
  }

  const step = stage.step;
  const isLast = step === 3;
  const canContinue = getStepIssues(step, draft).length === 0;

  return (
    <Button
      className="h-12 w-full rounded-full text-base"
      disabled={!canContinue || submitting}
      onClick={async () => {
        if (isLast) await onFinalize();
        else setStage({ kind: "wizard", step: (step + 1) as 2 | 3 });
      }}
    >
      {isLast ? (submitting ? "در حال ذخیره…" : "ذخیره و ساخت") : "ادامه"}
    </Button>
  );
}

type StepIssue = { step: 1 | 2 | 3; field: string; message: string };

function getStepIssues(step: 1 | 2 | 3, d: EditableBookingBlock): StepIssue[] {
  const issues: StepIssue[] = [];
  if (step === 1) {
    if (!d.name.trim()) {
      issues.push({
        step: 1,
        field: "name",
        message: "نام صفحه‌ی هماهنگ را وارد کنید.",
      });
    }
    if (
      d.locationType === "in_person" &&
      !(d.locationAddress && d.locationAddress.trim().length > 0)
    ) {
      issues.push({
        step: 1,
        field: "address",
        message: "آدرس محل ملاقات را وارد کنید.",
      });
    }
    return issues;
  }
  if (step === 2) {
    if (!d.availability.length) {
      issues.push({
        step: 2,
        field: "availability",
        message: "حداقل برای یک روز ساعت کاری اضافه کنید.",
      });
    } else if (!d.availability.every((w) => w.endMinute > w.startMinute)) {
      issues.push({
        step: 2,
        field: "availability",
        message: "ساعت پایان باید بعد از ساعت شروع باشد.",
      });
    }
    return issues;
  }
  // step 3
  if (d.types.length === 0) {
    issues.push({
      step: 3,
      field: "types",
      message: "حداقل یک گزینه‌ی میت اضافه کنید.",
    });
  }
  return issues;
}
