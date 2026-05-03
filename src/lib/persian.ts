/**
 * @deprecated Import from `@/lib/date/persian` instead. This file exists only
 * for backwards compatibility with existing imports across the codebase. All
 * Persian/Shamsi date handling is centralised in `src/lib/date/persian.ts`.
 *
 * The legacy names `formatPersianDate*` are aliased to the new `formatShamsi*`
 * helpers, which use Asia/Tehran timezone and the Persian calendar explicitly.
 */

export {
  toEnglishDigits,
  toPersianDigits,
  formatPersianNumber,
  formatShamsiDate as formatPersianDate,
  formatShamsiDateTime as formatPersianDateTime,
  formatShamsiTime as formatPersianTime,
} from "@/lib/date/persian";
