import type { Metadata } from "next";
import { listLandingPages } from "./actions";
import { LandingPagesClient } from "./LandingPagesClient";

export const metadata: Metadata = {
  title: "Landing Pages - Dashboard",
  description: "",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function Page() {
  const pages = await listLandingPages();
  return <LandingPagesClient pages={pages} />;
}
