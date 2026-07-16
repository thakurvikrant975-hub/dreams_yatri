import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import HotelDetailClient from "./HotelDetailClient";
import { getHotelForBooking } from "./booking-data";
import { isHotelWishlisted } from "./wishlist-actions";

// Default stay window when the guest hasn't picked dates yet: tomorrow → day after.
export function resolveDates(sp: { in?: string; out?: string }) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const t = new Date();
  const checkIn = sp.in ?? iso(new Date(t.getTime() + 86_400_000));
  const checkOut = sp.out ?? iso(new Date(t.getTime() + 2 * 86_400_000));
  return { checkIn, checkOut };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Hotel — ${slug}` };
}

export default async function HotelDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ in?: string; out?: string }>;
}) {
  const { slug } = await params;
  const { checkIn, checkOut } = resolveDates(await searchParams);

  const hotel = await getHotelForBooking(slug, checkIn, checkOut);
  if (!hotel) notFound();

  const initialSaved = await isHotelWishlisted(hotel.id);

  return (
    <>
      <Header />
      <HotelDetailClient hotel={hotel} checkIn={checkIn} checkOut={checkOut} initialSaved={initialSaved} />
      <Footer />
    </>
  );
}
