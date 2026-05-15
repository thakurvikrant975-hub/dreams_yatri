import { NextRequest, NextResponse } from "next/server";

const TOKEN = process.env.MAPBOX_TOKEN;

// Mapbox place_type → our LocationType
const TYPE_MAP: Record<string, string> = {
  country:      "COUNTRY",
  region:       "STATE",
  district:     "DISTRICT",
  place:        "CITY",
  locality:     "AREA",
  neighborhood: "NEIGHBORHOOD",
  address:      "AREA",
  poi:          "LANDMARK",
};

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim();

  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  if (!TOKEN) {
    return NextResponse.json(
      { results: [], configured: false },
      { status: 503 }
    );
  }

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
    );
    url.searchParams.set("access_token", TOKEN);
    url.searchParams.set("limit", "6");
    url.searchParams.set("language", "en");

    const res = await fetch(url.toString(), {
      next: { revalidate: 60 }, // cache for 1 minute
    });

    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();

    const results = (data.features ?? []).map((f: {
      id: string;
      text: string;
      place_name: string;
      place_type: string[];
      center: [number, number];
      context?: { id: string; text: string }[];
    }) => {
      const ctx: Record<string, string> = {};
      (f.context ?? []).forEach((c) => {
        const key = c.id.split(".")[0];
        ctx[key] = c.text;
      });
      return {
        source:      "external",
        mapbox_id:   f.id,
        name:        f.text,
        full_name:   f.place_name,
        place_type:  TYPE_MAP[f.place_type?.[0]] ?? "AREA",
        coordinates: f.center, // [lng, lat]
        country:     ctx.country,
        region:      ctx.region,
        place:       ctx.place,
      };
    });

    return NextResponse.json({ results, configured: true });
  } catch (e) {
    console.error("[locations/external]", e);
    return NextResponse.json({ results: [] });
  }
}
