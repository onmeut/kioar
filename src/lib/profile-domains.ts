/**
 * Public hosts a user can choose from for their share URL. Order is shown
 * verbatim in the dropdown. The first entry is the default for new profiles
 * and the source of truth for the database default.
 */
export const PROFILE_DOMAINS = [
  "kioar.com",
  "kioar.me",
  "kioar.bio",
  "kioar.link",
  "kioar.ir",
  "kioar.app",
] as const;

export type ProfileDomain = (typeof PROFILE_DOMAINS)[number];

export const DEFAULT_PROFILE_DOMAIN: ProfileDomain = "kioar.com";

export function isProfileDomain(value: unknown): value is ProfileDomain {
  return (
    typeof value === "string" &&
    (PROFILE_DOMAINS as readonly string[]).includes(value)
  );
}

/**
 * Production share URL for a profile, using the user's chosen domain.
 *
 * In dev (`NODE_ENV !== "production"`) we ignore the chosen domain and use
 * `NEXT_PUBLIC_APP_URL` so localhost links still work.
 */
export function profileShareUrl(slug: string, domain: ProfileDomain | string) {
  const cleanSlug = slug.replace(/^\/+/, "");
  if (process.env.NODE_ENV !== "production") {
    const base = (
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    ).replace(/\/$/, "");
    return `${base}/${cleanSlug}`;
  }
  const host = isProfileDomain(domain) ? domain : DEFAULT_PROFILE_DOMAIN;
  return `https://${host}/${cleanSlug}`;
}

export function profileShareHost(slug: string, domain: ProfileDomain | string) {
  const host = isProfileDomain(domain) ? domain : DEFAULT_PROFILE_DOMAIN;
  return `${host}/${slug.replace(/^\/+/, "")}`;
}
