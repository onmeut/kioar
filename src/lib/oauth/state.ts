// CSRF state for OAuth start → callback. We HMAC the state bound to the
// user's session so a stolen state can't be replayed against a different
// account. State is also short-lived (10 minutes) to limit replay windows.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getRequiredEnv } from "@/lib/env";

const TTL_MS = 10 * 60 * 1000;

type StatePayload = {
  userId: string;
  provider: string;
  nonce: string;
  ts: number;
  // Where to redirect after a successful callback (relative path only).
  returnTo?: string;
};

function sign(payload: string): string {
  return createHmac("sha256", getRequiredEnv("AUTH_SECRET"))
    .update(payload)
    .digest("hex");
}

export function createOAuthState(input: {
  userId: string;
  provider: string;
  returnTo?: string;
}): string {
  const payload: StatePayload = {
    userId: input.userId,
    provider: input.provider,
    nonce: randomBytes(12).toString("hex"),
    ts: Date.now(),
    returnTo: input.returnTo,
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

export function verifyOAuthState(
  raw: string | null | undefined,
): StatePayload | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const b64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(b64);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8"),
    ) as StatePayload;
    if (Date.now() - payload.ts > TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
