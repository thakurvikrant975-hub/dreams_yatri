import type { Metadata } from "next";
import { getAllHotelsForOverview } from "../actions";
import { HotelOverviewClient } from "./HotelOverviewClient";

export const metadata: Metadata = {
  title: "Hotel Directory - Dashboard",
  description: "View all hotels by country, state, city, category and star rating",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const hotels = await getAllHotelsForOverview();
  return <HotelOverviewClient hotels={hotels} />;
}
