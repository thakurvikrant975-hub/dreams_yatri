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
import { fetchDestinationsInCountry } from "@/app/actions/destinations/fetch-destination-page";
import { getPublishedBlogs } from "@/app/actions/blogs/public";

export default async function Home() {
  const [recentPackages, activeDestinations, { posts: latestBlogs }] = await Promise.all([
    // Pool, not page size: the section shows 6 at a time but filters this set
    // down per theme tab, so it needs enough spread to keep every tab stocked.
    fetchRecentPackages(18),
    fetchDestinationsInCountry("India", 12),
    getPublishedBlogs({ limit: 3 }),
  ]);

  // Individual destinations from the dashboard (Goa, Kerala…), tagged with the
  // region they roll up into so the card can show that relationship.
  const stateItems = activeDestinations.map((d) => ({
    slug: d.slug,
    name: d.name,
    packageCount: d.packageCount,
    image: d.image,
    region: d.region ?? undefined,
  }));

  return (
    <>
      <Header transparent={true} />
      <main>
        <Hero />
        <TrustSignals />
        <PackageSection packages={recentPackages} />
        <ExploreDestinations
          states={stateItems.length > 0 ? stateItems : undefined}
        />
        <AvantiSection />
        <WhyChooseUsSection />
        <TestimonialsSection />
        <BlogsSection posts={latestBlogs} />
        <NewsletterSection />
        <Footer />
      </main>
    </>
  )
}
