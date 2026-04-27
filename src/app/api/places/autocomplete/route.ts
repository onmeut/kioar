// Server-proxied Google Places "Autocomplete" + "Details" so the browser
// never sees the API key. We use the new Places API (v1) which is the
// recommended replacement for the legacy `/place/autocomplete/json`.

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser(); // gate behind auth so we don't leak the key budget
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ predictions: [] });
  const sessionToken = searchParams.get("session") ?? undefined;
  const lang = searchParams.get("lang") ?? "fa";

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: q,
        languageCode: lang,
        sessionToken,
      }),
    },
  );
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const errJson = (await res.json()) as {
        error?: { message?: string; status?: string };
      };
      detail = errJson.error?.message;
      console.error("[places.autocomplete]", res.status, errJson);
    } catch {
      console.error("[places.autocomplete]", res.status);
    }
    return NextResponse.json(
      { error: "places_failed", status: res.status, message: detail },
      { status: 502 },
    );
  }
  const json = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }>;
  };
  const predictions = (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      label: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      sublabel: p.structuredFormat?.secondaryText?.text ?? "",
    }));
  return NextResponse.json({ predictions });
}
