/**
 * Parse and normalize pasted video URLs (YouTube / Aparat) into a safe embed
 * URL for an <iframe>. Shared by the media block validator (accept/reject a
 * pasted link) and the public renderer (build the embed src).
 *
 * Only YouTube and Aparat are supported — the two platforms Iranian creators
 * use. An unrecognized host returns null so the caller can reject it.
 */

export type VideoEmbed = {
  provider: "youtube" | "aparat";
  /** Opaque video id (YouTube 11-char id, or Aparat hash). */
  id: string;
  /** Ready-to-use iframe src. */
  embedUrl: string;
};

function parseUrl(raw: string): URL | null {
  try {
    const trimmed = raw.trim();
    // Tolerate a missing scheme on a pasted "www.youtube.com/..." etc.
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/** YouTube ids are exactly 11 chars of [A-Za-z0-9_-]. */
function isYoutubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** Aparat hashes are alphanumeric (length varies); guard against junk. */
function isAparatId(id: string): boolean {
  return /^[A-Za-z0-9]{4,20}$/.test(id);
}

/**
 * Parse a pasted YouTube or Aparat URL into a `VideoEmbed`, or null if the URL
 * isn't a recognized, well-formed video link.
 */
export function parseVideoEmbed(raw: string): VideoEmbed | null {
  const url = parseUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  // ---- YouTube --------------------------------------------------------
  if (host === "youtube.com" || host === "m.youtube.com") {
    // /watch?v=ID , /shorts/ID , /embed/ID , /live/ID
    let id = url.searchParams.get("v") ?? "";
    if (!id) {
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      if (m) id = m[1];
    }
    if (isYoutubeId(id)) {
      return {
        provider: "youtube",
        id,
        embedUrl: `https://www.youtube.com/embed/${id}`,
      };
    }
    return null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split(/[/?#]/)[0];
    if (isYoutubeId(id)) {
      return {
        provider: "youtube",
        id,
        embedUrl: `https://www.youtube.com/embed/${id}`,
      };
    }
    return null;
  }

  // ---- Aparat ---------------------------------------------------------
  if (host === "aparat.com") {
    // /v/HASH , /v/HASH/ , /embed/HASH
    const m = url.pathname.match(/^\/(?:v|embed)\/([^/?#]+)/);
    const id = m?.[1] ?? "";
    if (isAparatId(id)) {
      return {
        provider: "aparat",
        id,
        embedUrl: `https://www.aparat.com/video/video/embed/videohash/${id}/vt/frame`,
      };
    }
    return null;
  }

  return null;
}

/** Convenience boolean for validation. */
export function isSupportedVideoUrl(raw: string): boolean {
  return parseVideoEmbed(raw) !== null;
}
