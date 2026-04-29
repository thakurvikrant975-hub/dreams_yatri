import { Globe, TrendingUp, Users, Heart } from "lucide-react";
import { LucideIcon } from "lucide-react";

type Perk = {
  icon: LucideIcon;
  title: string;
  desc: string;
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

