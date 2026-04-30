// lib/site-config.ts

export const SITE_CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  name: "DreamsYatri",
  legalName: "Dreams Yatri (OPC) Private Limited",
  url: "https://dreamsyatri.com",
  logo: "https://dreamsyatri.com/images/logo.png",
  logoWidth: 200,
  logoHeight: 60,
  defaultOgImage: "https://dreamsyatri.com/og/default.jpg", // 1200×630 fallback

  // ── Contact ───────────────────────────────────────────────
  contact: {
    sales: {
      label: "Call Sales",
      phone: "+91-9999999999",
      phoneUrl: "tel:+919999999999",
      email: "sales@dreamsyatri.com",
      emailUrl: "mailto:sales@dreamsyatri.com",
    },
    support: {
      label: "Customer Support",
      phone: "+91-8888888888",
      phoneUrl: "tel:+918888888888",
      email: "support@dreamsyatri.com",
      emailUrl: "mailto:support@dreamsyatri.com",
    },
    finance: {
      label: "Finance",
      phone: "+91-7777777777",
      phoneUrl: "tel:+917777777777",
      email: "finance@dreamsyatri.com",
      emailUrl: "mailto:finance@dreamsyatri.com",
    },
    whatsapp: {
      label: "WhatsApp",
      phone: "+91-9988776655",
      phoneUrl: "https://wa.me/919988776655?text=Hello%2C%20I%20need%20help%20with%20a%20tour%20package",
    },
    general: {
      phone: "+91-1234567890",
      phoneUrl: "tel:+911234567890",
      email: "hi@dreamsyatri.com",
      emailUrl: "mailto:hi@dreamsyatri.com",
    },
  },

  // ── Address ───────────────────────────────────────────────
  address: {
    street: "First Floor, STPI Building, Kusumpti",
    city: "Shimla",
    state: "Himachal Pradesh",
    postalCode: "171009",
    country: "IN",
    countryName: "India",
    full: "First Floor, STPI Building, Kusumpti, Shimla, HP 171009, India",
  },

  // ── Geo (for LocalBusiness schema) ────────────────────────
  geo: {
    latitude: 31.1048,
    longitude: 77.1734,
  },

  // ── Social ────────────────────────────────────────────────
  social: {
    facebook: "https://www.facebook.com/dreamsyatri",
    instagram: "https://www.instagram.com/dreamsyatri",
    youtube: "https://www.youtube.com/@dreamsyatri",
    twitter: "https://twitter.com/dreamsyatri",
    linkedin: "https://www.linkedin.com/company/dreamsyatri",
  },

  // ── Business Stats (used in UI + schema) ──────────────────
  stats: {
    tripsCompleted: "10,000+",
    successRate: "99%",
    googleRating: 4.1,
    googleReviewCount: 420,    // Keep this updated — it feeds AggregateRating schema
    totalDestinations: "50+",
    experience: "5+",          // years
    foundingYear: 2019,
  },

  // ── Business Hours (LocalBusiness schema) ─────────────────
  openingHours: [
    "Mon-Sat 09:00-19:00",
    "Sun 10:00-17:00",
  ],

  // ── SEO Defaults ──────────────────────────────────────────
  seo: {
    titleTemplate: "%s | DreamsYatri",
    defaultTitle: "DreamsYatri – Holiday Packages from Shimla",
    defaultDescription:
      "Book customized holiday packages for Kashmir, Himachal Pradesh, Rajasthan, Goa, Uttarakhand & international destinations. Trusted travel agency in Shimla since 2019.",
    twitterHandle: "@dreamsyatri",
    locale: "en_IN",
    type: "website" as const,
  },
} as const;

// ── Derived helpers (avoids repetition in schema/metadata) ──
export const SITE_URL = SITE_CONFIG.url;
export const ORG_ID = `${SITE_CONFIG.url}/#organization`;
export const WEBSITE_ID = `${SITE_CONFIG.url}/#website`;