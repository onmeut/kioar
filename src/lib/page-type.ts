/**
 * Page archetype taxonomy.
 *
 * Captured during onboarding (step 3). Stored as plain text in
 * `profiles.page_type` so we can extend the list later without paying for
 * a Postgres ENUM migration. Slugs are stable identifiers — never rename,
 * only add new ones at the bottom.
 *
 * Personal vs Business is intentionally a binary choice: it drives default
 * suggestions in the editor (tone of copywriting, suggested blocks) but
 * does NOT affect plan gating or Discover category eligibility.
 */

export type PageTypeSlug = "personal" | "business";

export type PageType = {
  slug: PageTypeSlug;
  label: string; // Persian display label
  description: string; // Persian one-liner shown under the option
};

export const PAGE_TYPES: readonly PageType[] = [
  {
    slug: "personal",
    label: "شخصی",
    description: "برای افراد، سازندگان محتوا، فریلنسرها",
  },
  {
    slug: "business",
    label: "کسب‌وکار",
    description: "برای برندها، شرکت‌ها و کسب‌وکارها",
  },
] as const;

const SLUG_SET = new Set<string>(PAGE_TYPES.map((t) => t.slug));

export function isPageTypeSlug(value: unknown): value is PageTypeSlug {
  return typeof value === "string" && SLUG_SET.has(value);
}

export function getPageType(slug: string | null | undefined): PageType | null {
  if (!slug) return null;
  return PAGE_TYPES.find((t) => t.slug === slug) ?? null;
}
