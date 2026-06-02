import Hero from "@/app/home/hero";
import TrustSignals from "@/app/home/trust";
import PackageSection from "@/app/home/package";
import ExploreDestinations from "@/app/home/destination";
import AvantiSection from "@/app/home/avantiIntro";
import WhyChooseUsSection from "@/app/home/whyChoose";
import BlogsSection from "@/app/home/blog";
import TestimonialsSection from "@/app/home/review";
import NewsletterSection from "@/app/home/newsletter";
import Footer from "../components/navigation/Footer";
import Header from "../components/navigation/Header";
import { fetchRecentPackages } from "@/app/actions/packages/fetch-page-data";
import { fetchActiveRegions } from "@/app/actions/regions/fetch-region-page";
import { fetchActiveDestinations } from "@/app/actions/destinations/fetch-destination-page";

export default async function Home() {
  const [recentPackages, activeRegions, activeDestinations] = await Promise.all([
    fetchRecentPackages(6),
    fetchActiveRegions("India", 12),
    fetchActiveDestinations("India", 12),
  ]);

  const domesticItems = activeRegions.map((r) => ({
    slug: r.slug,
    name: r.name,
    packageCount: r.packageCount,
    image: r.image,
  }));

  const internationalItems = activeDestinations.map((d) => ({
    slug: d.slug,
    name: d.name,
    packageCount: d.packageCount,
    image: d.image,
    region: d.country,
  }));

  return (
    <>
      <Header transparent={true} />
      <main>
        <Hero />
        <TrustSignals />
        <PackageSection packages={recentPackages} />
        <ExploreDestinations
          domestic={domesticItems.length > 0 ? domesticItems : undefined}
          international={internationalItems.length > 0 ? internationalItems : undefined}
        />
        <AvantiSection />
        <WhyChooseUsSection />
        <TestimonialsSection />
        <BlogsSection />
        <NewsletterSection />
        <Footer />
      </main>
    </>
  )
}
