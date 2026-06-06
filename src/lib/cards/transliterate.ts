/**
 * Lightweight Persian → Latin transliteration for the "name on card" default.
 *
 * The card name is printed in Latin script (English/Latin per the spec). When
 * the page name is Persian we generate a best-effort romanized suggestion the
 * user can freely edit. This is intentionally simple — a phonetic approximation
 * good enough as a starting point, not a linguistically perfect ALA-LC scheme.
 *
 * If the input is already Latin (no Persian/Arabic letters), it's returned
 * mostly as-is (just title-cased per word).
 */

const CHAR_MAP: Record<string, string> = {
  ا: "a",
  آ: "a",
  أ: "a",
  إ: "e",
  ب: "b",
  پ: "p",
  ت: "t",
  ث: "s",
  ج: "j",
  چ: "ch",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "z",
  ر: "r",
  ز: "z",
  ژ: "zh",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "z",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "gh",
  ک: "k",
  ك: "k",
  گ: "g",
  ل: "l",
  م: "m",
  ن: "n",
  و: "v",
  ه: "h",
  ی: "i",
  ي: "i",
  ئ: "y",
  ؤ: "o",
  ة: "h",
  // Persian short-vowel diacritics (mostly absent in real text).
  "َ": "a",
  "ِ": "e",
  "ُ": "o",
  "ّ": "",
  "ْ": "",
  // Persian & Arabic digits.
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

const PERSIAN_ARABIC_RE = /[؀-ۿ]/;

function titleCaseWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Transliterate `input` to a Latin, title-cased, single-spaced string.
 * Returns "" for empty/whitespace input.
 */
export function transliterateName(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Already Latin → just normalize spacing + case.
  if (!PERSIAN_ARABIC_RE.test(trimmed)) {
    return trimmed
      .split(/\s+/)
      .map(titleCaseWord)
      .join(" ")
      .slice(0, 40);
  }

  let out = "";
  for (const ch of trimmed) {
    if (ch === "‌" || ch === "‍") {
      // ZWNJ / ZWJ → word break.
      out += " ";
      continue;
    }
    if (ch === " ") {
      out += " ";
      continue;
    }
    out += CHAR_MAP[ch] ?? (PERSIAN_ARABIC_RE.test(ch) ? "" : ch);
  }

  return out
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(titleCaseWord)
    .join(" ")
    .slice(0, 40);
}
