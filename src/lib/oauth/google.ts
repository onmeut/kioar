// Google OAuth + Calendar/Meet helpers. We deliberately avoid the
// `googleapis` SDK (it ships ~30 MB) and call the REST endpoints directly.
//
// Required env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
// NEXT_PUBLIC_APP_URL. Without them, `isGoogleOAuthConfigured()` returns
// false and all helpers throw a descriptive error.

import { getOAuthAccount, updateAccessToken } from "./store";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
];

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

function getRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/api/oauth/google/callback`;
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // force refresh_token on every connect
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export async function exchangeGoogleCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Google token exchange failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as TokenResponse;
}

export async function refreshGoogleToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export type GoogleUserInfo = {
  sub: string; // stable Google account id
  email: string;
  name?: string;
};

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }
  return (await res.json()) as GoogleUserInfo;
}

/**
 * Returns a valid (non-expired) access token for the user, refreshing it
 * via the stored refresh token when necessary. Throws if the user has not
 * connected Google or if the refresh token is missing/revoked.
 */
async function getValidAccessToken(userId: string): Promise<string> {
  const account = await getOAuthAccount(userId, "google");
  if (!account) {
    throw new Error("کاربر هنوز Google را متصل نکرده است.");
  }
  const now = Date.now();
  // Refresh ~60s early to absorb clock skew.
  const stillValid =
    account.expiresAt && account.expiresAt.getTime() - 60_000 > now;
  if (stillValid) return account.accessToken;
  if (!account.refreshToken) {
    throw new Error(
      "نشست Google منقضی شده و refresh_token موجود نیست. لطفاً دوباره متصل شوید.",
    );
  }
  const refreshed = await refreshGoogleToken(account.refreshToken);
  const newExpiresAt = new Date(now + refreshed.expires_in * 1000);
  await updateAccessToken(userId, "google", {
    accessToken: refreshed.access_token,
    expiresAt: newExpiresAt,
    refreshToken: refreshed.refresh_token ?? null,
  });
  return refreshed.access_token;
}

// ─────────────────────────────────────────────────────────────────────
// Calendar Events  (used to also auto-create a Meet link in one shot)
// ─────────────────────────────────────────────────────────────────────

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timezone: string; // IANA
  attendees: Array<{ email: string; displayName?: string }>;
  /** When true, attaches a `conferenceData` block so Calendar mints a Meet URL. */
  createMeet?: boolean;
  location?: string;
};

export type CalendarEventResult = {
  id: string;
  htmlLink: string;
  meetUrl: string | null;
};

export async function createCalendarEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  const accessToken = await getValidAccessToken(userId);

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: input.timezone },
    end: { dateTime: input.endIso, timeZone: input.timezone },
    attendees: input.attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
    })),
    location: input.location,
    reminders: { useDefault: true },
  };
  if (input.createMeet) {
    body.conferenceData = {
      createRequest: {
        // Stable per-event id so retries don't create duplicate Meets.
        requestId: `kioar-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
    (input.createMeet
      ? "?conferenceDataVersion=1&sendUpdates=all"
      : "?sendUpdates=all");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Calendar event create failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    id: string;
    htmlLink: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
  };

  let meetUrl: string | null = json.hangoutLink ?? null;
  if (!meetUrl && json.conferenceData?.entryPoints?.length) {
    const video = json.conferenceData.entryPoints.find(
      (e) => e.entryPointType === "video",
    );
    meetUrl = video?.uri ?? null;
  }
  return { id: json.id, htmlLink: json.htmlLink, meetUrl };
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  const accessToken = await getValidAccessToken(userId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  // 410 = already gone, treat as success.
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    throw new Error(`Calendar event delete failed: ${res.status}`);
  }
}
