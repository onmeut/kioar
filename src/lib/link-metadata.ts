import "server-only";

import { safeFetch } from "@/lib/ssrf";

export type LinkMetadata = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, num) =>
      String.fromCharCode(parseInt(num, 16)),
    )
    .replace(
      /&([a-z]+);/gi,
      (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match,
    );
}

function firstMatch(html: string, re: RegExp): string | null {
  const match = re.exec(html);
  return match?.[1] ? decodeHtml(match[1]).trim() : null;
}

function metaByAttr(
  html: string,
  attr: "property" | "name",
  key: string,
): string | null {
  const escaped = key.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  return (
    firstMatch(
      html,
      new RegExp(
        `<meta[^>]+${attr}=["']${escaped}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
    ) ??
    firstMatch(
      html,
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]*${attr}=["']${escaped}["']`,
        "i",
      ),
    )
  );
}

function absolutize(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function ensureHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    // Deeper SSRF defense (DNS resolve + private-range check) is applied
    // inside `safeFetch`. Keeping this function just for URL shape parsing.
    return parsed;
  } catch {
    return null;
  }
}

export async function fetchLinkMetadata(
  raw: string,
): Promise<LinkMetadata | null> {
  const parsed = ensureHttpUrl(raw);
  if (!parsed) return null;
  const url = parsed.toString();

  const fetched = await safeFetch(url, {
    accept: "text/html,application/xhtml+xml",
    headers: {
      "Accept-Language": "en,fa;q=0.8",
    },
    maxBytes: 256 * 1024,
    timeoutMs: 8000,
  });

  if (!fetched.ok) {
    return {
      url,
      title: null,
      description: null,
      image: null,
      siteName: parsed.hostname.replace(/^www\./i, ""),
    };
  }

  // Only parse HTML responses. If the server returned something else (e.g. a
  // PDF for a link that happened to 200 OK at the redirect target), we bail.
  if (
    !fetched.contentType.startsWith("text/html") &&
    fetched.contentType !== "application/xhtml+xml"
  ) {
    return {
      url,
      title: null,
      description: null,
      image: null,
      siteName: parsed.hostname.replace(/^www\./i, ""),
    };
  }

  const html = new TextDecoder("utf-8", { fatal: false }).decode(fetched.body);
  const baseUrl = fetched.finalUrl;

  const title =
    metaByAttr(html, "property", "og:title") ??
    metaByAttr(html, "name", "twitter:title") ??
    firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);

  const description =
    metaByAttr(html, "property", "og:description") ??
    metaByAttr(html, "name", "twitter:description") ??
    metaByAttr(html, "name", "description");

  const rawImage =
    metaByAttr(html, "property", "og:image:secure_url") ??
    metaByAttr(html, "property", "og:image:url") ??
    metaByAttr(html, "property", "og:image") ??
    metaByAttr(html, "name", "twitter:image");

  const faviconHref =
    firstMatch(
      html,
      /<link[^>]+rel=["'](?:apple-touch-icon(?:-precomposed)?)["'][^>]*href=["']([^"']+)["']/i,
    ) ??
    firstMatch(
      html,
      /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:apple-touch-icon(?:-precomposed)?)["']/i,
    ) ??
    firstMatch(
      html,
      /<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i,
    ) ??
    firstMatch(
      html,
      /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon)["']/i,
    );

  const image =
    absolutize(rawImage, baseUrl) ??
    absolutize(faviconHref, baseUrl) ??
    absolutize("/favicon.ico", baseUrl);

  const siteName =
    metaByAttr(html, "property", "og:site_name") ??
    parsed.hostname.replace(/^www\./i, "");

  return {
    url,
    title: title ? title.slice(0, 40) : null,
    description: description ? description.slice(0, 160) : null,
    image,
    siteName,
  };
}
