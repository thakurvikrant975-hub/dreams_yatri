import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LocationType } from "@/app/generated/prisma";
import { z } from "zod";
import { createLog } from "@/app/(dashboard)/dashboard/(main)/lib/logger";

const schema = z.object({
  mapbox_id:   z.string(),
  name:        z.string().min(1),
  full_name:   z.string(),
  place_type:  z.string(),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  country:     z.string().optional(),
  region:      z.string().optional(),  // state name from Mapbox
  place:       z.string().optional(),  // city name from Mapbox
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

    const { mapbox_id, name, full_name, place_type, coordinates, country, region, place } =
      parsed.data;
    const [lng, lat] = coordinates;

    const locationSelect = {
      id: true, name: true, type: true, slug: true, latitude: true, longitude: true,
      city:    { select: { name: true } },
      state:   { select: { name: true } },
      country: { select: { name: true } },
    } as const;

    function toResponse(r: {
      id: bigint; name: string; type: LocationType; slug: string;
      latitude: { toString(): string } | null; longitude: { toString(): string } | null;
      city?: { name: string } | null;
      state?: { name: string } | null;
      country?: { name: string } | null;
    }, extra?: { city_name?: string | null; state_name?: string | null; country_name?: string | null; existed?: boolean }) {
      const city_name    = r.city?.name    ?? extra?.city_name    ?? null;
      const state_name   = r.state?.name   ?? extra?.state_name   ?? null;
      const country_name = r.country?.name ?? extra?.country_name ?? null;
      const parts = [r.name];
      if (state_name   && state_name   !== r.name) parts.push(state_name);
      if (country_name && country_name !== r.name) parts.push(country_name);
      return {
        id:           r.id.toString(),
        name:         r.name,
        slug:         r.slug,
        type:         r.type,
        breadcrumb:   parts.join(", "),
        latitude:     r.latitude  != null ? Number(r.latitude.toString())  : null,
        longitude:    r.longitude != null ? Number(r.longitude.toString()) : null,
        city_name,
        state_name,
        country_name,
        existed:      extra?.existed ?? false,
      };
    }

    // ── 1. Exact match by mapbox_id ──────────────────────────────────────────
    const byId = await db.location.findFirst({ where: { mapbox_id }, select: locationSelect });
    if (byId) return NextResponse.json(toResponse(byId, { city_name: place, state_name: region, country_name: country, existed: true }));

    // ── 2. Proximity + name duplicate check (~1 km at equator) ───────────────
    const DELTA = 0.01;
    const nearby = await db.location.findFirst({
      where: {
        name:      { equals: name, mode: "insensitive" },
        latitude:  { gte: lat - DELTA, lte: lat + DELTA },
        longitude: { gte: lng - DELTA, lte: lng + DELTA },
      },
      select: locationSelect,
    });
    if (nearby) return NextResponse.json(toResponse(nearby, { city_name: place, state_name: region, country_name: country, existed: true }));

    // ── 3. Resolve parent IDs from local DB ──────────────────────────────────
    let countryId: bigint | null = null;
    let stateId:   bigint | null = null;
    let cityId:    bigint | null = null;
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
        where: { type: "STATE", country_id: countryId, name: { equals: region, mode: "insensitive" } },
        select: { id: true },
      });
      if (dbState) { stateId = dbState.id; parentId = dbState.id; }
    }

    if (place && stateId) {
      const dbCity = await db.location.findFirst({
        where: { type: "CITY", state_id: stateId, name: { equals: place, mode: "insensitive" } },
        select: { id: true },
      });
      if (dbCity) { cityId = dbCity.id; parentId = dbCity.id; }
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
        city_id:    cityId,
        is_active:  true, is_searchable: true, is_featured: false, is_popular: false,
        metadata:   { source: "mapbox", full_name, mapbox_id },
      },
      select: locationSelect,
    });

    await createLog({
      action: "CREATE",
      entity: "Location",
      entityId: created.id.toString(),
      entitySlug: created.slug,
      newData: { name: created.name, slug: created.slug, type: created.type },
    });

    return NextResponse.json(toResponse(created, { city_name: place, state_name: region, country_name: country }));
  } catch (e) {
    console.error("[locations/save-external]", e);
    return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
  }
}
