// Looks up a place by id and returns the formatted address + lat/lng.

import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 501 });
  }
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.trim();
  if (!placeId) {
    return NextResponse.json({ error: "missing_place_id" }, { status: 400 });
  }
  const lang = searchParams.get("lang") ?? "fa";

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(lang)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location",
      },
    },
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: "details_failed", status: res.status },
      { status: 502 },
    );
  }
  const json = (await res.json()) as {
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  };
  return NextResponse.json({
    placeId: json.id,
    name: json.displayName?.text ?? null,
    address: json.formattedAddress ?? null,
    lat: json.location?.latitude ?? null,
    lng: json.location?.longitude ?? null,
  });
}
