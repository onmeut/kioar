import { notFound } from "next/navigation";

import { getPublicProfileBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

// vCard 3.0 property-value escaping per RFC 6350 §3.4.
// Without this, a user with a name like `Foo\nTEL:+15550000\nEND:VCARD` can
// inject arbitrary vCard fields into files downloaded by other users.
function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// vCard lines must be CRLF-terminated and folded at 75 octets.
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

// Only http(s) URLs are safe for the URL property; everything else is
// either a user-supplied javascript:/data: payload or something vCard
// consumers will reject.
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    /* ignore */
  }
  return null;
}

// vCard filenames are mostly advisory, but the slug is user-controlled so we
// still strip anything outside the reserved whitelist before interpolating it
// into the Content-Disposition header.
function safeFilenameFromSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/gi, "").slice(0, 64) || "card";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const profile = await getPublicProfileBySlug(slug);

  if (!profile) {
    notFound();
  }

  const esc = escapeVCardValue;
  const firstUrl = safeHttpUrl(profile.links[0]?.url);

  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(profile.fullName ?? "")}`,
    `TITLE:${esc(profile.title ?? "")}`,
  ];

  if (profile.publicPhone) {
    // Phone numbers in DB are already normalized to E.164; still escape.
    lines.push(`TEL;TYPE=CELL:${esc(profile.publicPhone)}`);
  }
  if (profile.email) {
    lines.push(`EMAIL:${esc(profile.email)}`);
  }
  if (profile.bio) {
    lines.push(`NOTE:${esc(profile.bio)}`);
  }
  if (firstUrl) {
    lines.push(`URL:${esc(firstUrl)}`);
  }

  lines.push("END:VCARD");

  const body = lines.map(foldLine).join("\r\n") + "\r\n";
  const filename = safeFilenameFromSlug(slug);

  return new Response(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.vcf"`,
    },
  });
}
