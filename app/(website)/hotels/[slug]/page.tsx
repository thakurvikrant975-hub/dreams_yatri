// app/(website)/hotels/[slug]/page.tsx

import { notFound }          from "next/navigation";
import type { Metadata }     from "next";
import { db }                from "@/app/lib/db";
import type { HotelDetail }  from "@/app/types/hotels/hotelDetails";
import { HotelDetailView }   from "./HotelDetailView";

// ── ISR config ────────────────────────────────────────────────────────────
export const revalidate = 60;           // ISR: regenerate every 60s
export const dynamicParams = true;      // render unknown slugs on-demand (don't 404)

// ── Pre-build top 50 hotels at deploy time ────────────────────────────────
export async function generateStaticParams() {
  const hotels = await db.hotels.findMany({
    where:   { is_active: true },
    select:  { slug: true },
    orderBy: { created_at: "desc" },
    take:    50,
  });
  return hotels.map(h => ({ slug: h.slug }));
}

// ── Metadata ──────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const hotel = await db.hotels.findUnique({
    where:  { slug, is_active: true },
    select: {
      name:       true,
      meta_title: true,
      meta_desc:  true,
      thumbnail:  true,
    },
  });

  if (!hotel) return { title: "Hotel not found" };

  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

  return {
    title:       hotel.meta_title ?? `${hotel.name} | Dreams Yatri Hotels`,
    description: hotel.meta_desc  ?? undefined,
    openGraph: {
      title:       hotel.meta_title ?? hotel.name,
      description: hotel.meta_desc  ?? undefined,
      images: hotel.thumbnail
        ? [{ url: `${base}/${hotel.thumbnail}` }]
        : undefined,
    },
  };
}

// ── Direct DB fetch (replaces internal fetch) ─────────────────────────────
async function getHotelDetail(slug: string): Promise<HotelDetail | null> {
  const hotel = await db.hotels.findUnique({
    where: { slug, is_active: true },
    include: {
      destination: {
        select: {
          id: true,
          name: true,
          slug: true,
          region: { select: { id: true, name: true, slug: true } },
        },
      },
      image_categories: {
        orderBy: { sort_order: "asc" },
        include: {
          images: {
            orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
            select: { id: true, url: true, thumbnail: true, alt: true, is_primary: true, sort_order: true },
          },
        },
      },
      room_pricing: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true,
          plan_name: true,
          price_per_night: true,
          original_price: true,
        },
      },
    },
  });

  if (!hotel) return null;

  return {
    ...hotel,
    amenities: null,
    latitude: null,
    longitude: null,
    room_pricing: hotel.room_pricing.map((r) => ({
      id: r.id,
      room_type: r.plan_name ?? "Standard",
      description: null,
      occupancy: 2,
      price_per_night: Number(r.price_per_night),
      original_price: r.original_price ? Number(r.original_price) : null,
      season: "year-round",
      amenities: null,
      margin_percentage: 0,
    })),
  } as HotelDetail;
}

// ── Page ──────────────────────────────────────────────────────────────────
export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hotel    = await getHotelDetail(slug);

  if (!hotel) notFound();

  return <HotelDetailView hotel={hotel} />;
}