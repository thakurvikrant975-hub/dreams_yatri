import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LocationType } from "@/app/generated/prisma";
import { z } from "zod";

const schema = z.object({
  mapbox_id:   z.string(),
  name:        z.string().min(1),
  full_name:   z.string(),
  place_type:  z.string(),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  country:     z.string().optional(),
  region:      z.string().optional(),
  place:       z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { mapbox_id, name, full_name, place_type, coordinates, country, region } =
      parsed.data;
    const [lng, lat] = coordinates;

    // ── 1. Exact match by mapbox_id ──────────────────────────────────────────
    const byId = await db.location.findFirst({
      where: { mapbox_id },
      select: { id: true, name: true, type: true, slug: true, latitude: true, longitude: true },
    });
    if (byId) {
      const parts = [byId.name];
      return NextResponse.json({
        id:       byId.id.toString(),
        name:     byId.name,
        slug:     byId.slug,
        type:     byId.type,
        breadcrumb: parts.join(", "),
        latitude:  byId.latitude  != null ? Number(byId.latitude)  : null,
        longitude: byId.longitude != null ? Number(byId.longitude) : null,
        existed:  true,
      });
    }

    // ── 2. Proximity + name duplicate check (~1 km at equator) ───────────────
    const DELTA = 0.01;
    const nearby = await db.location.findFirst({
      where: {
        name:      { equals: name, mode: "insensitive" },
        latitude:  { gte: lat - DELTA, lte: lat + DELTA },
        longitude: { gte: lng - DELTA, lte: lng + DELTA },
      },
      select: { id: true, name: true, type: true, slug: true, latitude: true, longitude: true },
    });
    if (nearby) {
      return NextResponse.json({
        id:        nearby.id.toString(),
        name:      nearby.name,
        slug:      nearby.slug,
        type:      nearby.type,
        breadcrumb: [nearby.name].join(", "),
        latitude:  nearby.latitude  != null ? Number(nearby.latitude)  : null,
        longitude: nearby.longitude != null ? Number(nearby.longitude) : null,
        existed:   true,
      });
    }

    // ── 3. Resolve parent IDs from local DB ──────────────────────────────────
    let countryId: bigint | null = null;
    let stateId:   bigint | null = null;
    let parentId:  bigint | null = null;

    if (country) {
      const dbCountry = await db.location.findFirst({
        where: { type: "COUNTRY", name: { equals: country, mode: "insensitive" } },
        select: { id: true },
      });
      if (dbCountry) { countryId = dbCountry.id; parentId = dbCountry.id; }
    }

    if (region && countryId) {
      const dbState = await db.location.findFirst({
        where: {
          type:       "STATE",
          country_id: countryId,
          name:       { equals: region, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (dbState) { stateId = dbState.id; parentId = dbState.id; }
    }

    // ── 4. Build unique slug ─────────────────────────────────────────────────
    const base = slugify(name);
    const conflicting = await db.location.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const taken = new Set(conflicting.map((c) => c.slug));
    let slug = base;
    let n = 2;
    while (taken.has(slug)) { slug = `${base}-${n++}`; }

    // ── 5. Create ────────────────────────────────────────────────────────────
    const locType = (place_type as LocationType) || "AREA";
    const created = await db.location.create({
      data: {
        name, type: locType, slug, mapbox_id,
        latitude:   String(lat),
        longitude:  String(lng),
        parent_id:  parentId,
        country_id: countryId,
        state_id:   stateId,
        is_active:  true, is_searchable: true, is_featured: false, is_popular: false,
        metadata:   { source: "mapbox", full_name, mapbox_id },
      },
      select: { id: true, name: true, slug: true, type: true },
    });

    // Build breadcrumb parts
    const breadParts = [created.name];
    if (region)  breadParts.push(region);
    if (country) breadParts.push(country);

    return NextResponse.json({
      id:        created.id.toString(),
      name:      created.name,
      slug:      created.slug,
      type:      created.type,
      breadcrumb: breadParts.join(", "),
      latitude:  lat,
      longitude: lng,
      existed:   false,
    });
  } catch (e) {
    console.error("[locations/save-external]", e);
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}
