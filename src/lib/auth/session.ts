import { createHmac, randomBytes, randomInt } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { events, profiles, sessions, users } from "@/db/schema";
import { createConnection } from "@/lib/connections";
import { getRequiredEnv } from "@/lib/env";
import { registerForEvent } from "@/lib/events/registration-service";
import { log } from "@/lib/log";
import { resolveCurrentPageForOwner } from "@/lib/pages";

import {
  clearPendingConnect,
  clearPendingEventRegistration,
  getPendingConnect,
  getPendingEventRegistration,
} from "./pending-intent";

export const SESSION_COOKIE_NAME = "kioar_session";
// Separate httpOnly cookie that holds the *admin's* original session token
// while they are impersonating another user. Its mere presence is the flag
// that the UI uses to render the impersonation banner; its value is the
// session token we restore when the admin "exits" impersonation.
export const IMPERSONATION_RETURN_COOKIE_NAME = "kioar_imp_return";
export const OTP_TTL_SECONDS = 60 * 3;
// Resend cooldown: the minimum gap a user must wait before requesting a fresh
// SMS for the same phone. This is the SMS-spam throttle, NOT an expiry. It is
// enforced as a self-expiring Redis TTL key (see `src/lib/auth/otp.ts`), fail-
// open so a Redis hiccup never locks a legitimate user out — the per-phone and
// per-IP daily caps in `src/app/auth/actions.ts` are the abuse backstop.
export const OTP_COOLDOWN_SECONDS =
  process.env.NODE_ENV !== "production" &&
  process.env.OTP_COOLDOWN_SECONDS_DEV
    ? parseInt(process.env.OTP_COOLDOWN_SECONDS_DEV, 10)
    : 15;
export const OTP_MAX_ATTEMPTS = 5;
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hashSecret(value: string) {
  return createHmac("sha256", getRequiredEnv("AUTH_SECRET"))
    .update(value)
    .digest("hex");
}

export function getOtpHash(phone: string, code: string) {
  return hashSecret(`otp:${phone}:${code}`);
}

export function getSessionHash(token: string) {
  return hashSecret(`session:${token}`);
}

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function generateSessionToken() {
  return randomBytes(32).toString("hex");
}

function isAdminPhone(phone: string) {
  const adminPhones = (process.env.ADMIN_PHONE_NUMBERS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return adminPhones.includes(phone);
}

// The role we want this phone to have RIGHT NOW, based on the current
// env allow-list. Returning `"user"` when a phone was removed from the list
// actively demotes the account on next sign-in — otherwise a phone that was
// once granted admin would keep admin forever even after it leaves the list.
function desiredRoleForPhone(phone: string): "admin" | "user" {
  return isAdminPhone(phone) ? "admin" : "user";
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

export const getCurrentViewer = cache(async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  const db = getDb();
  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, getSessionHash(sessionToken)),
      gt(sessions.expiresAt, new Date()),
      isNull(sessions.revokedAt),
    ),
    with: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  // Banned users lose access immediately; the admin can always unban later.
  if (session.user.bannedAt) {
    return null;
  }

  // Impersonation: if a return cookie is set, the *current* session is the
  // target user and the admin's original session token is stashed in
  // `kioar_imp_return`. We look up that admin so the UI can render the
  // "exit impersonation" banner.
  const impersonatorToken = cookieStore.get(
    IMPERSONATION_RETURN_COOKIE_NAME,
  )?.value;
  let impersonator: { id: string; phone: string } | null = null;
  if (impersonatorToken) {
    const adminSession = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.tokenHash, getSessionHash(impersonatorToken)),
        gt(sessions.expiresAt, new Date()),
        isNull(sessions.revokedAt),
      ),
      with: { user: true },
    });
    if (
      adminSession &&
      adminSession.user.role === "admin" &&
      !adminSession.user.bannedAt
    ) {
      impersonator = {
        id: adminSession.user.id,
        phone: adminSession.user.phone,
      };
    }
  }

  // A user can own many pages now. `profile` here is the *current* page —
  // resolved from the `kioar_page_id` cookie with the user's first page
  // as a stable fallback.
  //
  // ⚠️ Treat `viewer.profile` as a "last-visited hint" only. Routes that
  // carry `[pageId]` in their URL (e.g. /account/billing/[pageId]/…,
  // /admin/billing/pages/[pageId]/…) MUST resolve the page from the URL
  // param via `getOwnedPageById`, never from `viewer.profile`, otherwise
  // a stale cookie can disagree with the URL.
  const currentPage = await resolveCurrentPageForOwner(session.user.id);

  return {
    session,
    user: session.user,
    profile: currentPage,
    impersonator,
  };
});

export async function requireUser() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/auth");
  }

  return viewer;
}

export async function requireCompletedProfile() {
  const viewer = await requireUser();

  const profile = viewer.profile;
  if (!profile || !profile.isComplete) {
    redirect("/start");
  }

  // After the guard the current page is non-null and complete; narrow the
  // return type so every dashboard call site can read `viewer.profile.slug`
  // without optional chaining.
  return { ...viewer, profile };
}

export async function requireAdmin() {
  const viewer = await requireCompletedProfile();

  if (viewer.user.role !== "admin") {
    redirect("/me");
  }

  return viewer;
}

export async function findOrCreateUserByPhone(phone: string) {
  const db = getDb();
  const existingUser = await db.query.users.findFirst({
    where: eq(users.phone, phone),
  });

  if (existingUser) {
    const [updated] = await db
      .update(users)
      .set({
        role: desiredRoleForPhone(phone),
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    // A user owns many pages — we just need to know whether at least one
    // is complete to skip the onboarding redirect after sign-in.
    const firstCompletedPage = await resolveCurrentPageForOwner(
      existingUser.id,
    );

    return {
      ...updated,
      profile: firstCompletedPage,
    };
  }

  const [created] = await db
    .insert(users)
    .values({
      phone,
      role: desiredRoleForPhone(phone),
      lastLoginAt: new Date(),
    })
    .returning();

  // Best-effort referral hooks. Sign-in MUST not fail if either of
  // these errors — the helpers swallow internally, but we double-wrap
  // here for defense in depth.
  try {
    const { getOrCreateReferralCodeForUser, attachReferralOnSignup } =
      await import("@/lib/referrals");
    const { readReferralCookie } = await import("@/lib/referral-cookie");
    await getOrCreateReferralCodeForUser(created.id);
    const cookieId = await readReferralCookie();
    if (cookieId) {
      await attachReferralOnSignup({
        cookieId,
        refereeUserId: created.id,
        refereePhone: phone,
      });
    }
  } catch (err) {
    log.warn("auth.referral_hook_failed", {
      userId: created.id,
      error: (err as Error).message,
    });
  }

  return {
    ...created,
    profile: null,
  };
}

export async function createSessionForUser(userId: string) {
  const db = getDb();
  const sessionToken = generateSessionToken();
  const headerStore = await headers();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash: getSessionHash(sessionToken),
    expiresAt,
    userAgent: headerStore.get("user-agent")?.slice(0, 512) ?? null,
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await setSessionCookie(sessionToken, expiresAt);

  return {
    expiresAt,
  };
}

export async function signOutCurrentUser() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    const db = getDb();

    await db
      .update(sessions)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(sessions.tokenHash, getSessionHash(sessionToken)));
  }

  await clearSessionCookie();
  await clearImpersonationReturnCookie();
}

// --- Impersonation -------------------------------------------------------
// Admin clicks "login as user" on /admin/users/[id]. We mint a fresh session
// for the target user and stash the admin's *current* session token in a
// separate httpOnly cookie so "exit impersonation" can swap the main session
// cookie back to the admin without any server-side state tracking.
async function setImpersonationReturnCookie(adminSessionToken: string) {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_RETURN_COOKIE_NAME, adminSessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Intentionally a session cookie (no expires) — ends when the browser is
    // closed, which matches the expected UX for "temporarily act as user".
    path: "/",
  });
}

async function clearImpersonationReturnCookie() {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_RETURN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

export async function startImpersonation(targetUserId: string) {
  const viewer = await getCurrentViewer();
  if (!viewer || viewer.user.role !== "admin") {
    throw new Error("Only admins can impersonate users.");
  }
  if (viewer.impersonator) {
    throw new Error("Already impersonating another user. Exit first.");
  }
  if (targetUserId === viewer.user.id) {
    throw new Error("Cannot impersonate yourself.");
  }

  const db = getDb();
  const target = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
  });
  if (!target) {
    throw new Error("User not found.");
  }
  if (target.role === "admin") {
    // Guard against one admin silently taking over another admin's account.
    throw new Error("Cannot impersonate another admin.");
  }
  if (target.bannedAt) {
    throw new Error("Cannot impersonate a banned user.");
  }

  const cookieStore = await cookies();
  const adminSessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!adminSessionToken) {
    throw new Error("Missing admin session.");
  }

  const headerStore = await headers();
  const impersonationToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({
    userId: target.id,
    tokenHash: getSessionHash(impersonationToken),
    expiresAt,
    userAgent:
      `[IMPERSONATED by ${viewer.user.id}] ` +
      (headerStore.get("user-agent")?.slice(0, 480) ?? ""),
    ipAddress:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await setImpersonationReturnCookie(adminSessionToken);
  await setSessionCookie(impersonationToken, expiresAt);
}

export async function endImpersonation() {
  const cookieStore = await cookies();
  const returnToken = cookieStore.get(IMPERSONATION_RETURN_COOKIE_NAME)?.value;
  const currentToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!returnToken) {
    // Nothing to restore; just clear any stale cookie.
    await clearImpersonationReturnCookie();
    return;
  }

  const db = getDb();

  // Revoke the impersonation session so the token can't be reused.
  if (currentToken && currentToken !== returnToken) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, getSessionHash(currentToken)));
  }

  // Look up the admin session to restore the correct expiry on the cookie.
  const adminSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, getSessionHash(returnToken)),
      gt(sessions.expiresAt, new Date()),
      isNull(sessions.revokedAt),
    ),
  });

  if (!adminSession) {
    // Admin session expired while impersonating — force a fresh sign-in.
    await clearSessionCookie();
    await clearImpersonationReturnCookie();
    return;
  }

  await setSessionCookie(returnToken, adminSession.expiresAt);
  await clearImpersonationReturnCookie();
}

export async function isImpersonating() {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(IMPERSONATION_RETURN_COOKIE_NAME)?.value);
}

/**
 * Pending event-registration handoff. An anonymous visitor taps "register"
 * on a public event page; we drop a `kioar_pending_event` cookie carrying the
 * page/event slugs plus the answers they already filled in, and send them to
 * /auth. After OTP success the caller invokes this helper.
 *
 * Unlike the page-creation intent, we complete the registration HERE,
 * server-side, with the now-authenticated viewer — calling the same idempotent
 * `registerForEvent` service the public page uses (it owns capacity / approval
 * / payment / waitlist and its own cache invalidation). Then we land the user
 * back on the event page already in the registered state. This is what keeps an
 * attendee out of the /start onboarding wizard: they came to RSVP, so we finish
 * the RSVP and never detour them into page creation.
 *
 * If there is no pending registration, returns without doing anything so the
 * caller can fall through to the next intent / its own redirect.
 */
export async function continuePendingEventRegistrationOrRedirect(
  userId: string,
) {
  const db = getDb();
  const pending = await getPendingEventRegistration();

  if (!pending) {
    return;
  }

  const event = await db.query.events.findFirst({
    where: and(
      eq(events.slug, pending.eventSlug),
      eq(events.status, "published"),
    ),
    with: {
      page: { columns: { slug: true } },
      ticketTypes: {
        columns: { id: true },
        orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.createdAt)],
      },
    },
  });

  await clearPendingEventRegistration();

  if (!event || !event.page) {
    redirect("/me");
  }

  // Resolve the chosen tier. Prefer the one the visitor picked pre-auth; fall
  // back to the event's first (default) tier so a dropped/legacy cookie still
  // completes rather than dead-ending.
  const chosenTierId =
    (pending.ticketTypeId &&
      event.ticketTypes.find((t) => t.id === pending.ticketTypeId)?.id) ||
    event.ticketTypes[0]?.id;

  // Complete the registration as the now-authenticated user, replaying the
  // answers + discount they entered before auth. Idempotent: if they somehow
  // already have a registration it returns the existing status. We deliberately
  // ignore a failure result (e.g. capacity filled during the auth round-trip)
  // and still land them on the event page, which renders the live state /
  // re-shows the form rather than a dead end.
  if (chosenTierId) {
    await registerForEvent(
      event.id,
      userId,
      {
        ticketTypeId: chosenTierId,
        answers: pending.answers,
        discountCode: pending.discountCode,
      },
      event.page.slug,
    );
  }

  // Canonical event URL is rebuilt in the events feature increments; cast
  // until the typed route exists.
  redirect(
    `/${event.page.slug}/e/${event.slug}` as unknown as Parameters<
      typeof redirect
    >[0],
  );
}

/**
 * Pending Connect-on-auth handoff. Anonymous visitor taps Connect on
 * `/slug`, we drop a `kioar_pending_connect=slug` cookie and redirect to
 * `/auth`. After the user completes OTP, the caller invokes this helper.
 *
 * If there is no pending slug, returns without doing anything so the
 * caller can fall through to whatever pending-intent comes next
 * (currently event registration → /me).
 *
 * If the pending slug resolves to a real published page that isn't owned
 * by the just-authed user, we create the mutual connection (race-safe
 * via the canonical-pair unique index) and redirect them back to that
 * page so they land in the connected state.
 *
 * Edge cases handled in-line:
 *  - page deleted between cookie-set and auth → clear cookie, return
 *  - admin-disabled page → clear cookie, return
 *  - user is the page owner → clear cookie, redirect to the page anyway
 *    (they don't connect to themselves; the public-page render hides
 *    the button)
 *  - user has no completed page yet (mid-onboarding) → leave the cookie
 *    in place so the connection happens on next sign-in after they
 *    finish onboarding; return so `/start` handles the redirect
 */
export async function continuePendingConnectOrNext(userId: string) {
  const pendingSlug = await getPendingConnect();
  if (!pendingSlug) return;

  const db = getDb();
  const target = await db.query.profiles.findFirst({
    where: eq(profiles.slug, pendingSlug),
  });

  if (!target || target.adminDisabledAt) {
    await clearPendingConnect();
    return;
  }

  if (target.userId === userId) {
    await clearPendingConnect();
    redirect(`/${pendingSlug}`);
  }

  const viewerPage = await resolveCurrentPageForOwner(userId);
  if (!viewerPage) {
    // Still in onboarding. Leave the cookie so the connection completes
    // once they have a page.
    return;
  }

  await createConnection({
    viewerPageId: viewerPage.id,
    targetPageId: target.id,
  });
  await clearPendingConnect();
  redirect(`/${pendingSlug}`);
}
