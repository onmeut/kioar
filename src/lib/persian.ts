const easternArabicNumerals = "٠١٢٣٤٥٦٧٨٩"
const persianNumerals = "۰۱۲۳۴۵۶۷۸۹"

export function toEnglishDigits(input: string) {
  return input
    .replace(/[۰-۹]/g, (digit) => String(persianNumerals.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) =>
      String(easternArabicNumerals.indexOf(digit))
    )
}

export function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => persianNumerals[Number(digit)])
}

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "long",
})

const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "long",
  timeStyle: "short",
})

const timeFormatter = new Intl.DateTimeFormat("fa-IR", {
  timeStyle: "short",
})

const numberFormatter = new Intl.NumberFormat("fa-IR")

export function formatPersianDate(input: Date | string) {
  return dateFormatter.format(new Date(input))
}

export function formatPersianDateTime(input: Date | string) {
  return dateTimeFormatter.format(new Date(input))
}

export function formatPersianTime(input: Date | string) {
  return timeFormatter.format(new Date(input))
}

export function formatPersianNumber(value: number) {
  return numberFormatter.format(value)
}
