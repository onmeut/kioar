import { cookies } from "next/headers";

/**
 * Visitor-side referral attribution cookie. Written by `/r/:code`,
 * read by the OTP verify path to attach a `referee_user_id` to the
 * matching `referrals` row.
 *
 * Value is the `referrals.cookie_id` (an opaque uuid) — NOT the bare
 * referral code. Decoupling the cookie value from the public code lets
 * us revoke or rotate codes in the future without replaying stale
 * attribution from older visitors' browsers.
 *
 * SameSite=Lax so a click from Telegram/WhatsApp/etc. (cross-site
 * navigation, top-level GET) carries the cookie through to signup.
 */
export const REFERRAL_COOKIE_NAME = "kioar_ref";

const REFERRAL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function readReferralCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(REFERRAL_COOKIE_NAME)?.value;
  return value && UUID_RE.test(value) ? value : null;
}

export async function writeReferralCookie(cookieId: string): Promise<void> {
  const store = await cookies();
  store.set(REFERRAL_COOKIE_NAME, cookieId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: REFERRAL_TTL_SECONDS,
    path: "/",
  });
}

export async function clearReferralCookie(): Promise<void> {
  const store = await cookies();
  store.set(REFERRAL_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}
