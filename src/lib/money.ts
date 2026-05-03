// Money formatting for product blocks.
//
// Stored amounts are in **minor units**:
//   IRT → rials (10 rial = 1 toman; we display tomans by dividing by 10)
//   USD → cents (divide by 100; show 2 fraction digits)
//   EUR → cents (divide by 100; show 2 fraction digits)
//
// All output is right-to-left when rendered inside an RTL container; the
// helpers themselves return plain strings — callers wrap them in spans
// with the appropriate `dir` attribute.

import { formatPersianNumber, toPersianDigits } from "@/lib/persian";
import type {
  ProductBlockCurrency,
  ProductItemPriceType,
} from "@/lib/validations";

type CurrencyConfig = {
  /** Minor units per major unit (10 for IRT, 100 for USD/EUR). */
  divisor: number;
  /** How many fraction digits to show for non-zero fractional amounts. */
  fractionDigits: number;
  /** Suffix label (e.g. "تومان") shown after the number when `withSuffix`. */
  suffixFa: string;
  /** Currency symbol shown as prefix when `withSymbol`. */
  symbol: string;
  /** Persian digits? IRT uses Persian; USD/EUR keep Latin. */
  persianDigits: boolean;
};

const CURRENCY_CONFIG: Record<ProductBlockCurrency, CurrencyConfig> = {
  IRT: {
    divisor: 10,
    fractionDigits: 0,
    suffixFa: "تومان",
    symbol: "",
    persianDigits: true,
  },
  USD: {
    divisor: 100,
    fractionDigits: 2,
    suffixFa: "",
    symbol: "$",
    persianDigits: false,
  },
  EUR: {
    divisor: 100,
    fractionDigits: 2,
    suffixFa: "",
    symbol: "€",
    persianDigits: false,
  },
};

function formatMajor(minor: number, currency: ProductBlockCurrency): string {
  const cfg = CURRENCY_CONFIG[currency];
  const major = minor / cfg.divisor;
  const hasFraction = cfg.fractionDigits > 0 && major % 1 !== 0;
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: hasFraction ? cfg.fractionDigits : 0,
    maximumFractionDigits: cfg.fractionDigits,
  });
  return cfg.persianDigits ? toPersianDigits(formatted) : formatted;
}

/** Format a single amount in the chosen currency. */
export function formatAmount(
  minor: number,
  currency: ProductBlockCurrency,
): string {
  const cfg = CURRENCY_CONFIG[currency];
  const num = formatMajor(minor, currency);
  if (cfg.symbol) return `${cfg.symbol}${num}`;
  if (cfg.suffixFa) return `${num} ${cfg.suffixFa}`;
  return num;
}

/** Convenience used by tests + dashboard preview for IRT. */
export function formatToman(minorRials: number): string {
  return `${formatPersianNumber(Math.round(minorRials / 10))} تومان`;
}

export type PriceDisplayInput = {
  priceType: ProductItemPriceType;
  priceAmount: number;
  priceAmountMax?: number | null;
};

/**
 * Final price label for a product item, taking the price-type into
 * account. Returns an empty string when the block is configured to
 * hide prices (callers check that flag before invoking this).
 */
export function formatPriceDisplay(
  item: PriceDisplayInput,
  currency: ProductBlockCurrency,
): string {
  switch (item.priceType) {
    case "free":
      return "رایگان";
    case "on_request":
      return "تماس بگیرید";
    case "from":
      if (!item.priceAmount) return "";
      return `از ${formatAmount(item.priceAmount, currency)}`;
    case "range": {
      if (!item.priceAmount && !item.priceAmountMax) return "";
      if (item.priceAmountMax == null) {
        return formatAmount(item.priceAmount, currency);
      }
      return `${formatAmount(item.priceAmount, currency)} – ${formatAmount(
        item.priceAmountMax,
        currency,
      )}`;
    }
    case "fixed":
    default:
      if (!item.priceAmount) return "";
      return formatAmount(item.priceAmount, currency);
  }
}
