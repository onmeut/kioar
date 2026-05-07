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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsInMockup } from "@/components/dashboard/mockup-portal-context";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  getPublicBookingSlotsAction,
  submitPublicBookingAction,
  type PublicBookingSubmitResult,
} from "@/app/[slug]/bookings/actions";
import {
  formatShamsiMonthYear,
  formatShamsiWeekdayDayMonth,
  shamsiAddMonths,
  shamsiDaysInMonth,
  shamsiIsSameDay,
  shamsiStartOfMonth,
  shamsiWeekdayColumn,
  tehranIsoDate,
  tehranLocalView,
  toPersianDigits,
} from "@/lib/date/persian";
import {
  detectUserTimezone,
  formatOffset,
  formatShamsiDateTimeInZone,
  formatShamsiTimeInZone,
  isValidTimezone,
} from "@/lib/date/timezone";
import { buildTimezoneOptions } from "@/lib/timezones";
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

export type PublicBookingSlotsAction = (input: {
  blockId: string;
  bookingTypeId: string;
  dateIso: string;
}) => Promise<{ ok: true; slots: string[] } | { ok: false; message: string }>;

export type PublicBookingSubmitAction = (
  input: unknown,
) => Promise<PublicBookingSubmitResult>;

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

export function PublicBookingPill({
  block,
  defaultOpen = false,
  className,
  getSlotsAction = getPublicBookingSlotsAction,
  submitBookingAction = submitPublicBookingAction,
}: {
  block: PublicBookingBlockData;
  defaultOpen?: boolean;
  className?: string;
  getSlotsAction?: PublicBookingSlotsAction;
  submitBookingAction?: PublicBookingSubmitAction;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex w-full items-center justify-center rounded-full bg-foreground/4 px-4 py-4 transition-colors hover:bg-primary/8 active:bg-primary/12",
          className,
        )}
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
      <PublicBookingModal
        block={block}
        open={open}
        onOpenChange={setOpen}
        getSlotsAction={getSlotsAction}
        submitBookingAction={submitBookingAction}
      />
    </>
  );
}

function PublicBookingModal({
  block,
  open,
  onOpenChange,
  getSlotsAction,
  submitBookingAction,
}: {
  block: PublicBookingBlockData;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  getSlotsAction: PublicBookingSlotsAction;
  submitBookingAction: PublicBookingSubmitAction;
}) {
  const isMobile = useIsMobile();
  // See public-form-modal.tsx — same rationale: when rendered inside the
  // dashboard live-preview phone mockup, always use the fullscreen sheet so
  // the modal fills the phone canvas instead of a centered desktop dialog.
  const inMockup = useIsInMockup();
  const fullscreen = isMobile || inMockup;
  const [stage, setStage] = useState<Stage>({ kind: "types" });

  // Booker timezone — detected on mount, persisted per-block in
  // localStorage so returning visitors keep their pick. Falls back to
  // Asia/Tehran if detection fails or the persisted zone is invalid.
  const tzStorageKey = `kioar:booking-tz:${block.id}`;
  const [bookerTz, setBookerTz] = useState<string>(block.timezone);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const persisted = window.localStorage.getItem(tzStorageKey);
      if (persisted && isValidTimezone(persisted)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBookerTz(persisted);
        return;
      }
    } catch {
      // ignore
    }
    setBookerTz(detectUserTimezone(block.timezone));
  }, [tzStorageKey, block.timezone]);

  const onChangeBookerTz = useCallback(
    (tz: string) => {
      if (!isValidTimezone(tz)) return;
      setBookerTz(tz);
      try {
        window.localStorage.setItem(tzStorageKey, tz);
      } catch {
        // ignore
      }
    },
    [tzStorageKey],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
            bookerTz={bookerTz}
            onChangeBookerTz={onChangeBookerTz}
            getSlotsAction={getSlotsAction}
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
            slotIso={stage.slotIso}
            bookerTz={bookerTz}
            submitBookingAction={submitBookingAction}
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
            bookerTz={bookerTz}
            guestName={stage.guestName}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="inset-0 h-full max-h-none rounded-none p-0"
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
        className="h-[88vh] w-full max-w-130 gap-0 overflow-hidden p-0 sm:max-w-130"
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
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/4 px-3 py-1">
            <VideoIcon className="size-3" />
            آنلاین
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/4 px-3 py-1">
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
  // Anchor everything to Asia/Tehran wall time so the calendar grid is
  // computed in the Shamsi (Jalali) calendar, not the visitor's local
  // Gregorian calendar. The backend still receives a Gregorian YYYY-MM-DD
  // string, but the visible grid (rows, columns, day numbers, month label)
  // is fully Shamsi.
  const now = useMemo(() => new Date(), []);
  const [monthOffset, setMonthOffset] = useState(0);

  // First day of the displayed Shamsi month, expressed as a Tehran-shifted
  // "local view" Date (see `tehranLocalView`). We never persist this value
  // — only format/iterate against it.
  const viewMonthStart = useMemo(
    () => shamsiStartOfMonth(shamsiAddMonths(now, monthOffset)),
    [monthOffset, now],
  );

  const monthLabel = formatShamsiMonthYear(
    // Convert the Tehran-shifted view back to a real instant for Intl by
    // taking noon of the same Y/M/D — far from any DST seam.
    new Date(
      Date.UTC(
        viewMonthStart.getFullYear(),
        viewMonthStart.getMonth(),
        viewMonthStart.getDate(),
        9, // 09:00 UTC ≈ 12:30 Tehran
        0,
      ),
    ),
  );

  const daysInMonth = shamsiDaysInMonth(viewMonthStart);
  // Saturday-first column (0=Sat … 6=Fri).
  const firstCol = shamsiWeekdayColumn(viewMonthStart);

  // Today's Gregorian date in Tehran tz, used both to disable past cells
  // and to highlight "today".
  const todayIso = tehranIsoDate(now);
  const todayShifted = tehranLocalView(now);

  // Build cells for the Shamsi month. Each visible cell carries:
  //   - dateIso: Gregorian YYYY-MM-DD in Tehran tz (what the backend expects)
  //   - day: Shamsi day-of-month (1..31) — what the user sees
  //   - isToday: whether this cell is "today" in Tehran
  const cells: Array<{
    dateIso: string | null;
    day: number | null;
    isToday: boolean;
  }> = [];
  for (let i = 0; i < firstCol; i++) {
    cells.push({ dateIso: null, day: null, isToday: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    // Shifted Date for the d-th day of the displayed Shamsi month. Because
    // `viewMonthStart` is a Tehran-shifted local Date, adding `d-1` days in
    // the local frame keeps us in the same Shamsi month.
    const shifted = new Date(viewMonthStart);
    shifted.setDate(shifted.getDate() + (d - 1));
    // Convert the Tehran-local Y/M/D directly into the YYYY-MM-DD string
    // — the shift was constructed so local fields == Tehran wall fields.
    const y = shifted.getFullYear();
    const m = String(shifted.getMonth() + 1).padStart(2, "0");
    const day = String(shifted.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;
    cells.push({
      dateIso: iso,
      day: d,
      isToday: shamsiIsSameDay(shifted, todayShifted),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ dateIso: null, day: null, isToday: false });
  }

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
                  : "bg-foreground/4 hover:bg-primary/10 hover:text-primary",
                cell.isToday && !isPast ? "ring-1 ring-primary" : null,
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
  bookerTz,
  onChangeBookerTz,
  getSlotsAction,
  onPick,
}: {
  block: PublicBookingBlockData;
  type: PublicBookingTypeData;
  dateIso: string;
  bookerTz: string;
  onChangeBookerTz: (tz: string) => void;
  getSlotsAction: PublicBookingSlotsAction;
  onPick: (slotIso: string) => void;
}) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    getSlotsAction({
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
  }, [block.id, type.id, dateIso, getSlotsAction]);

  // dateIso is a Gregorian YYYY-MM-DD anchored to Tehran. Anchor to noon UTC
  // so the Tehran-tz formatter never lands on the wrong day for that ISO.
  const dateLabel = formatShamsiWeekdayDayMonth(
    new Date(`${dateIso}T09:00:00Z`),
  );

  const sameTz = bookerTz === block.timezone;
  const tzOptions = useMemo(() => buildTimezoneOptions(bookerTz), [bookerTz]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-foreground/4 px-4 py-3 text-sm">
        <p className="font-bold">{dateLabel}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span>
            ساعت‌ها به وقت <span dir="ltr">{bookerTz}</span> (
            <span dir="ltr">{formatOffset(bookerTz)}</span>)
          </span>
          {pickerOpen ? (
            <Select
              value={bookerTz}
              onValueChange={(v) => {
                if (!v) return;
                onChangeBookerTz(v);
                setPickerOpen(false);
              }}
            >
              <SelectTrigger className="h-8 max-w-65 text-[12px]" dir="ltr">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tzOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} dir="ltr">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="font-bold text-primary underline-offset-2 hover:underline"
            >
              تغییر منطقه
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          در حال بارگذاری...
        </p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-destructive">{error}</p>
      ) : slots && slots.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((slotIso) => {
            const localTime = formatShamsiTimeInZone(slotIso, bookerTz);
            const hostTime = formatShamsiTimeInZone(slotIso, block.timezone);
            return (
              <button
                key={slotIso}
                type="button"
                onClick={() => onPick(slotIso)}
                title={
                  sameTz
                    ? undefined
                    : `${localTime} به وقت شما · ${hostTime} به وقت میزبان`
                }
                className="tap-target rounded-xl border bg-background/80 px-3 py-3 text-sm font-bold transition-colors hover:border-primary hover:bg-primary/5"
              >
                {localTime}
              </button>
            );
          })}
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
  slotIso,
  bookerTz,
  submitBookingAction,
  onDone,
}: {
  block: PublicBookingBlockData;
  type: PublicBookingTypeData;
  slotIso: string;
  bookerTz: string;
  submitBookingAction: PublicBookingSubmitAction;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      const res = await submitBookingAction({
        blockId: block.id,
        bookingTypeId: type.id,
        startsAtIso: slotIso,
        guestName: trimmed,
        guestEmail: email.trim(),
        guestPhone: phone.trim() || null,
        notes: notes.trim() || null,
        guestTimezone: bookerTz,
      });
      if (!res.ok) {
        setError(res.message ?? "ثبت رزرو ناموفق بود.");
        return;
      }
      onDone(trimmed);
    });
  }

  const sameTz = bookerTz === block.timezone;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl bg-foreground/4 px-4 py-3 text-sm">
        <p className="font-bold">{type.title}</p>
        <p className="text-[12px] text-muted-foreground">
          {formatShamsiDateTimeInZone(slotIso, bookerTz)} · به وقت{" "}
          <span dir="ltr">{bookerTz}</span>
        </p>
        {sameTz ? null : (
          <p className="mt-1 text-[11px] text-muted-foreground">
            به وقت میزبان: {formatShamsiDateTimeInZone(slotIso, block.timezone)}{" "}
            (<span dir="ltr">{block.timezone}</span>)
          </p>
        )}
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
  bookerTz,
  guestName,
  onClose,
}: {
  block: PublicBookingBlockData;
  type: PublicBookingTypeData;
  slotIso: string;
  bookerTz: string;
  guestName: string;
  onClose: () => void;
}) {
  const sameTz = bookerTz === block.timezone;
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
      <div className="w-full rounded-2xl bg-foreground/4 p-4 text-sm">
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">نوع</span>
          <span className="font-bold">{type.title}</span>
        </div>
        <div className="flex items-start justify-between gap-3 py-1">
          <span className="text-muted-foreground">زمان</span>
          <span className="text-end font-bold">
            {formatShamsiDateTimeInZone(slotIso, bookerTz)}
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              به وقت <span dir="ltr">{bookerTz}</span>
            </span>
            {sameTz ? null : (
              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                میزبان: {formatShamsiDateTimeInZone(slotIso, block.timezone)} (
                <span dir="ltr">{block.timezone}</span>)
              </span>
            )}
          </span>
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
// All Persian/Shamsi date rendering is centralised in `@/lib/date/persian`
// (Tehran-anchored) and `@/lib/date/timezone` (arbitrary IANA zone).
