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
      // add whatever relations your HotelDetail type needs
      // e.g. images: true, amenities: true, rooms: true
    },
  });

  return hotel as HotelDetail | null;
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