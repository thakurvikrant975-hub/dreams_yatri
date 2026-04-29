"use client";

import Image from "next/image";
import { Reveal } from "../components/Reveal";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import Card from "@/app/components/ui/Card";
import { OFFERS, FEATURED } from "./data";

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function FeaturedCard({ item, reverse }: { item: FeaturedOffer; reverse?: boolean }) {
  return (
    <Reveal>
      <Card
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
            >
              {item.stat}
            </p>
            <p
              className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5"
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
            >
              {item.tag}
            </span>
          </div>

          <h3
            className="text-gray-900 font-extrabold leading-tight mb-2"
            style={{
              fontSize: "clamp(1.3rem, 2.5vw, 1.75rem)",
            }}
          >
            {item.title}
          </h3>
          <p
            className="text-red-400 font-semibold text-sm mb-4 italic"
          >
            {item.subtitle}
          </p>
          <p
            className="text-gray-500 text-[13.5px] leading-relaxed max-w-md"
          >
            {item.body}
          </p>

          {/* Decorative corner accent */}
          <div className="absolute top-6 right-6 w-16 h-16 rounded-2xl bg-red-500/5 border border-red-100 flex items-center justify-center">
            <Plane size={20} className="text-red-300 rotate-45" />
          </div>
        </div>
      </Card>
    </Reveal>
  );
}

function OfferCard({ item }: { item: Offer }) {
  const Icon = item.icon;
  return (
    <Card
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
      >
        {item.title}
      </h4>
      <p
        className="text-gray-500 text-[13px] leading-relaxed"
      >
        {item.desc}
      </p>
    </Card>
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