// lib/schema.ts

// 🏢 ORGANIZATION (used globally)
export const organizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: "DreamsYatri",
  url: "https://dreamsyatri.com",
  logo: "https://dreamsyatri.com/logo.png",
  sameAs: [
    "https://facebook.com/yourpage",
    "https://instagram.com/yourpage",
  ],
});

// 📍 BREADCRUMB (dynamic)
export const breadcrumbSchema = (items: { name: string; url: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    item: item.url,
  })),
});

// 🧳 HOLIDAY PACKAGE (TouristTrip)
export const packageSchema = (data: any) => ({
  "@context": "https://schema.org",
  "@type": "TouristTrip",
  name: data.name,
  description: data.description,
  image: data.image,
  offers: {
    "@type": "Offer",
    price: data.price,
    priceCurrency: "INR",
  },
});

// 🏨 HOTEL BOOKING
export const hotelSchema = (data: any) => ({
  "@context": "https://schema.org",
  "@type": "Hotel",
  name: data.name,
  address: data.address,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: data.rating,
  },
});

// 📝 BLOG / ARTICLE
export const blogSchema = (data: any) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: data.title,
  description: data.description,
  image: data.image,
  author: {
    "@type": "Person",
    name: data.author,
  },
  datePublished: data.date,
});

// ❓ FAQ (used anywhere)
export const faqSchema = (faqs: { q: string; a: string }[]) => ({
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

// 🧑‍💼 TESTIMONIAL / REVIEWS
export const reviewSchema = (reviews: any[]) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  review: reviews.map((r) => ({
    "@type": "Review",
    author: r.name,
    reviewBody: r.comment,
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.rating,
    },
  })),
});