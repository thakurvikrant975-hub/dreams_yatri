// lib/schema.ts
import { SITE_CONFIG, ORG_ID, SITE_URL } from "./site-config";


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
  telephone: SITE_CONFIG.contact.support.phone,
  email: SITE_CONFIG.contact.support.email,
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

// Local Business (critical for "travel agency near me" searches)
export const localBusinessSchema = () => ({
  "@context": "https://schema.org",
  "@type": ["TravelAgency", "LocalBusiness"],
  "@id": ORG_ID,
  name: SITE_CONFIG.name,
  legalName: SITE_CONFIG.legalName,
  url: SITE_URL,
  telephone: SITE_CONFIG.contact.general.phone,
  email: SITE_CONFIG.contact.general.email,
  foundingDate: String(SITE_CONFIG.stats.foundingYear),
  image: SITE_CONFIG.logo,
  logo: SITE_CONFIG.logo,
  priceRange: "₹₹–₹₹₹",
  address: {
    "@type": "PostalAddress",
    streetAddress: SITE_CONFIG.address.street,
    addressLocality: SITE_CONFIG.address.city,
    addressRegion: SITE_CONFIG.address.state,
    postalCode: SITE_CONFIG.address.postalCode,
    addressCountry: SITE_CONFIG.address.country,
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: SITE_CONFIG.geo.latitude,
    longitude: SITE_CONFIG.geo.longitude,
  },
  openingHoursSpecification: SITE_CONFIG.openingHours.map((h) => ({
    "@type": "OpeningHoursSpecification",
    // parse "Mo-Sa 09:00-19:00" properly if needed, or use string form
  })),
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: SITE_CONFIG.stats.googleRating,
    reviewCount: SITE_CONFIG.stats.googleReviewCount,
    bestRating: 5,
    worstRating: 1,
  },
  sameAs: Object.values(SITE_CONFIG.social),
});

// Cab / Vehicle Rental Service
export type CabSchemaData = {
  name: string;           // "Shimla to Manali Cab"
  slug: string;
  description: string;
  price: number;
  vehicleType: string;    // "SUV" | "Sedan" | "Tempo Traveller"
  fromLocation: string;
  toLocation: string;
};

export const cabSchema = (data: CabSchemaData) => ({
  "@context": "https://schema.org",
  "@type": "TaxiService",
  name: data.name,
  description: data.description,
  provider: { "@id": ORG_ID },
  areaServed: {
    "@type": "State",
    name: "Himachal Pradesh",
  },
  offers: {
    "@type": "Offer",
    price: data.price,
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/cabs/${data.slug}`,
  },
});

// Helicopter Service
export type HelicopterSchemaData = {
  name: string;           // "Kedarnath Helicopter Booking"
  slug: string;
  description: string;
  price: number;
  fromLocation: string;
  toLocation: string;
  duration?: string;
};

export const helicopterSchema = (data: HelicopterSchemaData) => ({
  "@context": "https://schema.org",
  "@type": "Flight",
  name: data.name,
  description: data.description,
  provider: { "@id": ORG_ID },
  departureAirport: {
    "@type": "Airport",
    name: data.fromLocation,
  },
  arrivalAirport: {
    "@type": "Airport",
    name: data.toLocation,
  },
  offers: {
    "@type": "Offer",
    price: data.price,
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/helicopter/${data.slug}`,
  },
});

// Activity / Experience
export type ActivitySchemaData = {
  name: string;           // "River Rafting in Kullu"
  slug: string;
  description: string;
  price: number;
  duration?: string;      // "3 Hours"
  location: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
};

export const activitySchema = (data: ActivitySchemaData) => ({
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  name: data.name,
  description: data.description,
  image: data.image,
  url: `${SITE_URL}/activities/${data.slug}`,
  touristType: ["Adventure", "Family", "Solo"],
  location: {
    "@type": "Place",
    name: data.location,
    address: {
      "@type": "PostalAddress",
      addressLocality: data.location,
      addressCountry: "IN",
    },
  },
  offers: {
    "@type": "Offer",
    price: data.price,
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/activities/${data.slug}`,
    seller: { "@id": ORG_ID },
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

// Testimonials / Reviews (for testimonial page)
export type ReviewSchemaData = {
  author: string;
  rating: number;
  reviewBody: string;
  datePublished: string;  // ISO
  destination?: string;
};

export const reviewSchema = (reviews: ReviewSchemaData[]) => ({
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "@id": ORG_ID,
  name: SITE_CONFIG.name,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: SITE_CONFIG.stats.googleRating,
    reviewCount: SITE_CONFIG.stats.googleReviewCount,
    bestRating: 5,
    worstRating: 1,
  },
  review: reviews.map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.author },
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.rating,
      bestRating: 5,
    },
    reviewBody: r.reviewBody,
    datePublished: r.datePublished,
  })),
});

// Career / Job Posting
export type JobSchemaData = {
  title: string;
  description: string;
  datePosted: string;      // ISO
  validThrough?: string;   // ISO
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACTOR";
  baseSalary?: { min: number; max: number };
};

export const jobSchema = (data: JobSchemaData) => ({
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: data.title,
  description: data.description,
  datePosted: data.datePosted,
  validThrough: data.validThrough,
  employmentType: data.employmentType,
  hiringOrganization: {
    "@type": "Organization",
    name: SITE_CONFIG.name,
    sameAs: SITE_URL,
    logo: SITE_CONFIG.logo,
  },
  jobLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_CONFIG.address.street,
      addressLocality: SITE_CONFIG.address.city,
      addressRegion: SITE_CONFIG.address.state,
      postalCode: SITE_CONFIG.address.postalCode,
      addressCountry: SITE_CONFIG.address.country,
    },
  },
  ...(data.baseSalary
    ? {
        baseSalary: {
          "@type": "MonetaryAmount",
          currency: "INR",
          value: {
            "@type": "QuantitativeValue",
            minValue: data.baseSalary.min,
            maxValue: data.baseSalary.max,
            unitText: "YEAR",
          },
        },
      }
    : {}),
});