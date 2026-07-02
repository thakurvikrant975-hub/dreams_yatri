import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LocationType } from "@/app/generated/prisma";
import { getLocationsIndex, isMeiliConfigured } from "@/app/lib/search/meili";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const typesParam = searchParams.get("types");
    const types = typesParam
      ? (typesParam.split(",").filter(Boolean) as LocationType[])
      : undefined;
    // Higher cap for preload requests (e.g. countries list)
    const limit = Math.min(Number(searchParams.get("limit") ?? "8"), 500);

    const destinationsOnly         = searchParams.get("destinationsOnly")         === "true";
    const excludePricedCabs        = searchParams.get("excludePricedCabs")        === "true";
    const excludePricedCabsLocation = searchParams.get("excludePricedCabsLocation") === "true";

    // Allow type-only queries (no text) so callers can preload all items of a type
    if (q.length < 2 && !types?.length) return NextResponse.json([]);

    // ── Meilisearch fast path (typo-tolerant) ────────────────────────────────
    // Used for plain text autocomplete. Destination-scoped queries
    // (destinationsOnly / excludePricedCabs) need DB-side id filtering, so they
    // stay on Postgres below. If Meili errors, we fall through to Postgres.
    if (q.length >= 2 && !destinationsOnly && !excludePricedCabs && isMeiliConfigured) {
      try {
        const idx = await getLocationsIndex();
        if (idx) {
          const filters = ["is_active = true", "is_searchable = true"];
          if (types?.length) {
            filters.push(`(${types.map((t) => `type = "${t}"`).join(" OR ")})`);
          }
          const r = await idx.search(q, { limit, filter: filters.join(" AND ") });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return NextResponse.json((r.hits as any[]).map((h) => ({
            source:       "local",
            id:           String(h.id),
            name:         h.name,
            type:         h.type,
            slug:         h.slug,
            breadcrumb:   h.breadcrumb ?? h.name,
            latitude:     h.latitude   ?? null,
            longitude:    h.longitude  ?? null,
            city_name:    h.city       ?? null,
            state_name:   h.state      ?? null,
            country_name: h.country    ?? null,
          })));
        }
      } catch (e) {
        console.error("[locations/search] Meili error — falling back to Postgres", e);
      }
    }

    // excludePricedCabsLocation=true → exclude locations that already have a cab_pricing record
    // (used by the new cab-pricing city picker that goes directly to locations, not destinations)
    if (excludePricedCabsLocation) {
      const priced = await db.cab_pricing.findMany({
        where:    { location_id: { not: null } },
        select:   { location_id: true },
        distinct: ["location_id"],
      });
      const pricedIds = priced.map((r) => r.location_id!).filter(Boolean);
      const rows = await db.location.findMany({
        where: {
          is_active: true,
          type: { in: ["CITY", "STATE", "COUNTRY"] as const },
          OR: q.length >= 2
            ? [
                { name:          { contains: q, mode: "insensitive" } },
                { official_name: { contains: q, mode: "insensitive" } },
              ]
            : undefined,
          ...(pricedIds.length > 0 ? { id: { notIn: pricedIds } } : {}),
        },
        select: {
          id: true, name: true, type: true, slug: true,
          latitude: true, longitude: true,
          city:    { select: { name: true } },
          state:   { select: { name: true } },
          country: { select: { name: true } },
        },
        orderBy: [{ is_featured: "desc" }, { is_popular: "desc" }, { name: "asc" }],
        take: limit,
      });
      return NextResponse.json(rows.map((r) => {
        const parts = [r.name];
        if (r.state?.name   && r.state.name   !== r.name) parts.push(r.state.name);
        if (r.country?.name && r.country.name !== r.name) parts.push(r.country.name);
        return {
          source: "local", id: r.id.toString(), name: r.name, type: r.type, slug: r.slug,
          breadcrumb: parts.join(", "),
          latitude:  r.latitude  != null ? Number(r.latitude)  : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          city_name: r.city?.name ?? null, state_name: r.state?.name ?? null, country_name: r.country?.name ?? null,
        };
      }));
    }

    // Compute location ID filters when destination-scoping is requested.
    // destinationsOnly=true  → only show locations that have a destination record.
    // excludePricedCabs=true → additionally exclude destinations that already have cab pricing.
    // Both params are always used together in the cab-pricing form.
    let includeLocationIds: bigint[] | undefined;
    let excludeLocationIds: bigint[] | undefined;

    if (destinationsOnly || excludePricedCabs) {
      const toBigInt = (s: string | null): bigint | null => {
        try { return s ? BigInt(s) : null; } catch { return null; }
      };

      const [allDests, pricedDests] = await Promise.all([
        db.destinations.findMany({
          where:  { is_active: true, location_id: { not: null } },
          select: { location_id: true },
        }),
        excludePricedCabs
          ? db.destinations.findMany({
              where:  { is_active: true, location_id: { not: null }, cabPricings: { some: {} } },
              select: { location_id: true },
            })
          : Promise.resolve([] as { location_id: string | null }[]),
      ]);

      const pricedSet = new Set(pricedDests.map((d) => d.location_id));

      if (destinationsOnly) {
        // Keep only locations whose id appears in the destinations table, minus already-priced ones
        includeLocationIds = allDests
          .filter((d) => !excludePricedCabs || !pricedSet.has(d.location_id))
          .map((d) => toBigInt(d.location_id))
          .filter((id): id is bigint => id !== null);
      } else {
        // excludePricedCabs only — exclude locations of priced destinations
        excludeLocationIds = pricedDests
          .map((d) => toBigInt(d.location_id))
          .filter((id): id is bigint => id !== null);
      }
    }

    const rows = await db.location.findMany({
      where: {
        is_active: true,
        OR: [
          { name:          { contains: q, mode: "insensitive" } },
          { official_name: { contains: q, mode: "insensitive" } },
        ],
        ...(types?.length ? { type: { in: types } } : {}),
        ...(includeLocationIds   ? { id: { in:    includeLocationIds   } } : {}),
        ...(excludeLocationIds?.length ? { id: { notIn: excludeLocationIds } } : {}),
      },
      select: {
        id: true, name: true, type: true, slug: true,
        latitude: true, longitude: true,
        city:    { select: { name: true } },
        state:   { select: { name: true } },
        country: { select: { name: true } },
      },
      orderBy: [
        { is_featured: "desc" },
        { is_popular:  "desc" },
        { name:        "asc"  },
      ],
      take: limit,
    });

    return NextResponse.json(
      rows.map((r) => {
        const parts = [r.name];
        if (r.state?.name   && r.state.name   !== r.name) parts.push(r.state.name);
        if (r.country?.name && r.country.name !== r.name) parts.push(r.country.name);
        return {
          source:       "local",
          id:           r.id.toString(),
          name:         r.name,
          type:         r.type,
          slug:         r.slug,
          breadcrumb:   parts.join(", "),
          latitude:     r.latitude  != null ? Number(r.latitude)  : null,
          longitude:    r.longitude != null ? Number(r.longitude) : null,
          city_name:    r.city?.name    ?? null,
          state_name:   r.state?.name   ?? null,
          country_name: r.country?.name ?? null,
        };
      }),
    );
  } catch (e) {
    console.error("[locations/search]", e);
    return NextResponse.json([], { status: 500 });
  }
}
