import type { Metadata } from "next";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import HotelDetailClient from "./HotelDetailClient";
import { hotel } from "./dummy";

// NOTE: UI-only page using dummy data for development. Wire real data later.

export const metadata: Metadata = {
  title: `${hotel.name} — ${hotel.city}`,
  description: hotel.about,
};

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await params; // slug ignored for now — dummy data
  return (
    <>
      <Header />
      <HotelDetailClient hotel={hotel} />
      <Footer />
    </>
  );
}
