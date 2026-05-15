import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.MAPBOX_TOKEN;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  if (!TOKEN) {
    return NextResponse.json({ error: "Geocoding not configured" }, { status: 503 });
  }

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`
    );
    url.searchParams.set("access_token", TOKEN);
    url.searchParams.set("language", "en");
    url.searchParams.set("types", "country,region,place,district,locality");

    const res = await fetch(url.toString());
    if (!res.ok) return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });

    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return NextResponse.json({});

    const ctx: Record<string, string> = {};
    (feature.context ?? []).forEach((c: { id: string; text: string }) => {
      const key = c.id.split(".")[0];
      ctx[key] = c.text;
    });

    return NextResponse.json({
      name:      feature.text ?? "",
      full_name: feature.place_name ?? "",
      country:   ctx.country  ?? "",
      region:    ctx.region   ?? "",
      place:     ctx.place    ?? feature.text ?? "",
      coordinates: feature.center as [number, number],
    });
  } catch (e) {
    console.error("[locations/reverse-geocode]", e);
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });
  }
}
