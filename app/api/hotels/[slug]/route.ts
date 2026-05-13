// app/api/hotels/[slug]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const hotel = await db.hotels.findUnique({
      where: { slug, is_active: true },
      select: {
        id:             true,
        name:           true,
        slug:           true,
        thumbnail:      true,
        description:    true,
        meta_title:     true,
        meta_desc:      true,
        address:        true,
        latitude:       true,
        longitude:      true,
        star_rating:    true,
        category:       true,
        stay_type:      true,
        check_in_time:  true,
        check_out_time: true,
        destination: {
          select: {
            id:   true,
            name: true,
            slug: true,
            region: { select: { id: true, name: true, slug: true } },
          },
        },
        room_pricing: {
          where:   { is_active: true },
          orderBy: { sort_order: "asc" },
          select: {
            id:                true,
            room_id:           true,
            plan_name:         true,
            meal_type_id:      true,
            diet_type_id:      true,
            price_per_night:   true,
            original_price:    true,
            extra_bed_rate:    true,
            margin_percentage: true,
            gst_percentage:    true,
            valid_from:        true,
            valid_to:          true,
            sort_order:        true,
            room: {
              select: {
                id:            true,
                name:          true,
                slug:          true,
                area_sqft:     true,
                bed_type:      true,
                view_type:     true,
                max_occupancy: true,
                amenities:     true,
                description:   true,
              },
            },
            meal_type:  { select: { id: true, name: true } },
            diet_type:  { select: { id: true, name: true } },
            occupancy_prices: {
              select: {
                id:             true,
                occupancy:      true,
                price_per_night: true,
                original_price: true,
              },
            },
          },
        },
        image_categories: {
          orderBy: { sort_order: "asc" },
          select: {
            id:              true,
            name:            true,
            is_required:     true,
            room_pricing_id: true,
            images: {
              orderBy: { sort_order: "asc" },
              select: {
                id:         true,
                url:        true,
                thumbnail:  true,
                alt:        true,
                is_primary: true,
                sort_order: true,
              },
            },
          },
        },
      },
    });

    if (!hotel) {
      return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
    }

    const data = {
      ...hotel,
      latitude:  hotel.latitude  ? Number(hotel.latitude)  : null,
      longitude: hotel.longitude ? Number(hotel.longitude) : null,
      room_pricing: hotel.room_pricing.map(r => ({
        ...r,
        price_per_night:   Number(r.price_per_night),
        original_price:    r.original_price  ? Number(r.original_price)  : null,
        extra_bed_rate:    r.extra_bed_rate  ? Number(r.extra_bed_rate)  : null,
        margin_percentage: Number(r.margin_percentage),
        gst_percentage:    Number(r.gst_percentage),
        occupancy_prices:  r.occupancy_prices.map(o => ({
          ...o,
          price_per_night: Number(o.price_per_night),
          original_price:  o.original_price ? Number(o.original_price) : null,
        })),
      })),
    };

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[GET /api/hotels/:slug]", err);
    return NextResponse.json({ error: "Failed to fetch hotel" }, { status: 500 });
  }
}