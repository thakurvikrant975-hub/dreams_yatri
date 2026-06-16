import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import {
  fetchDestinationsPage,
  fetchDestinationSidebarData,
  type DestinationFilters,
} from "@/app/actions/destinations/fetch-destination-page";
import Breadcrumps from "@/app/components/ui/Breadcrumps";
import { Heading, Text } from "@/app/components/ui/Typography";
import DestinationsListClient from "./DestinationsListClient";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import { SITE_CONFIG, SITE_URL } from "@/app/lib/seo/site-config";

const TITLE = "All Destinations | Dreams Yatri";
const DESCRIPTION = "Explore our handpicked travel destinations across India and the world. Find the perfect place for your next holiday.";
const CANONICAL = `${SITE_URL}/destination`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    siteName: SITE_CONFIG.name,
    type: "website",
    images: [{ url: SITE_CONFIG.defaultOgImage, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_CONFIG.defaultOgImage],
  },
};

export const revalidate = 3600;

function parseFilters(sp: {
  type?: string;
  regions?: string;
  countries?: string;
}): DestinationFilters {
  const type =
    sp.type === "domestic" || sp.type === "international" ? sp.type : "all";
  const regionIds = sp.regions
    ? sp.regions.split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const countries = sp.countries
    ? sp.countries.split(",").map((c) => c.trim()).filter(Boolean)
    : [];
  return { type, regionIds, countries };
}

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; regions?: string; countries?: string }>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [initial, sidebar] = await Promise.all([
    fetchDestinationsPage(filters, 1, 12),
    fetchDestinationSidebarData(),
  ]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* ── Hero header ──────────────────────────────────────────── */}
        <section className="bg-neutral-50 border-b border-neutral-100 py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <Breadcrumps title="Destinations" />
            <div className="mt-4 flex items-start gap-3">
              <MapPin className="h-7 w-7 text-primary mt-1 shrink-0" />
              <div>
                <Heading level={1} weight="bold">
                  Explore Destinations
                </Heading>
                <Text size="base" intent="muted" className="mt-1">
                  {sidebar.total} destinations · handpicked for unforgettable travel
                </Text>
              </div>
            </div>

            {/* Quick-type tabs */}
            <div className="flex gap-2 mt-6">
              {[
                { label: "All", count: sidebar.total },
                { label: "Domestic", count: sidebar.totalDomestic },
                { label: "International", count: sidebar.totalInternational },
              ].map((tab) => (
                <span
                  key={tab.label}
                  className="px-4 py-1.5 rounded-full text-sm border border-neutral-200 bg-white text-neutral-600 font-medium"
                >
                  {tab.label}{" "}
                  <span className="text-neutral-400 font-normal">({tab.count})</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Sidebar + Grid ───────────────────────────────────────── */}
        <DestinationsListClient
          initial={initial}
          sidebar={sidebar}
          initialFilters={filters}
        />
      </main>
      <Footer />
    </>
  );
}
