"use client";

import { useMemo, useState } from "react";
import { CalendarIcon, ChevronRightIcon, ChevronLeftIcon } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatShamsiDate,
  formatShamsiMonthYear,
  parseShamsi,
  shamsiAddMonths,
  shamsiDaysInMonth,
  shamsiMonth,
  shamsiStartOfMonth,
  shamsiSubMonths,
  shamsiWeekdayColumn,
  shamsiYear,
  tehranIsoDate,
  toPersianDigits,
} from "@/lib/date/persian";

export type ShamsiDateTimeValue = {
  /** Gregorian ISO date `YYYY-MM-DD` (empty = unset). */
  date: string;
  /** 24h `HH:mm` (empty = unset). */
  time: string;
};

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/**
 * The single Shamsi date+time picker for the events module. Builds the month
 * grid from `shamsiStartOfMonth + shamsiDaysInMonth + shamsiWeekdayColumn`
 * and labels each cell with its TRUE Jalali day-of-month — never iterating
 * `new Date(y, m, d)` under a Persian header (the locked-in booking-grid
 * rule). Emits a Gregorian ISO date so callers store UTC truth.
 */
export function ShamsiDateTimePicker({
  value,
  onChange,
  label,
  required,
}: {
  value: ShamsiDateTimeValue;
  onChange: (next: ShamsiDateTimeValue) => void;
  label: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The month currently shown in the grid (anchored to the selected date or
  // today). Stored as a Date; all reads go through the shamsi helpers.
  const [cursor, setCursor] = useState<Date>(() =>
    value.date ? new Date(`${value.date}T12:00:00`) : new Date(),
  );

  const grid = useMemo(() => {
    const start = shamsiStartOfMonth(cursor);
    const jYear = shamsiYear(start);
    const jMonth = shamsiMonth(start); // 0-based
    const days = shamsiDaysInMonth(start);
    const leading = shamsiWeekdayColumn(start); // Sat=0 column of day 1
    const cells: Array<{ jDay: number; iso: string } | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      // Build the Gregorian ISO for this Jalali day via parseShamsi → Tehran ISO.
      const iso = tehranIsoDate(
        parseShamsi(`${jYear}/${jMonth + 1}/${d}`),
      );
      cells.push({ jDay: d, iso });
    }
    return { jYear, cells };
  }, [cursor]);

  const selectedDisplay = value.date
    ? formatSelected(value.date)
    : "انتخاب تاریخ";

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className={cn(
              "tap-target flex h-11 flex-1 items-center gap-2 rounded-2xl border border-border bg-transparent px-4 text-start text-base transition-colors hover:bg-muted/50",
              !value.date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{selectedDisplay}</span>
          </PopoverTrigger>
          <PopoverContent className="w-[20rem] p-3">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="ماه قبل"
                onClick={() => setCursor((c) => shamsiSubMonths(c, 1))}
                className="tap-target inline-flex size-9 items-center justify-center rounded-xl hover:bg-muted"
              >
                <ChevronRightIcon className="size-5" />
              </button>
              <span className="text-sm font-bold">
                {formatShamsiMonthYear(shamsiStartOfMonth(cursor))}
              </span>
              <button
                type="button"
                aria-label="ماه بعد"
                onClick={() => setCursor((c) => shamsiAddMonths(c, 1))}
                className="tap-target inline-flex size-9 items-center justify-center rounded-xl hover:bg-muted"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.cells.map((cell, i) => {
                if (!cell) return <span key={`pad-${i}`} />;
                const isSelected = value.date === cell.iso;
                const isToday = cell.iso === tehranIsoDate(new Date());
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => {
                      onChange({ ...value, date: cell.iso });
                      setOpen(false);
                    }}
                    className={cn(
                      "tap-target inline-flex h-9 items-center justify-center rounded-xl text-sm transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold"
                        : isToday
                          ? "bg-muted font-semibold"
                          : "hover:bg-muted",
                    )}
                  >
                    {toPersianDigits(cell.jDay)}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        <input
          type="time"
          dir="ltr"
          value={value.time}
          required={required}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          aria-label={`${label} - ساعت`}
          className="h-11 w-28 rounded-2xl border border-border bg-transparent px-3 text-base outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/20"
        />
      </div>
    </div>
  );
}

function formatSelected(iso: string): string {
  // iso is a Gregorian YYYY-MM-DD anchored to noon to dodge DST edges; render
  // its full Shamsi equivalent (e.g. «۸ اردیبهشت ۱۴۰۵»).
  return formatShamsiDate(new Date(`${iso}T12:00:00`));
}
