import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LocationType } from "@/app/generated/prisma";
import { getLocationsIndex, isMeiliConfigured } from "@/app/lib/search/meili";

// Text search here otherwise ties on is_featured/is_popular (false for most
// rows) and falls back to plain `name asc` — which ranks an unrelated longer
// name ("Gir Somnath") above the actual exact match ("Somnath") purely
// because "G" < "S". Lower is better; used as the primary sort key ahead of
// featured/popular/name so an exact/prefix match always wins regardless of
// alphabetical position.
function relevanceRank(name: string, officialName: string | null, q: string): number {
  const n = name.toLowerCase();
  const o = officialName?.toLowerCase() ?? "";
  const query = q.toLowerCase();
  if (n === query) return 0;
  if (n.startsWith(query)) return 1;
  if (o === query) return 2;
  if (o.startsWith(query)) return 3;
  if (n.includes(query)) return 4;
  return 5;
}

// A property or attraction is routinely named after the town it's in ("a
// hotel literally named 'Nainital'", ~8km from the actual town centre — a
// 25km+ drive in the hills). Any caller that resolves a bare place name to
// "the" location without its own `types` filter — geocodeCity being the
// confirmed case, priced hotel distance came out wrong because this exact
// tie broke toward the hotel — means a real place, not a property or POI
// inside one. This tiebreak makes that the default for every caller, not
// just the ones that remember to filter, so the same class of bug can't
// resurface through a different unfiltered lookup later.
const NON_PLACE_TYPES = new Set<LocationType>([
  "HOTEL", "ACTIVITY", "AIRPORT", "BUS_STATION", "TRAIN_STATION", "PORT", "ROUTE_STOP",
] as LocationType[]);
function typePriority(type: LocationType): number {
  return NON_PLACE_TYPES.has(type) ? 1 : 0;
}

// Cap on rows fetched for in-memory relevance ranking (a text query rarely
// matches more than a few dozen locations) — bounds cost while still letting
// us rank the whole match set before slicing out the requested page.
const RELEVANCE_FETCH_CAP = 300;

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
    // Pagination for infinite-scroll callers — additive, so callers that never
    // send it (existing behavior) are unaffected.
    const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

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
          const r = await idx.search(q, { limit, offset, filter: filters.join(" AND ") });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let hits = r.hits as any[];
          // Same tiebreak as the Postgres path below — only when the caller
          // hasn't already scoped `types` itself. Reorders ONLY among hits
          // that exactly match the query text, so it can't touch Meili's own
          // fuzzy/typo-tolerant ranking for anything else.
          if (!types?.length) {
            const query = q.toLowerCase();
            hits = [...hits].sort((a, b) => {
              const aExact = String(a.name ?? "").toLowerCase() === query;
              const bExact = String(b.name ?? "").toLowerCase() === query;
              return aExact && bExact ? typePriority(a.type) - typePriority(b.type) : 0;
            });
          }
          return NextResponse.json(hits.map((h) => ({
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
      const hasQuery = q.length >= 2;
      const rows = await db.location.findMany({
        where: {
          is_active: true,
          type: { in: ["CITY", "STATE", "COUNTRY"] as const },
          OR: hasQuery
            ? [
                { name:          { contains: q, mode: "insensitive" } },
                { official_name: { contains: q, mode: "insensitive" } },
              ]
            : undefined,
          ...(pricedIds.length > 0 ? { id: { notIn: pricedIds } } : {}),
        },
        select: {
          id: true, name: true, type: true, slug: true, official_name: true,
          latitude: true, longitude: true,
          city:    { select: { name: true } },
          state:   { select: { name: true } },
          country: { select: { name: true } },
        },
        orderBy: [{ is_featured: "desc" }, { is_popular: "desc" }, { name: "asc" }],
        skip: hasQuery ? 0 : offset,
        take: hasQuery ? RELEVANCE_FETCH_CAP : limit,
      });
      if (hasQuery) {
        rows.sort((a, b) => relevanceRank(a.name, a.official_name, q) - relevanceRank(b.name, b.official_name, q));
      }
      const paged = hasQuery ? rows.slice(offset, offset + limit) : rows;
      return NextResponse.json(paged.map((r) => {
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

    const hasQuery = q.length >= 2;
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
        id: true, name: true, type: true, slug: true, official_name: true,
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
      skip: hasQuery ? 0 : offset,
      take: hasQuery ? RELEVANCE_FETCH_CAP : limit,
    });

    if (hasQuery) {
      rows.sort((a, b) => {
        const rankDiff = relevanceRank(a.name, a.official_name, q) - relevanceRank(b.name, b.official_name, q);
        return rankDiff !== 0 ? rankDiff : typePriority(a.type) - typePriority(b.type);
      });
    }
    const paged = hasQuery ? rows.slice(offset, offset + limit) : rows;

    return NextResponse.json(
      paged.map((r) => {
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
