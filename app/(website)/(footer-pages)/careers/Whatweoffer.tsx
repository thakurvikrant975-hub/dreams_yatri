"use client";

import Image from "next/image";
import { Reveal } from "../components/Reveal";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import {
  Plane,
  Globe,
  TrendingUp,
  ShieldCheck,
  Zap,
  Coffee,
  Gift,
  MapPin,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Offer = {
  icon: React.ElementType;
  title: string;
  desc: string;
  accent: string;
  bg: string;
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

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURED: FeaturedOffer[] = [
  {
    tag: "International Travel",
    title: "Annual International Tour Package",
    subtitle: "See the world — on us.",
    body:
      "Every year, Dreams Yatri sends its team on a fully company-sponsored international trip. Past destinations include Bali, Dubai, and Thailand. You help people travel the world — so should you.",
    image:
      "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=900&q=80",
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
      "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900&q=80",
    stat: "6+",
    statLabel: "FAM trips / year",
  },
];

const OFFERS: Offer[] = [
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeaturedCard({ item, reverse }: { item: FeaturedOffer; reverse?: boolean }) {
  return (
    <Reveal>
      <div
        className={`relative grid lg:grid-cols-2 gap-0 rounded-3xl overflow-hidden border border-gray-100 shadow-sm
          ${reverse ? "lg:[direction:rtl]" : ""}`}
      >
        {/* Image side */}
        <div className="relative h-64 lg:h-auto lg:[direction:ltr]">
          <Image
            src={item.image}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 50vw"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

          {/* Floating stat */}
          <div className="absolute bottom-5 left-5 bg-white/95 backdrop-blur rounded-2xl px-5 py-3 shadow-lg">
            <p
              className="text-2xl font-extrabold text-gray-900 leading-none"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {item.stat}
            </p>
            <p
              className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {item.statLabel}
            </p>
          </div>
        </div>

        {/* Content side */}
        <div
          className="relative bg-white px-8 py-10 sm:px-12 sm:py-14 flex flex-col justify-center lg:[direction:ltr]"
        >
          {/* Tag */}
          <div className="inline-flex items-center gap-2 mb-5 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-500"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {item.tag}
            </span>
          </div>

          <h3
            className="text-gray-900 font-extrabold leading-tight mb-2"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.3rem, 2.5vw, 1.75rem)",
            }}
          >
            {item.title}
          </h3>
          <p
            className="text-red-400 font-semibold text-sm mb-4 italic"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {item.subtitle}
          </p>
          <p
            className="text-gray-500 text-[13.5px] leading-relaxed max-w-md"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {item.body}
          </p>

          {/* Decorative corner accent */}
          <div className="absolute top-6 right-6 w-16 h-16 rounded-2xl bg-red-500/5 border border-red-100 flex items-center justify-center">
            <Plane size={20} className="text-red-300 rotate-45" />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function OfferCard({ item }: { item: Offer }) {
  const Icon = item.icon;
  return (
    <div
      className={`group relative rounded-2xl border p-6 transition-all duration-300
        hover:shadow-md hover:-translate-y-0.5 bg-white ${item.bg}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${item.bg}`}
      >
        <Icon size={18} className={item.accent} />
      </div>
      <h4
        className="text-gray-900 font-bold text-[15px] mb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {item.title}
      </h4>
      <p
        className="text-gray-500 text-[13px] leading-relaxed"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {item.desc}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WhatWeOffer() {
  return (
    <section className="py-24 border-t border-gray-100">
      {/* Header */}
      <Reveal className="text-center mb-16">
        <SectionLabel>Why Join Us</SectionLabel>
        <SectionHeading
          text="What We "
          highlight="Offer"
          highlightPosition="suffix"
          variant="light"
        />
        <p
          className="text-gray-400 text-[13.5px] mt-4 max-w-lg mx-auto leading-relaxed"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Beyond a paycheck — a career that takes you places, literally.
          Here's what being part of the Dreams Yatri family looks like.
        </p>
      </Reveal>

      {/* Featured Cards */}
      <div className="flex flex-col gap-6 mb-16">
        {FEATURED.map((item, i) => (
          <FeaturedCard key={i} item={item} reverse={i % 2 !== 0} />
        ))}
      </div>

      {/* Offer Grid */}
      <Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {OFFERS.map((item, i) => (
            <OfferCard key={i} item={item} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}