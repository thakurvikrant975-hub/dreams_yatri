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

// Our LocationType → Mapbox place type(s) for API-level filtering
const OUR_TYPE_TO_MAPBOX: Record<string, string[]> = {
  COUNTRY:      ["country"],
  STATE:        ["region"],
  DISTRICT:     ["district"],
  CITY:         ["place"],
  AREA:         ["locality", "neighborhood"],
  NEIGHBORHOOD: ["neighborhood"],
  LANDMARK:     ["poi"],
  AIRPORT:      ["poi"],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q          = searchParams.get("q")?.trim();
  const typesParam = searchParams.get("types");
  const ourTypes   = typesParam ? typesParam.split(",").filter(Boolean) : [];

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

    // Map our types to Mapbox types and restrict the API call
    if (ourTypes.length > 0) {
      const mapboxTypes = [...new Set(ourTypes.flatMap((t) => OUR_TYPE_TO_MAPBOX[t] ?? []))];
      if (mapboxTypes.length > 0) url.searchParams.set("types", mapboxTypes.join(","));
    }

    const res = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });

    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();

    const allResults = (data.features ?? []).map((f: {
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
        coordinates: f.center,
        country:     ctx.country,
        region:      ctx.region,
        place:       ctx.place,
      };
    });

    // Secondary filter: if caller specified types, drop anything that doesn't match
    const results = ourTypes.length > 0
      ? allResults.filter((r: { place_type: string }) => ourTypes.includes(r.place_type))
      : allResults;

    return NextResponse.json({ results, configured: true });
  } catch (e) {
    console.error("[locations/external]", e);
    return NextResponse.json({ results: [] });
  }
}
