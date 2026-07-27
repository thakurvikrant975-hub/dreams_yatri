import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import { SITE_CONFIG, SITE_URL } from "@/app/lib/seo/site-config";
import { getOGImage } from "@/app/lib/imageUrl";
import { OfferPageClient } from "./OfferPageClient";

async function getLandingPage(slug: string) {
  return db.landingPage.findUnique({
    where: { slug },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  if (!page || page.status !== "PUBLISHED") return { title: "Page not found | DreamsYatri" };

  const canonical = `${SITE_URL}/offers/${slug}`;
  const ogImage = getOGImage(page.heroImageUrl);

  return {
    title: page.seoTitle,
    description: page.seoDescription,
    alternates: { canonical },
    // Ad landing pages are meant to be crawlable/shareable — unlike the deep
    // catalog package variants (packages/[slug]/[duration]/...), which are
    // deliberately no-indexed to avoid duplicate-content across combos.
    robots: { index: true, follow: true },
    openGraph: {
      title: page.seoTitle,
      description: page.seoDescription,
      url: canonical,
      siteName: SITE_CONFIG.name,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.seoTitle,
      description: page.seoDescription,
      images: [ogImage],
    },
  };
}

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getLandingPage(slug);
  if (!page || page.status !== "PUBLISHED") notFound();

  return (
    <OfferPageClient
      page={{
        slug: page.slug,
        title: page.title,
        description: page.description,
        heroImageUrl: page.heroImageUrl,
        heroEyebrow: page.heroEyebrow,
        heroHeadline: page.heroHeadline,
        destination: page.destination,
        popupDelaySeconds: page.popupDelaySeconds,
        contactPhone: page.contactPhone,
        googleAdsSendToForm: page.googleAdsSendToForm,
        googleAdsSendToCall: page.googleAdsSendToCall,
        googleAdsSendToWhatsapp: page.googleAdsSendToWhatsapp,
        faqs: page.faqs as { question: string; answer: string }[],
        testimonials: page.testimonials as { authorName: string; authorRole: string; quote: string; rating: number }[],
        items: page.items.map((it) => ({
          id: it.id, title: it.title, imageUrl: it.imageUrl,
          routeLabel: it.routeLabel, priceLabel: it.priceLabel, badgeLabel: it.badgeLabel,
          showInHero: it.showInHero,
        })),
      }}
    />
  );
}
