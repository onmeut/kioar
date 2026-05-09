/**
 * Discover (kioar.com/discover) — hardcoded taxonomy.
 *
 * The directory uses a small, curated category list rather than free-form
 * tags so the home pills stay tidy and creators land in coherent buckets.
 * Slugs are stable identifiers persisted in `profiles.discover_category`;
 * never rename a slug — only add new ones at the bottom.
 *
 * Cities are a free-text-with-suggestions list — `profiles.city` is a
 * plain text column, and these are just the dropdown defaults.
 */

export type DiscoverCategorySlug =
  | "music"
  | "design"
  | "education"
  | "coaching"
  | "shop"
  | "restaurant"
  | "doctor"
  | "lawyer"
  | "consultant"
  | "blogger"
  | "athlete"
  | "photographer"
  | "developer"
  | "salon";

export type DiscoverCategory = {
  slug: DiscoverCategorySlug;
  label: string; // Persian display label
  emoji: string;
};

export const DISCOVER_CATEGORIES: readonly DiscoverCategory[] = [
  { slug: "music", label: "موسیقی", emoji: "🎵" },
  { slug: "design", label: "طراحی", emoji: "🎨" },
  { slug: "education", label: "آموزش", emoji: "📚" },
  { slug: "coaching", label: "کوچینگ", emoji: "🎯" },
  { slug: "shop", label: "فروشگاه", emoji: "🛍️" },
  { slug: "restaurant", label: "رستوران", emoji: "🍕" },
  { slug: "doctor", label: "پزشک", emoji: "⚕️" },
  { slug: "lawyer", label: "وکیل", emoji: "⚖️" },
  { slug: "consultant", label: "مشاور", emoji: "💼" },
  { slug: "blogger", label: "بلاگر", emoji: "✍️" },
  { slug: "athlete", label: "ورزشکار", emoji: "⚽" },
  { slug: "photographer", label: "عکاس", emoji: "📸" },
  { slug: "developer", label: "برنامه‌نویس", emoji: "💻" },
  { slug: "salon", label: "آرایشگاه", emoji: "💇" },
] as const;

const SLUG_SET = new Set<string>(DISCOVER_CATEGORIES.map((c) => c.slug));

export function isDiscoverCategorySlug(
  value: unknown,
): value is DiscoverCategorySlug {
  return typeof value === "string" && SLUG_SET.has(value);
}

export function getDiscoverCategory(
  slug: string | null | undefined,
): DiscoverCategory | null {
  if (!slug) return null;
  return DISCOVER_CATEGORIES.find((c) => c.slug === slug) ?? null;
}

/**
 * Major Iranian cities (Persian). Used as the dropdown options on the
 * creator's "City" picker. The DB column is plain text, so any value
 * is acceptable — these are just the curated suggestions.
 */
export const IRANIAN_CITIES: readonly string[] = [
  "تهران",
  "مشهد",
  "اصفهان",
  "شیراز",
  "تبریز",
  "اهواز",
  "کرج",
  "قم",
  "کرمانشاه",
  "ارومیه",
  "رشت",
  "زاهدان",
  "کرمان",
  "همدان",
  "یزد",
  "اردبیل",
  "بندرعباس",
  "اراک",
  "ساری",
  "قزوین",
] as const;
