// app/api/hotels/route.ts
// GET /api/hotels
//
// Query params:
//   page            number   default 1
//   limit           number   default 12, max 50
//   destination_id  number   filter by destination
//   region_id       number   filter by region
//   category        string   hotel | resort | houseboat | villa | homestay
//   stars           number   1-5
//   min_price       number   min price per night
//   max_price       number   max price per night
//   sort            string   price_asc | price_desc | rating | newest
//   search          string   name search

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma";

const MAX_LIMIT     = 50;
const DEFAULT_LIMIT = 12;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // ── Parse params ──────────────────────────────────────────────────────
  const page           = Math.max(1, Number(searchParams.get("page")   ?? 1));
  const limit          = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_LIMIT)));
  const skip           = (page - 1) * limit;

  const destination_id = searchParams.get("destination_id") ? Number(searchParams.get("destination_id")) : undefined;
  const region_id      = searchParams.get("region_id")      ? Number(searchParams.get("region_id"))      : undefined;
  const category       = searchParams.get("category")       ?? undefined;
  const stars          = searchParams.get("stars")          ? Number(searchParams.get("stars"))           : undefined;
  const min_price      = searchParams.get("min_price")      ? Number(searchParams.get("min_price"))       : undefined;
  const max_price      = searchParams.get("max_price")      ? Number(searchParams.get("max_price"))       : undefined;
  const sort           = searchParams.get("sort")           ?? "newest";
  const search         = searchParams.get("search")?.trim() ?? undefined;

  // ── Build where clause ────────────────────────────────────────────────
  const where: Prisma.hotelsWhereInput = {
    is_active: true,
    ...(category       && { category }),
    ...(stars          && { star_rating: stars }),
    ...(destination_id && { destination_id }),
    ...(region_id      && { destination: { region_id } }),
    ...(search         && {
      name: { contains: search, mode: Prisma.QueryMode.insensitive },
    }),
    // Filter by price range — hotel must have at least one room in range
    ...((min_price || max_price) && {
      room_pricing: {
        some: {
          is_active: true,
          ...(min_price && { price_per_night: { gte: min_price } }),
          ...(max_price && { price_per_night: { lte: max_price } }),
        },
      },
    }),
  };

  // ── Build orderBy ─────────────────────────────────────────────────────
  const orderBy: Prisma.hotelsOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case "price_asc":
      case "price_desc":
        // Prisma can't orderBy aggregation on relations directly —
        // we sort in-memory after fetch for price (small result sets)
        return [{ created_at: "desc" as const }];
      case "newest":
        return [{ created_at: "desc" as const }];
      default:
        return [{ created_at: "desc" as const }];
    }
  })();

  try {
    // Run query + count in parallel
    const [rawHotels, total] = await Promise.all([
      db.hotels.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id:             true,
          name:           true,
          slug:           true,
          thumbnail:      true,
          category:       true,
          star_rating:    true,
          address:        true,
          check_in_time:  true,
          check_out_time: true,
          destination: {
            select: {
              id:   true,
              name: true,
              region: { select: { id: true, name: true } },
            },
          },
          // Cheapest active room for starting price
          room_pricing: {
            where:   { is_active: true },
            orderBy: { price_per_night: "asc" },
            take:    1,
            select: {
              price_per_night: true,
              original_price:  true,
              room_type:       true,
              season:          true,
            },
          },
          _count: {
            select: { room_pricing: true },
          },
        },
      }),
      db.hotels.count({ where }),
    ]);

    // ── Serialize Decimal + apply client-side price sort ─────────────────
    let hotels = rawHotels.map(h => ({
      ...h,
      room_pricing: h.room_pricing.map(r => ({
        ...r,
        price_per_night: Number(r.price_per_night),
        original_price:  r.original_price ? Number(r.original_price) : null,
      })),
    }));

    if (sort === "price_asc") {
      hotels = hotels.sort((a, b) =>
        (a.room_pricing[0]?.price_per_night ?? Infinity) -
        (b.room_pricing[0]?.price_per_night ?? Infinity)
      );
    }
    if (sort === "price_desc") {
      hotels = hotels.sort((a, b) =>
        (b.room_pricing[0]?.price_per_night ?? 0) -
        (a.room_pricing[0]?.price_per_night ?? 0)
      );
    }

    // ── Pagination meta ───────────────────────────────────────────────────
    const totalPages  = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      data: hotels,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });

  } catch (err) {
    console.error("[GET /api/hotels]", err);
    return NextResponse.json(
      { error: "Failed to fetch hotels" },
      { status: 500 }
    );
  }
}