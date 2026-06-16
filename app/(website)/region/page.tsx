import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import {
  fetchRegionsPage,
  fetchRegionSidebarData,
  type RegionFilters,
} from "@/app/actions/regions/fetch-region-page";
import Breadcrumps from "@/app/components/ui/Breadcrumps";
import { Heading, Text } from "@/app/components/ui/Typography";
import RegionsListClient from "./RegionsListClient";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import { SITE_CONFIG, SITE_URL } from "@/app/lib/seo/site-config";

const TITLE = "All Regions | Dreams Yatri";
const DESCRIPTION = "Browse our curated travel regions across India. Discover destinations and holiday packages by region.";
const CANONICAL = `${SITE_URL}/region`;

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

function parseFilters(sp: { countries?: string }): RegionFilters {
  const countries = sp.countries
    ? sp.countries.split(",").map((c) => c.trim()).filter(Boolean)
    : [];
  return { countries };
}

export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ countries?: string }>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [initial, sidebar] = await Promise.all([
    fetchRegionsPage(filters, 1, 12),
    fetchRegionSidebarData(),
  ]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* ── Hero header ──────────────────────────────────────────── */}
        <section className="bg-neutral-50 border-b border-neutral-100 py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <Breadcrumps title="Regions" />
            <div className="mt-4 flex items-start gap-3">
              <MapPin className="h-7 w-7 text-primary mt-1 shrink-0" />
              <div>
                <Heading level={1} weight="bold">
                  Explore Regions
                </Heading>
                <Text size="base" intent="muted" className="mt-1">
                  {sidebar.total} regions · curated for every kind of traveller
                </Text>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sidebar + Grid ───────────────────────────────────────── */}
        <RegionsListClient
          initial={initial}
          sidebar={sidebar}
          initialFilters={filters}
        />
      </main>
      <Footer />
    </>
  );
}
