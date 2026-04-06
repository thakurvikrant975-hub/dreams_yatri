// app/(website)/hotels/[slug]/page.tsx
// ISR — regenerate every 60s, pre-built at deploy for popular hotels

import { notFound }       from "next/navigation";
import type { Metadata }  from "next";
import { db }             from "@/app/lib/db";
import type { HotelDetail } from "@/app/types/hotels/hotelDetails";
import { HotelDetailView }  from "./HotelDetailView";

// ── ISR config ────────────────────────────────────────────────────────────
export const revalidate = 60; // seconds

// ── Pre-build popular / recently updated hotels ───────────────────────────
export async function generateStaticParams() {
  const hotels = await db.hotels.findMany({
    where:   { is_active: true },
    select:  { slug: true },
    orderBy: { created_at: "desc" },
    take:    50, // pre-build top 50 at deploy time
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

// ── Fetch via internal API (respects ISR caching) ─────────────────────────
async function getHotelDetail(slug: string): Promise<HotelDetail | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/hotels/${slug}`, {
    next: { revalidate: 60 },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch hotel");

  const { data } = await res.json();
  return data;
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