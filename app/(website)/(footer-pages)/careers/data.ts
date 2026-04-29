import { Globe, TrendingUp, Users, Heart, Gift, ShieldCheck, Coffee, Zap, MapPin, Trophy, MessageCircle, Plane } from "lucide-react";

import { LucideIcon } from "lucide-react";

type Perk = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

type FeaturedOffer = {
  tag: string;
  title: string;
  subtitle: string;
  body: string;
  image: string;
  stat: string;
  statLabel: string;
};


type Offer = {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string;
  bg: string;
};

export const PERKS: Perk[] = [
  {
    icon: Globe,
    title: "FAM Trips",
    desc: "Explore destinations firsthand on company-sponsored familiarisation tours.",
  },
  {
    icon: TrendingUp,
    title: "Fast Growth",
    desc: "Early-stage company — your impact is visible, and promotions are merit-based.",
  },
  {
    icon: Users,
    title: "Collaborative Team",
    desc: "Small, focused team where every person's work directly shapes company outcomes.",
  },
  {
    icon: Heart,
    title: "Travel Perks",
    desc: "Exclusive discounts on personal travel bookings for you and your family.",
  },
];

export const HERO_STATS = [
  { value: "4",    label: "Open Positions"   },
  { value: "50+",  label: "Destinations"     },
  { value: "10K+", label: "Happy Travellers" },
];

export const OPENINGS = [
  {
    id: 1,
    title:       "Sales Executive",
    department:  "Sales",
    type:        "Full-time",
    location:    "Shimla, HP",
    experience:  "1–3 Years",
    badge:       "Urgent Hiring",
    badgeCls:    "bg-red-50 text-red-600 border border-red-200",
    description: "Drive revenue by converting inbound leads into confirmed bookings. You'll engage with prospective travellers across phone, WhatsApp, and email — understanding their requirements and presenting the right packages with confidence.",
    responsibilities: [
      "Handle inbound enquiries and follow up on leads from Google Ads and organic channels",
      "Understand customer travel requirements and recommend suitable packages",
      "Achieve monthly booking and revenue targets",
      "Maintain accurate lead records in the CRM",
      "Coordinate with the operations team post-confirmation",
    ],
    requirements: [
      "1–3 years of sales experience (travel industry preferred)",
      "Strong verbal communication in Hindi and English",
      "Comfort working with CRM tools and WhatsApp Business",
      "Target-driven with a customer-first mindset",
    ],
  },
  {
    id: 2,
    title:       "Travel Expert",
    department:  "Product",
    type:        "Full-time",
    location:    "Shimla, HP",
    experience:  "2–4 Years",
    badge:       "Open",
    badgeCls:    "bg-green-50 text-green-700 border border-green-200",
    description: "Craft memorable travel experiences by designing detailed, accurate, and competitive tour packages. You are the backbone of our product — your itinerary knowledge directly impacts what we sell and how customers experience their journeys.",
    responsibilities: [
      "Research and build itineraries for HP, Kashmir, Rajasthan, Goa, and international destinations",
      "Source, negotiate, and manage hotel, transport, and activity vendor relationships",
      "Price packages competitively while maintaining healthy margins",
      "Ensure all itinerary documentation is accurate and up-to-date",
      "Support the sales team with destination knowledge during customer calls",
    ],
    requirements: [
      "2–4 years in travel operations or tour planning",
      "Strong knowledge of domestic destinations (HP, Kashmir, Rajasthan mandatory)",
      "Vendor negotiation and costing experience",
      "Detail-oriented with excellent written communication",
    ],
  },
  {
    id: 3,
    title:       "Business Development Manager",
    department:  "Growth",
    type:        "Full-time",
    location:    "Shimla / Remote",
    experience:  "4–7 Years",
    badge:       "Senior Role",
    badgeCls:    "bg-indigo-50 text-indigo-700 border border-indigo-200",
    description: "Own our B2B and partnership growth strategy. You will identify and close partnerships with corporates, schools, travel agents, and international inbound operators — expanding our distribution beyond direct consumer channels.",
    responsibilities: [
      "Identify and develop B2B partnerships with corporates, educational institutions, and travel agents",
      "Build and manage a pipeline of channel partners across North India",
      "Lead outreach for international inbound tourism from UK, USA, Australia, and GCC markets",
      "Negotiate and finalise partnership agreements",
      "Represent Dreams Yatri at travel trade fairs and networking events",
    ],
    requirements: [
      "4–7 years in business development, preferably in travel or hospitality",
      "Proven B2B sales track record with a strong professional network",
      "Excellent presentation and negotiation skills",
      "Willingness to travel for client meetings and trade events",
    ],
  },
  {
    id: 4,
    title:       "Operations Manager",
    department:  "Operations",
    type:        "Full-time",
    location:    "Shimla, HP",
    experience:  "3–6 Years",
    badge:       "Open",
    badgeCls:    "bg-green-50 text-green-700 border border-green-200",
    description: "Own the end-to-end execution of confirmed tours — from vendor coordination to on-trip customer support. You ensure every traveller experience matches what was promised at the point of sale, protecting our brand and reputation.",
    responsibilities: [
      "Coordinate with hotels, transporters, and guides to ensure seamless tour execution",
      "Manage last-minute changes, cancellations, and on-trip escalations",
      "Oversee documentation: vouchers, confirmations, and travel kits",
      "Monitor vendor quality and address service failures proactively",
      "Build and maintain relationships with key vendors across all active destinations",
    ],
    requirements: [
      "3–6 years in travel operations or tour management",
      "Strong vendor network in Himachal Pradesh preferred",
      "Calm under pressure with exceptional problem-solving skills",
      "Proficient in MS Office; experience with booking systems is a plus",
    ],
  },
];


// ─── Data ─────────────────────────────────────────────────────────────────────
export const FEATURED: FeaturedOffer[] = [
  {
    tag: "International Travel",
    title: "Annual International Tour Package",
    subtitle: "See the world — on us.",
    body:
      "Every year, Dreams Yatri sends its team on a fully company-sponsored international trip. Past destinations include Bali, Dubai, and Thailand. You help people travel the world — so should you.",
    image:
      "https://plus.unsplash.com/premium_photo-1697729914552-368899dc4757?w=900&q=80",
    stat: "1",
    statLabel: "Intl. trip / year",
  },
  {
    tag: "FAM Trips",
    title: "Familiarisation Tours Across India",
    subtitle: "Know what you sell, firsthand.",
    body:
      "Regularly scheduled FAM trips take our team to the destinations we sell — Kashmir, Rajasthan, Spiti, and more. These aren't leisure trips; they're how we build deep product knowledge and craft better experiences for our customers.",
    image:
      "https://images.unsplash.com/photo-1614591276564-7b3e69347a48?w=900&q=80",
    stat: "6+",
    statLabel: "FAM trips / year",
  },
];

export const OFFERS: Offer[] = [
  {
    icon: TrendingUp,
    title: "Merit-Based Growth",
    desc: "Fast-track promotions tied to impact, not tenure. At an early-stage company, your contributions are noticed quickly.",
    accent: "text-violet-600",
    bg: "bg-violet-50 border-violet-100",
  },
  {
    icon: Gift,
    title: "Employee Travel Discounts",
    desc: "Enjoy exclusive discounts on personal bookings — for you, your family, and your friends — on all our packages.",
    accent: "text-pink-600",
    bg: "bg-pink-50 border-pink-100",
  },
  {
    icon: ShieldCheck,
    title: "Stable Salary + Incentives",
    desc: "Competitive fixed pay with performance incentives. Sales roles come with uncapped earning potential.",
    accent: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-100",
  },
  {
    icon: Coffee,
    title: "Collaborative Environment",
    desc: "A small, focused team where ideas are welcomed. No bureaucracy — just good people doing meaningful work together.",
    accent: "text-amber-600",
    bg: "bg-amber-50 border-amber-100",
  },
  {
    icon: Zap,
    title: "Direct Impact",
    desc: "Every person on the team directly shapes company outcomes. Your work is never invisible here.",
    accent: "text-sky-600",
    bg: "bg-sky-50 border-sky-100",
  },
  {
    icon: MapPin,
    title: "Work From Shimla",
    desc: "Our headquarters is in one of India's most beautiful hill stations — fresh air, mountain views, and a great quality of life.",
    accent: "text-red-600",
    bg: "bg-red-50 border-red-100",
  },
];



// ─── Types ────────────────────────────────────────────────────────────────────
type GalleryItem = {
  src: string;
  alt: string;
  caption: string;
  span?: "col" | "row" | "both" | "none";
};

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  initials: string;
  color: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────
export const GALLERY: GalleryItem[] = [
  {
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900&q=80",
    alt: "Team collaboration",
    caption: "Strategy sessions that actually get things done",
    span: "col",
  },
  {
    src: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80",
    alt: "Team at work",
    caption: "A culture of focus and ownership",
    span: "none",
  },
  {
    src: "https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80",
    alt: "Office moments",
    caption: "Good vibes, always",
    span: "none",
  },
  {
    src: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=900&q=80",
    alt: "FAM Trip - Beach",
    caption: "FAM trip — Bali 2024",
    span: "col",
  },
  {
    src: "https://images.unsplash.com/photo-1506461883276-594a12b11cf3?w=900&q=80",
    alt: "FAM Trips to employees",
    caption: "FAM Trips to our team",
    span: "none",
  },
  {
    src: "https://plus.unsplash.com/premium_photo-1663075847012-c781e0d194ce?w=800&q=80",
    alt: "Monthly Training",
    caption: "Monthly training sessions to upskill our team",
    span: "none",
  },
  {
    src: "https://plus.unsplash.com/premium_photo-1734658702777-8b770b41d753?w=800&q=80",
    alt: "Office celebration",
    caption: "Celebrating our team's achievements",
    span: "none",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I joined as a travel executive and within 8 months I was leading my own destination vertical. The growth here is real — if you put in the work, it shows.",
    name: "Priya S.",
    role: "Destination Lead – Kashmir",
    initials: "PS",
    color: "bg-red-100 text-red-600",
  },
  {
    quote:
      "The FAM trips are genuinely one of the best perks I've ever had. I've now been to Spiti, Rajasthan, and Goa — all while doing my job better.",
    name: "Arjun M.",
    role: "Senior Sales Executive",
    initials: "AM",
    color: "bg-violet-100 text-violet-600",
  },
  {
    quote:
      "Working from Shimla is a different experience altogether. The pace, the views, the team — it's a work environment I never want to leave.",
    name: "Kavya T.",
    role: "Operations Manager",
    initials: "KT",
    color: "bg-emerald-100 text-emerald-600",
  },
];


export const CULTURE_POINTS = [
  { label: "Ownership over hierarchy", icon: Trophy },
  { label: "Transparent communication", icon: MessageCircle },
  { label: "Travel-first mindset", icon: Plane },
  { label: "No-nonsense hiring", icon: Zap },
];