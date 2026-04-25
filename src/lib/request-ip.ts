import "server-only";

import { headers } from "next/headers";

import { log } from "@/lib/log";

/**
 * Extract the client IP from the current request. Prefers the left-most
 * address in `X-Forwarded-For` (the real client) but only after validating
 * that the header looks IP-shaped. Falls back to `X-Real-IP`, then to a
 * placeholder.
 *
 * IMPORTANT: This only returns a trustworthy value when the app sits behind
 * a reverse proxy/CDN that strips client-supplied forwarding headers. If the
 * app is deployed directly, the header can be spoofed — in that case, set
 * TRUST_PROXY=false to force the placeholder and rely on per-identity rate
 * limits (e.g. per phone) instead of per-IP.
 */
export async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  const trustProxy = process.env.TRUST_PROXY !== "false";

  if (!trustProxy) return "unknown";

  const xff = hdrs.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && isIpLike(first)) return first;
  }
  const xRealIp = hdrs.get("x-real-ip")?.trim();
  if (xRealIp && isIpLike(xRealIp)) return xRealIp;

  const cfIp = hdrs.get("cf-connecting-ip")?.trim();
  if (cfIp && isIpLike(cfIp)) return cfIp;

  return "unknown";
}

function isIpLike(value: string): boolean {
  // Very loose shape check. Real validation happens at the proxy; we only
  // want to reject obvious junk / header injection attempts.
  if (value.length > 64) return false;
  if (!/^[0-9a-fA-F:.]+$/.test(value)) return false;
  return true;
}

export function ipRateKey(prefix: string, ip: string): string {
  // Keep the key small and opaque. No need to hash — an IP in the key is
  // fine for a short-lived bucket row.
  return `${prefix}:ip:${ip}`;
}

export function phoneRateKey(prefix: string, phone: string): string {
  return `${prefix}:phone:${phone}`;
}

// Logged out of convenience so any caller can use it for observability.
export { log };
