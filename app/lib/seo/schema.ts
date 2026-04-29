// lib/schema.ts
import { SITE_CONFIG } from "./site-config";

// ─── Types ───────────────────────────────────────────────

export type BreadcrumbItem = { name: string; url: string };

export type PackageSchemaData = {
  name: string;
  slug: string;
  description: string;
  image: string | string[];
  price: number;
  duration: string;        // e.g. "7 Days / 6 Nights"
  destination: string;     // e.g. "Kashmir"
  rating?: number;
  reviewCount?: number;
};

export type HotelSchemaData = {
  name: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  image?: string;
  priceRange?: string;
};

export type BlogSchemaData = {
  title: string;
  slug: string;
  description: string;
  image: string;
  author: string;
  publishedAt: string;     // ISO string
  modifiedAt?: string;
};

export type FAQItem = { q: string; a: string };

// ─── Schemas ─────────────────────────────────────────────

export const organizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "@id": `${SITE_CONFIG.url}/#organization`,
  name: SITE_CONFIG.name,
  url: SITE_CONFIG.url,
  logo: {
    "@type": "ImageObject",
    url: SITE_CONFIG.logo,
  },
  telephone: SITE_CONFIG.phone,
  email: SITE_CONFIG.email,
  address: {
    "@type": "PostalAddress",
    streetAddress: SITE_CONFIG.address.street,
    addressLocality: SITE_CONFIG.address.city,
    addressRegion: SITE_CONFIG.address.state,
    postalCode: SITE_CONFIG.address.postalCode,
    addressCountry: SITE_CONFIG.address.country,
  },
  sameAs: Object.values(SITE_CONFIG.social),
});

export const websiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_CONFIG.url}/#website`,
  url: SITE_CONFIG.url,
  name: SITE_CONFIG.name,
  publisher: { "@id": `${SITE_CONFIG.url}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_CONFIG.url}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});

export const breadcrumbSchema = (items: BreadcrumbItem[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: item.url.startsWith("http")
      ? item.url
      : `${SITE_CONFIG.url}${item.url}`,
  })),
});

export const packageSchema = (data: PackageSchemaData) => ({
  "@context": "https://schema.org",
  "@type": "TouristTrip",
  "@id": `${SITE_CONFIG.url}/packages/${data.slug}`,
  name: data.name,
  description: data.description,
  image: Array.isArray(data.image) ? data.image : [data.image],
  touristType: ["Family", "Couple", "Solo"],
  itinerary: {
    "@type": "ItemList",
    name: `${data.name} Itinerary`,
  },
  provider: {
    "@id": `${SITE_CONFIG.url}/#organization`,
  },
  offers: {
    "@type": "Offer",
    price: data.price,
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: `${SITE_CONFIG.url}/packages/${data.slug}`,
    seller: { "@id": `${SITE_CONFIG.url}/#organization` },
  },
  ...(data.rating && data.reviewCount
    ? {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: data.rating,
          reviewCount: data.reviewCount,
          bestRating: 5,
          worstRating: 1,
        },
      }
    : {}),
});

export const hotelSchema = (data: HotelSchemaData) => ({
  "@context": "https://schema.org",
  "@type": "Hotel",
  name: data.name,
  image: data.image,
  priceRange: data.priceRange ?? "₹₹",
  address: {
    "@type": "PostalAddress",
    streetAddress: data.address,
    addressLocality: data.city,
    addressCountry: "IN",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: data.rating,
    reviewCount: data.reviewCount,  // ← was missing, blocks rich results
    bestRating: 5,
    worstRating: 1,
  },
});

export const blogSchema = (data: BlogSchemaData) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "@id": `${SITE_CONFIG.url}/blog/${data.slug}`,
  headline: data.title,
  description: data.description,
  image: data.image,
  url: `${SITE_CONFIG.url}/blog/${data.slug}`,
  datePublished: data.publishedAt,
  dateModified: data.modifiedAt ?? data.publishedAt,
  author: {
    "@type": "Person",
    name: data.author,
  },
  publisher: {
    "@id": `${SITE_CONFIG.url}/#organization`,
  },
});

export const faqSchema = (faqs: FAQItem[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
});