// Zoom OAuth + meeting creation. We only use the User-managed OAuth flow
// so each Kioar user connects their own Zoom account; meetings are created
// on their behalf when a booking is confirmed.

import { getOAuthAccount, updateAccessToken } from "./store";

const SCOPES = ["meeting:write:meeting", "user:read:user"];

export function isZoomOAuthConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_OAUTH_CLIENT_ID && process.env.ZOOM_OAUTH_CLIENT_SECRET,
  );
}

function getRedirectUri(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/api/oauth/zoom/callback`;
}

export function buildZoomAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ZOOM_OAUTH_CLIENT_ID!,
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(" "),
    state,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
  scope: string;
};

function basicAuth(): string {
  return Buffer.from(
    `${process.env.ZOOM_OAUTH_CLIENT_ID}:${process.env.ZOOM_OAUTH_CLIENT_SECRET}`,
  ).toString("base64");
}

export async function exchangeZoomCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Zoom token exchange failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as TokenResponse;
}

async function refreshZoomToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Zoom refresh failed: ${res.status}`);
  }
  return (await res.json()) as TokenResponse;
}

export type ZoomUserInfo = {
  id: string; // Zoom uid (stable)
  email: string;
  display_name?: string;
};

export async function fetchZoomUserInfo(
  accessToken: string,
): Promise<ZoomUserInfo> {
  const res = await fetch("https://api.zoom.us/v2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Zoom user info failed: ${res.status}`);
  }
  return (await res.json()) as ZoomUserInfo;
}

async function getValidAccessToken(userId: string): Promise<string> {
  const account = await getOAuthAccount(userId, "zoom");
  if (!account) throw new Error("کاربر هنوز Zoom را متصل نکرده است.");
  const now = Date.now();
  const stillValid =
    account.expiresAt && account.expiresAt.getTime() - 60_000 > now;
  if (stillValid) return account.accessToken;
  if (!account.refreshToken) {
    throw new Error("نشست Zoom منقضی شده — لطفاً دوباره متصل شوید.");
  }
  const refreshed = await refreshZoomToken(account.refreshToken);
  await updateAccessToken(userId, "zoom", {
    accessToken: refreshed.access_token,
    expiresAt: new Date(now + refreshed.expires_in * 1000),
    // Zoom rotates the refresh_token on every refresh.
    refreshToken: refreshed.refresh_token,
  });
  return refreshed.access_token;
}

export type ZoomMeetingInput = {
  topic: string;
  startIso: string; // ISO 8601 UTC or with offset
  durationMin: number;
  timezone: string;
  agenda?: string;
};

export type ZoomMeetingResult = {
  id: string; // string because Zoom IDs >2^53
  joinUrl: string;
  startUrl: string;
  password?: string;
};

export async function createZoomMeeting(
  userId: string,
  input: ZoomMeetingInput,
): Promise<ZoomMeetingResult> {
  const accessToken = await getValidAccessToken(userId);
  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2, // scheduled
      start_time: input.startIso,
      duration: input.durationMin,
      timezone: input.timezone,
      agenda: input.agenda,
      settings: {
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: true,
        approval_type: 2, // no registration
      },
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Zoom create meeting failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as {
    id: number | string;
    join_url: string;
    start_url: string;
    password?: string;
  };
  return {
    id: String(json.id),
    joinUrl: json.join_url,
    startUrl: json.start_url,
    password: json.password,
  };
}

export async function deleteZoomMeeting(userId: string, meetingId: string) {
  const accessToken = await getValidAccessToken(userId);
  const res = await fetch(
    `https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Zoom delete failed: ${res.status}`);
  }
}
