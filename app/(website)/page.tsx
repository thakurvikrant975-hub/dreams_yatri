export const revalidate = 1800 // ISR every 30 minutes
import Hero from "../components/home/hero";
import TrustSignals from "../components/home/trust";
import PackageSection from "../components/home/package";
import ExploreDestinations from "../components/home/destination";
import AvantiSection from "../components/home/avantiIntro";
import WhyChooseUsSection from "../components/home/whyChoose";
import BlogsSection from "../components/home/blog";
import TestimonialsSection from "../components/home/review";
import NewsletterSection from "../components/home/newsletter";
import Footer from "../components/navigation/Footer";

export default function Home() {

  return (
    <main>
      <Hero />
      <TrustSignals />
      <PackageSection />
      <ExploreDestinations />
      <AvantiSection />
      <WhyChooseUsSection />
      <TestimonialsSection />
      <BlogsSection />
      <NewsletterSection />
      <Footer />
    </main>
  )
}
