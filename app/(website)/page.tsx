export const revalidate = 1800 // ISR every 30 minutes
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

export default function Home() {

  return (
    <>
      <Header transparent={true}/>
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
    </>
  )
}
