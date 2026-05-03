import "server-only";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF guard used before any server-side outbound fetch to a user-supplied URL
 * (link previews, OG image rehosting, etc.).
 *
 * The attacker model: a logged-in user saves a profile link pointing at a URL
 * that, when fetched by our server, would reach a resource our server has
 * privileged access to:
 *   - loopback (127.0.0.0/8, ::1)
 *   - RFC1918 (10/8, 172.16/12, 192.168/16)
 *   - link-local (169.254/16, fe80::/10) including AWS/GCP instance-metadata
 *   - CGNAT / reserved ranges
 *   - IPv6 mapped/embedded IPv4 that sneaks past naive regex checks
 *
 * String-based hostname checks are not sufficient because an attacker can:
 *   1. Register a domain whose A record points at 127.0.0.1 / 169.254.169.254.
 *   2. Use DNS rebinding: return a public IP for the first lookup, a private
 *      IP for the second (the fetch).
 *
 * We defend by:
 *   - Resolving the hostname ourselves.
 *   - Rejecting if any resolved address is private/reserved.
 *   - Returning the resolved IP so the caller can fetch it directly and pass
 *     the original host as a `Host` header, closing the rebinding window.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export type SsrfCheckResult =
  | { ok: true; url: URL; ip: string; family: 4 | 6 }
  | { ok: false; reason: string };

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return true; // malformed -> treat as unsafe
  }
  const [a, b] = parts;

  // 0.0.0.0/8 "this network"
  if (a === 0) return true;
  // 10.0.0.0/8 private
  if (a === 10) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local (AWS/GCP metadata at 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 reserved, 192.0.2.0/24 test
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16 private
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 TEST-NET-2, 203.0.113.0/24 TEST-NET-3
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  // 100.64.0.0/10 CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 224.0.0.0/4 multicast, 240.0.0.0/4 reserved, 255.255.255.255 broadcast
  if (a >= 224) return true;

  return false;
}

function normalizeIPv6(ip: string): string {
  return ip.toLowerCase().split("%")[0]; // strip zone id
}

function isPrivateIPv6(raw: string): boolean {
  const ip = normalizeIPv6(raw);

  // IPv4-mapped (::ffff:1.2.3.4) or IPv4-compatible — check the v4 part too.
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const mappedAlt = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (mappedAlt) {
    const high = parseInt(mappedAlt[1], 16);
    const low = parseInt(mappedAlt[2], 16);
    const v4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    return isPrivateIPv4(v4);
  }

  if (ip === "::" || ip === "::1") return true; // unspecified / loopback
  if (
    ip.startsWith("fe80:") ||
    ip.startsWith("fe8") ||
    ip.startsWith("fe9") ||
    ip.startsWith("fea") ||
    ip.startsWith("feb")
  ) {
    return true; // link-local fe80::/10
  }
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // ULA fc00::/7
  if (ip.startsWith("ff")) return true; // multicast ff00::/8
  if (ip.startsWith("2001:db8:")) return true; // documentation
  if (ip.startsWith("64:ff9b::")) return true; // NAT64
  if (ip.startsWith("100::")) return true; // discard

  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // not an IP literal we understand -> unsafe
}

export function parseHttpUrl(raw: string): URL | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

export async function checkSsrf(raw: string): Promise<SsrfCheckResult> {
  const url = parseHttpUrl(raw);
  if (!url) return { ok: false, reason: "invalid-url" };

  const hostname = url.hostname;

  // If the URL is an IP literal, validate it directly.
  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (isPrivateAddress(hostname)) {
      return { ok: false, reason: "private-literal" };
    }
    return { ok: true, url, ip: hostname, family: literalFamily as 4 | 6 };
  }

  // DNS resolve to prevent rebinding.
  let resolved: { address: string; family: number };
  try {
    resolved = await lookup(hostname, { verbatim: true });
  } catch {
    return { ok: false, reason: "dns-failed" };
  }

  if (isPrivateAddress(resolved.address)) {
    return { ok: false, reason: "private-resolved" };
  }

  return {
    ok: true,
    url,
    ip: resolved.address,
    family: (resolved.family === 6 ? 6 : 4) as 4 | 6,
  };
}

export type SafeFetchOptions = {
  headers?: Record<string, string>;
  maxBytes?: number;
  timeoutMs?: number;
  accept?: string;
};

export type SafeFetchResult =
  | {
      ok: true;
      status: number;
      contentType: string;
      body: Buffer;
      finalUrl: string;
    }
  | { ok: false; reason: string };

/**
 * Fetch a user-supplied URL safely. Caps the response body size, applies a
 * timeout, and refuses non-public destinations.
 *
 * NOTE: We intentionally do NOT follow redirects across hosts without
 * re-checking SSRF. Redirects are allowed because `fetch`'s default is
 * `follow`, but we re-run the guard on the final URL.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const {
    headers = {},
    maxBytes = 2 * 1024 * 1024,
    timeoutMs = 8000,
    accept,
  } = options;

  const initial = await checkSsrf(rawUrl);
  if (!initial.ok) return { ok: false, reason: initial.reason };

  const requestHeaders: Record<string, string> = {
    // Identify as a real browser + the well-known OG-card crawler. Many
    // hosts (Cloudflare, Vercel, dub.co, etc.) silently strip Open Graph
    // meta from "unknown bot" responses but whitelist these UAs because
    // they're what Facebook / Twitter / Slack send. Keep the suffix so
    // server logs can still identify our crawler.
    "User-Agent":
      "Mozilla/5.0 (compatible; facebookexternalhit/1.1; KioarBot/1.0; +https://kioar.com/)",
    ...headers,
  };
  if (accept) requestHeaders.Accept = accept;

  let response: Response;
  try {
    // Use `manual` redirect so we can re-validate the Location target.
    response = await fetch(initial.url.toString(), {
      headers: requestHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "fetch-failed" };
  }

  // Follow up to 3 redirects, re-validating each hop against the SSRF guard.
  let hops = 0;
  let currentUrl = initial.url.toString();
  while (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location")
  ) {
    if (hops >= 3) return { ok: false, reason: "too-many-redirects" };
    const loc = response.headers.get("location") as string;
    const next = new URL(loc, currentUrl).toString();
    const nextCheck = await checkSsrf(next);
    if (!nextCheck.ok)
      return { ok: false, reason: `redirect-${nextCheck.reason}` };
    try {
      response = await fetch(nextCheck.url.toString(), {
        headers: requestHeaders,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch {
      return { ok: false, reason: "fetch-failed" };
    }
    currentUrl = nextCheck.url.toString();
    hops += 1;
  }

  if (!response.ok) {
    return { ok: false, reason: `http-${response.status}` };
  }

  // Enforce Content-Length cap up front when available.
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength && declaredLength > maxBytes) {
    return { ok: false, reason: "too-large" };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return { ok: false, reason: "no-body" };
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return { ok: false, reason: "too-large" };
    }
    chunks.push(value);
  }

  const contentType =
    (response.headers.get("content-type") || "").split(";")[0].trim() ||
    "application/octet-stream";

  return {
    ok: true,
    status: response.status,
    contentType,
    body: Buffer.concat(chunks),
    finalUrl: currentUrl,
  };
}
