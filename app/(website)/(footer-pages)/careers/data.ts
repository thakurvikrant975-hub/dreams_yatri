import { Globe, TrendingUp, Users, Heart, Gift, ShieldCheck, Coffee, Zap, MapPin, Trophy, MessageCircle, Plane, Phone, Mail } from "lucide-react";

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
  quote: string
  name: string
  role: string
  tenure: string
  initials: string
  department: string
  accent: string
  avatarBg: string
  avatarText: string
  avatarBorder: string
  badgeBg: string
  badgeText: string
  badgeBorder: string
}

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
    department: "Growth",
    accent: "#D85A30",
    avatarBg: "#FAECE7",
    avatarText: "#993C1D",
    tenure: "8 months",
    avatarBorder: "#F5C4B3",
    badgeBg: "#FAECE7",
    badgeText: "#993C1D",
    badgeBorder: "#F5C4B3",
  },
  {
    quote:
      "The FAM trips are genuinely one of the best perks I've ever had. I've now been to Spiti, Rajasthan, and Goa — all while doing my job better.",
    name: "Arjun M.",
    role: "Senior Sales Executive",
    initials: "AM",
    department: "Sales",
    accent: "#7F77DD",
    avatarBg: "#EEEDFE",
    avatarText: "#534AB7",
    tenure: "8 months",
    avatarBorder: "#CECBF6",
    badgeBg: "#EEEDFE",
    badgeText: "#534AB7",
    badgeBorder: "#CECBF6",
  },
  {
    quote:
      "Working from Shimla is a different experience altogether. The pace, the views, the team — it's a work environment I never want to leave.",
    name: "Kavya T.",
    role: "Operations Manager",
    initials: "KT",
    department: "Operations",
    accent: "#1D9E75",
    avatarBg: "#E1F5EE",
    avatarText: "#0F6E56",
    tenure: "8 months",
    avatarBorder: "#9FE1CB",
    badgeBg: "#E1F5EE",
    badgeText: "#0F6E56",
    badgeBorder: "#9FE1CB",
  },
];


export const CULTURE_POINTS = [
  { label: "Ownership over hierarchy", icon: Trophy },
  { label: "Transparent communication", icon: MessageCircle },
  { label: "Travel-first mindset", icon: Plane },
  { label: "No-nonsense hiring", icon: Zap },
];


// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: number;
  index: string;
  title: string;
  department: Department;
  badge: string;
  badgeType: "urgent" | "featured" | "open";
  location: string;
  type: string;
  experience: string;
  openings: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
}

type Department = "Sales" | "Product" | "Growth" | "Operations" | "All";

// ─── Data ─────────────────────────────────────────────────────────────────────
export const OPENINGS: Job[] = [
  {
    id: 1,
    index: "01",
    title: "Senior Sales Executive",
    department: "Sales",
    badge: "Urgent",
    badgeType: "urgent",
    location: "Shimla, HP",
    type: "Full-time",
    experience: "3–5 yrs",
    openings: "2",
    description:
      "Drive revenue growth by building relationships with travel agents, corporate clients, and direct customers. You will be the face of Dreams Yatri in key markets, owning the full sales cycle from prospecting to closing.",
    responsibilities: [
      "Own and grow a portfolio of B2B and B2C accounts",
      "Conduct product demos and tailored pitches",
      "Achieve monthly and quarterly revenue targets",
      "Collaborate with operations to ensure smooth customer onboarding",
    ],
    requirements: [
      "3+ years in travel, hospitality, or B2B sales",
      "Strong network of travel agents or corporate contacts",
      "Excellent communication and negotiation skills",
      "Comfort with CRM tools and sales dashboards",
    ],
  },
  {
    id: 2,
    index: "02",
    title: "Product Manager — Booking Platform",
    department: "Product",
    badge: "Featured",
    badgeType: "featured",
    location: "Remote / Shimla",
    type: "Full-time",
    experience: "4–7 yrs",
    openings: "1",
    description:
      "Shape the core booking experience used by thousands of travellers each month. You will define the roadmap, work closely with engineering, and translate user research into high-impact product decisions.",
    responsibilities: [
      "Own end-to-end roadmap for the booking and payment flows",
      "Run discovery interviews and synthesise user feedback",
      "Write precise PRDs and coordinate with design + engineering",
      "Define and track KPIs — conversion, drop-off, NPS",
    ],
    requirements: [
      "4+ years as a PM at a consumer or travel product",
      "Strong analytical mindset; comfort with SQL or BI tools",
      "Experience with agile delivery and sprint rituals",
      "Bonus: prior work in fintech or marketplace products",
    ],
  },
  {
    id: 3,
    index: "03",
    title: "Growth Marketing Lead",
    department: "Growth",
    badge: "Open",
    badgeType: "open",
    location: "Remote",
    type: "Full-time",
    experience: "3–6 yrs",
    openings: "3",
    description:
      "Own acquisition, activation, and retention across digital channels. You will build experiments, manage paid budgets, and work with content and product to grow Dreams Yatri's customer base sustainably.",
    responsibilities: [
      "Lead performance marketing across Meta, Google, and programmatic",
      "Build and A/B test landing pages and onboarding flows",
      "Own the email/WhatsApp lifecycle programmes",
      "Report weekly on CAC, LTV, ROAS, and cohort retention",
    ],
    requirements: [
      "3+ years in growth or performance marketing",
      "Hands-on experience with attribution and analytics stacks",
      "Creative and data-driven in equal measure",
      "Experience in travel, e-commerce, or marketplace preferred",
    ],
  },
  {
    id: 4,
    index: "04",
    title: "Travel Operations Coordinator",
    department: "Operations",
    badge: "Open",
    badgeType: "open",
    location: "Shimla, HP",
    type: "Full-time",
    experience: "1–3 yrs",
    openings: "1",
    description:
      "Ensure every itinerary runs flawlessly from booking to completion. You will coordinate with hotels, vendors, guides, and customers — the operational backbone that makes memorable trips happen.",
    responsibilities: [
      "Confirm and manage vendor bookings and schedules",
      "Handle customer queries pre-, during, and post-trip",
      "Resolve on-ground escalations quickly and calmly",
      "Maintain accurate records in our operations system",
    ],
    requirements: [
      "1+ year in travel operations or hospitality coordination",
      "Strong organisational and multitasking skills",
      "Fluent in Hindi and English; regional language a plus",
      "Calm under pressure and highly detail-oriented",
    ],
  },
  {
    id: 5,
    index: "05",
    title: "Content & Social Media Manager",
    department: "Growth",
    badge: "Open",
    badgeType: "open",
    location: "Remote",
    type: "Full-time",
    experience: "2–4 yrs",
    openings: "3",
    description:
      "Tell the Dreams Yatri story across Instagram, YouTube, and beyond. You will create aspirational travel content, manage communities, and partner with influencers to grow a loyal audience.",
    responsibilities: [
      "Plan and produce short-form and long-form travel content",
      "Manage posting calendars across platforms",
      "Identify and brief travel creators for partnerships",
      "Track engagement, reach, and follower growth metrics",
    ],
    requirements: [
      "2+ years managing social media for a consumer brand",
      "Strong visual eye and video editing skills (Reels, Shorts)",
      "Experience with influencer outreach and briefs",
      "Passion for travel and authentic storytelling",
    ],
  },
  {
    id: 6,
    index: "06",
    title: "Finance & Compliance Analyst",
    department: "Operations",
    badge: "Open",
    badgeType: "open",
    location: "Shimla, HP",
    type: "Full-time",
    experience: "2–5 yrs",
    openings: "2",
    description:
      "Own financial reporting, cash flow tracking, and regulatory compliance for a fast-growing travel company. You will work directly with leadership to provide the financial clarity that drives sound decisions.",
    responsibilities: [
      "Prepare monthly P&L, balance sheet, and cash flow reports",
      "Monitor vendor payments and reconcile accounts",
      "Ensure GST and TCS compliance for travel services",
      "Support annual audits and fundraising data requests",
    ],
    requirements: [
      "2+ years in finance, accounting, or CA articleship",
      "Proficient in Tally or similar accounting software",
      "Knowledge of GST regulations in the travel sector",
      "High integrity and meticulous attention to detail",
    ],
  },
];
export const CONTACTS = [
  {
    href: "mailto:hr@dreamsyatri.com",
    label: "Email HR",
    value: "hr@dreamsyatri.com",
    icon: Mail,
  },
  {
    href: "tel:+917023907023",
    label: "Primary",
    value: "+91 70239 07023",
    icon: Phone,
  },
  {
    href: "tel:+917023907099",
    label: "Alternate",
    value: "+91 70239 07099",
    icon: Phone,
  },
];