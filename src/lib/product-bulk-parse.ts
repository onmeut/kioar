// Bulk-paste parser for product items.
//
// Accepted line formats (Persian or Latin digits, RTL or LTR):
//   `name`
//   `name | price`
//   `name | price | description`
//
// `price` may be:
//   - a positive number (treated as the **major unit** for the chosen
//     currency: tomans for IRT, dollars for USD, euros for EUR)
//   - "from <number>" / "از <number>" → priceType: "from"
//   - "<low>-<high>" / "<low>–<high>" → priceType: "range"
//   - "free" / "رایگان" → priceType: "free"
//   - "on request" / "تماس" → priceType: "on_request"
//
// Empty lines are skipped. Lines that fail to parse are reported with
// their 1-based line number so the UI can show inline errors.

import { toEnglishDigits } from "@/lib/persian";
import {
  PRODUCT_ITEMS_HARD_CAP,
  type ProductBlockCurrency,
  type ProductItemInput,
  type ProductItemPriceType,
} from "@/lib/validations";

export type BulkParseError = { line: number; message: string };

export type BulkParseResult = {
  items: ProductItemInput[];
  errors: BulkParseError[];
};

const MAJOR_TO_MINOR: Record<ProductBlockCurrency, number> = {
  IRT: 10, // toman → rial
  USD: 100, // dollar → cent
  EUR: 100, // euro → cent
};

function parsePriceToken(
  raw: string,
  currency: ProductBlockCurrency,
): {
  priceType: ProductItemPriceType;
  priceAmount: number;
  priceAmountMax?: number | null;
} | null {
  const text = toEnglishDigits(raw).trim().toLowerCase();
  if (!text) return null;

  if (text === "free" || text === "رایگان") {
    return { priceType: "free", priceAmount: 0 };
  }
  if (
    text === "on request" ||
    text === "on_request" ||
    text === "تماس" ||
    text === "تماس بگیرید"
  ) {
    return { priceType: "on_request", priceAmount: 0 };
  }

  const fromMatch = /^(?:from|از)\s+(\d+(?:\.\d+)?)/.exec(text);
  if (fromMatch) {
    const major = Number(fromMatch[1]);
    if (!Number.isFinite(major) || major < 0) return null;
    return {
      priceType: "from",
      priceAmount: Math.round(major * MAJOR_TO_MINOR[currency]),
    };
  }

  const rangeMatch = /^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/.exec(text);
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (
      !Number.isFinite(low) ||
      !Number.isFinite(high) ||
      low < 0 ||
      high <= low
    ) {
      return null;
    }
    return {
      priceType: "range",
      priceAmount: Math.round(low * MAJOR_TO_MINOR[currency]),
      priceAmountMax: Math.round(high * MAJOR_TO_MINOR[currency]),
    };
  }

  // Plain number — strip thousand separators (commas + Persian/Arabic).
  const cleaned = text.replace(/[,،]/g, "");
  if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
    const major = Number(cleaned);
    if (!Number.isFinite(major) || major < 0) return null;
    return {
      priceType: "fixed",
      priceAmount: Math.round(major * MAJOR_TO_MINOR[currency]),
    };
  }

  return null;
}

export function parseBulkItems(
  text: string,
  currency: ProductBlockCurrency,
): BulkParseResult {
  const items: ProductItemInput[] = [];
  const errors: BulkParseError[] = [];

  const rawLines = text.split(/\r?\n/);

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1;
    const line = rawLines[i].trim();
    if (!line) continue;

    if (items.length >= PRODUCT_ITEMS_HARD_CAP) {
      errors.push({
        line: lineNumber,
        message: `حداکثر ${PRODUCT_ITEMS_HARD_CAP} مورد قابل ثبت است.`,
      });
      break;
    }

    const parts = line.split("|").map((p) => p.trim());
    const title = parts[0];
    if (!title) {
      errors.push({ line: lineNumber, message: "عنوان لازم است." });
      continue;
    }
    if (title.length > 120) {
      errors.push({ line: lineNumber, message: "عنوان طولانی است (>۱۲۰)." });
      continue;
    }

    let price: ReturnType<typeof parsePriceToken> = null;
    if (parts[1]) {
      price = parsePriceToken(parts[1], currency);
      if (!price) {
        errors.push({
          line: lineNumber,
          message: `قیمت قابل تشخیص نیست: «${parts[1]}»`,
        });
        continue;
      }
    }

    const description = parts[2]?.slice(0, 280) || null;

    items.push({
      id: null,
      sectionRef: null,
      title,
      description,
      imageUrl: null,
      priceType: price?.priceType ?? "fixed",
      priceAmount: price?.priceAmount ?? 0,
      priceAmountMax: price?.priceAmountMax ?? null,
      availability: "available",
      externalUrl: null,
      badge: null,
      sku: null,
    });
  }

  return { items, errors };
}
