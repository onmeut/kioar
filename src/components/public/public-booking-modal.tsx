"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getPublicBookingSlotsAction,
  submitPublicBookingAction,
} from "@/app/[slug]/bookings/actions";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export type PublicBookingTypeData = {
  id: string;
  title: string;
  description?: string | null;
  durationMin: number;
  priceAmount: number;
  priceCurrency: string;
};

export type PublicBookingBlockData = {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  locationType: "online" | "in_person";
  locationAddress: string | null;
  meetingLink: string | null;
  timezone: string;
  types: PublicBookingTypeData[];
};

type Stage =
  | { kind: "types" }
  | { kind: "calendar"; type: PublicBookingTypeData }
  | { kind: "times"; type: PublicBookingTypeData; dateIso: string }
  | {
      kind: "form";
      type: PublicBookingTypeData;
      dateIso: string;
      slotIso: string;
    }
  | {
      kind: "confirmed";
      type: PublicBookingTypeData;
      dateIso: string;
      slotIso: string;
      guestName: string;
    };

const WEEKDAY_LABELS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

// Visual column index (Sat=0) → JS getDay() value.
const COL_TO_DOW = [6, 0, 1, 2, 3, 4, 5] as const;

export function PublicBookingPill({
  block,
}: {
  block: PublicBookingBlockData;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex w-full items-center justify-center rounded-full bg-foreground/[0.04] px-4 py-4 transition-colors hover:bg-primary/8 active:bg-primary/12"
      >
        <span className="absolute inset-s-3 inline-flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {block.avatarUrl ? (
            <Image
              src={block.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="size-full rounded-2xl object-cover"
              unoptimized
            />
          ) : (
            <CalendarIcon className="size-5" />
          )}
        </span>
        <span className="block w-full truncate px-10 text-center text-[15px] font-bold">
          {block.name}
        </span>
      </button>
      <PublicBookingModal block={block} open={open} onOpenChange={setOpen} />
    </>
  );
}

function PublicBookingModal({
  block,
  open,
  onOpenChange,
}: {
  block: PublicBookingBlockData;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [stage, setStage] = useState<Stage>({ kind: "types" });

  useEffect(() => {
    if (open) setStage({ kind: "types" });
  }, [open]);

  const back = useCallback(() => {
    setStage((s) => {
      if (s.kind === "calendar") return { kind: "types" };
      if (s.kind === "times") return { kind: "calendar", type: s.type };
      if (s.kind === "form")
        return { kind: "times", type: s.type, dateIso: s.dateIso };
      return s;
    });
  }, []);

  const title = (() => {
    if (stage.kind === "types") return block.name;
    if (stage.kind === "calendar") return "انتخاب تاریخ";
    if (stage.kind === "times") return "انتخاب ساعت";
    if (stage.kind === "form") return "اطلاعات شما";
    return "رزرو ثبت شد";
  })();

  const canBack = stage.kind !== "types" && stage.kind !== "confirmed";

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="relative flex items-center justify-between border-b px-4 py-3">
        {canBack ? (
          <button
            type="button"
            onClick={back}
            aria-label="بازگشت"
            className="tap-target grid size-10 place-items-center rounded-full hover:bg-foreground/5"
          >
            <ArrowRightIcon className="size-5" />
          </button>
        ) : (
          <span className="size-10" />
        )}
        <h2 className="truncate text-base font-bold">{title}</h2>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="بستن"
          className="tap-target grid size-10 place-items-center rounded-full hover:bg-foreground/5"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {stage.kind === "types" ? (
          <TypeList
            block={block}
            onPick={(type) => setStage({ kind: "calendar", type })}
          />
        ) : null}

        {stage.kind === "calendar" ? (
          <CalendarStep
            block={block}
            type={stage.type}
            onPick={(dateIso) =>
              setStage({ kind: "times", type: stage.type, dateIso })
            }
          />
        ) : null}

        {stage.kind === "times" ? (
          <TimesStep
            block={block}
            type={stage.type}
            dateIso={stage.dateIso}
            onPick={(slotIso) =>
              setStage({
                kind: "form",
                type: stage.type,
                dateIso: stage.dateIso,
                slotIso,
              })
            }
          />
        ) : null}

        {stage.kind === "form" ? (
          <FormStep
            block={block}
            type={stage.type}
            dateIso={stage.dateIso}
            slotIso={stage.slotIso}
            onDone={(guestName) =>
              setStage({
                kind: "confirmed",
                type: stage.type,
                dateIso: stage.dateIso,
                slotIso: stage.slotIso,
                guestName,
              })
            }
          />
        ) : null}

        {stage.kind === "confirmed" ? (
          <ConfirmedStep
            block={block}
            type={stage.type}
            slotIso={stage.slotIso}
            guestName={stage.guestName}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[92vh] rounded-t-3xl p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[88vh] w-full max-w-[520px] gap-0 overflow-hidden p-0 sm:max-w-[520px]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Stage: Types ----------
function TypeList({
  block,
  onPick,
}: {
  block: PublicBookingBlockData;
  onPick: (t: PublicBookingTypeData) => void;
}) {
  return (
    <div className="space-y-4">
      {block.description ? (
        <p className="text-[14px] leading-7 text-muted-foreground">
          {block.description}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {block.locationType === "online" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-3 py-1">
            <VideoIcon className="size-3" />
            آنلاین
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-3 py-1">
            <MapPinIcon className="size-3" />
            حضوری
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {block.types.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onPick(t)}
              className="group flex w-full items-center gap-3 rounded-2xl border bg-background/80 p-4 text-start transition-colors hover:border-primary hover:bg-primary/5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ClockIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{t.title}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {toPersianDigits(t.durationMin)} دقیقه
                  {t.priceAmount > 0 ? (
                    <>
                      {" · "}
                      <span dir="ltr">
                        {t.priceAmount} {t.priceCurrency}
                      </span>
                    </>
                  ) : (
                    " · رایگان"
                  )}
                </p>
              </div>
              <ChevronLeftIcon className="size-4 text-muted-foreground group-hover:text-primary" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Stage: Calendar ----------
function CalendarStep({
  block,
  type,
  onPick,
}: {
  block: PublicBookingBlockData;
  type: PublicBookingTypeData;
  onPick: (dateIso: string) => void;
}) {
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);

  const viewDate = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset, today]);

  const monthLabel = viewDate.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Offset to align first day under the correct column (Sat-first).
  // getDay() returns 0..6 (Sun..Sat). Our column order is Sat,Sun,Mon,…,Fri.
  const firstCol = COL_TO_DOW.indexOf(
    first.getDay() as (typeof COL_TO_DOW)[number],
  );

  const todayIso = toIsoDate(today);

  const cells: Array<{ dateIso: string | null; day: number | null }> = [];
  for (let i = 0; i < firstCol; i++) cells.push({ dateIso: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toIsoDate(new Date(year, month, d));
    cells.push({ dateIso: iso, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ dateIso: null, day: null });

  const canGoBack = monthOffset > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => setMonthOffset((m) => Math.max(0, m - 1))}
          className="tap-target grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 disabled:opacity-30"
          aria-label="ماه قبل"
        >
          <ChevronRightIcon className="size-5" />
        </button>
        <div className="text-sm font-bold">{monthLabel}</div>
        <button
          type="button"
          onClick={() => setMonthOffset((m) => m + 1)}
          className="tap-target grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5"
          aria-label="ماه بعد"
        >
          <ChevronLeftIcon className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.dateIso) return <div key={i} className="h-11" />;
          const isPast = cell.dateIso < todayIso;
          return (
            <button
              key={i}
              type="button"
              disabled={isPast}
              onClick={() => onPick(cell.dateIso!)}
              className={cn(
                "grid h-11 place-items-center rounded-xl text-sm font-semibold transition-colors",
                isPast
                  ? "text-muted-foreground/30"
                  : "bg-foreground/[0.04] hover:bg-primary/10 hover:text-primary",
                cell.dateIso === todayIso && !isPast
                  ? "ring-1 ring-primary"
                  : null,
              )}
            >
              {toPersianDigits(cell.day!)}
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        مدت: {toPersianDigits(type.durationMin)} دقیقه · منطقه زمانی{" "}
        {block.timezone}
      </p>
    </div>
  );
}

// ---------- Stage: Times ----------
function TimesStep({
  block,
  type,
  dateIso,
  onPick,
}: {
  block: PublicBookingBlockData;
  type: PublicBookingTypeData;
  dateIso: string;
  onPick: (slotIso: string) => void;
}) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPublicBookingSlotsAction({
      blockId: block.id,
      bookingTypeId: type.id,
      dateIso,
    })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("بارگذاری ساعت‌ها ناموفق بود.");
          setSlots([]);
          return;
        }
        setSlots(res.slots);
      })
      .catch(() => {
        if (!cancelled) {
          setError("بارگذاری ساعت‌ها ناموفق بود.");
          setSlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [block.id, type.id, dateIso]);

  const dateLabel = new Date(dateIso).toLocaleDateString("fa-IR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-sm">
        <p className="font-bold">{dateLabel}</p>
        <p className="text-[12px] text-muted-foreground">
          ساعت به وقت محلی شما نمایش داده می‌شود
        </p>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          در حال بارگذاری...
        </p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-destructive">{error}</p>
      ) : slots && slots.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((slotIso) => (
            <button
              key={slotIso}
              type="button"
              onClick={() => onPick(slotIso)}
              className="tap-target rounded-xl border bg-background/80 px-3 py-3 text-sm font-bold transition-colors hover:border-primary hover:bg-primary/5"
            >
              {formatLocalTime(slotIso)}
            </button>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          ساعت خالی برای این روز وجود ندارد.
        </p>
      )}
    </div>
  );
}

// ---------- Stage: Form ----------
function FormStep({
  block,
  type,
  dateIso,
  slotIso,
  onDone,
}: {
  block: PublicBookingBlockData;
  type: PublicBookingTypeData;
  dateIso: string;
  slotIso: string;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const guestTimezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("نام را وارد کنید.");
      return;
    }
    if (!email.trim()) {
      setError("ایمیل را وارد کنید.");
      return;
    }
    startTransition(async () => {
      const res = await submitPublicBookingAction({
        blockId: block.id,
        bookingTypeId: type.id,
        startsAtIso: slotIso,
        guestName: trimmed,
        guestEmail: email.trim(),
        guestPhone: phone.trim() || null,
        notes: notes.trim() || null,
        guestTimezone,
      });
      if (!res.ok) {
        setError(res.message ?? "ثبت رزرو ناموفق بود.");
        return;
      }
      onDone(trimmed);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-sm">
        <p className="font-bold">{type.title}</p>
        <p className="text-[12px] text-muted-foreground">
          {formatLocalDateTime(slotIso)}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="booking-name">نام</Label>
        <Input
          id="booking-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          enterKeyHint="next"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="booking-email">ایمیل</Label>
        <Input
          id="booking-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="next"
          dir="ltr"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="booking-phone">شماره تماس (اختیاری)</Label>
        <Input
          id="booking-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="booking-notes">یادداشت (اختیاری)</Label>
        <Textarea
          id="booking-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          enterKeyHint="done"
        />
      </div>

      {error ? (
        <p className="text-sm font-semibold text-destructive">{error}</p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "در حال ثبت..." : "تأیید و رزرو"}
      </Button>
    </form>
  );
}

// ---------- Stage: Confirmed ----------
function ConfirmedStep({
  block,
  type,
  slotIso,
  guestName,
  onClose,
}: {
  block: PublicBookingBlockData;
  type: PublicBookingTypeData;
  slotIso: string;
  guestName: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-primary/15 text-primary">
        <CheckIcon className="size-8" />
      </span>
      <div>
        <h3 className="text-lg font-bold">رزرو شما ثبت شد</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {guestName} عزیز، جزئیات رزرو شما:
        </p>
      </div>
      <div className="w-full rounded-2xl bg-foreground/[0.04] p-4 text-sm">
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">نوع</span>
          <span className="font-bold">{type.title}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">زمان</span>
          <span className="font-bold">{formatLocalDateTime(slotIso)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">مدت</span>
          <span className="font-bold">
            {toPersianDigits(type.durationMin)} دقیقه
          </span>
        </div>
        {block.locationType === "online" && block.meetingLink ? (
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-muted-foreground">لینک</span>
            <a
              href={block.meetingLink}
              dir="ltr"
              className="truncate font-bold text-primary underline"
              target="_blank"
              rel="noreferrer noopener"
            >
              {block.meetingLink}
            </a>
          </div>
        ) : null}
        {block.locationType === "in_person" && block.locationAddress ? (
          <div className="py-1">
            <span className="block text-muted-foreground">نشانی</span>
            <span className="mt-1 block font-bold">
              {block.locationAddress}
            </span>
          </div>
        ) : null}
      </div>
      <Button className="w-full" onClick={onClose}>
        بستن
      </Button>
    </div>
  );
}

// ---------- Helpers ----------
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fa-IR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
