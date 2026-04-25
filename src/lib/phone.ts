import { toEnglishDigits, toPersianDigits } from "@/lib/persian"

const IRAN_PHONE_REGEX = /^(?:\+98|98|0)?9\d{9}$/

export function normalizeIranianPhone(input: string) {
  const normalized = toEnglishDigits(input).replace(/[^\d+]/g, "")

  if (!IRAN_PHONE_REGEX.test(normalized)) {
    throw new Error("شماره موبایل معتبر نیست.")
  }

  if (normalized.startsWith("+98")) {
    return normalized
  }

  if (normalized.startsWith("98")) {
    return `+${normalized}`
  }

  return `+98${normalized.slice(1)}`
}

export function isIranianPhone(input: string) {
  try {
    normalizeIranianPhone(input)
    return true
  } catch {
    return false
  }
}

export function formatPhoneDisplay(input: string) {
  try {
    const phone = normalizeIranianPhone(input)
    const local = `0${phone.slice(3)}`
    return toPersianDigits(
      `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
    )
  } catch {
    return toPersianDigits(input)
  }
}
