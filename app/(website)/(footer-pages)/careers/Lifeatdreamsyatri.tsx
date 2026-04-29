"use client";

import Image from "next/image";
import { Reveal } from "../components/Reveal";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import { Quote } from "lucide-react";

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
const GALLERY: GalleryItem[] = [
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
    src: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900&q=80",
    alt: "FAM Trip - Rajasthan",
    caption: "FAM trip — Jaipur, Rajasthan",
    span: "none",
  },
  {
    src: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=80",
    alt: "Team celebration",
    caption: "We celebrate every win — big or small",
    span: "none",
  },
];

const TESTIMONIALS: Testimonial[] = [
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

const CULTURE_POINTS = [
  { label: "Ownership over hierarchy", icon: "🏆" },
  { label: "Transparent communication", icon: "💬" },
  { label: "Travel-first mindset", icon: "✈️" },
  { label: "No-nonsense hiring", icon: "⚡" },
];

// ─── Gallery Grid ─────────────────────────────────────────────────────────────
function GalleryGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
      {GALLERY.map((item, i) => (
        <div
          key={i}
          className={`
            relative overflow-hidden rounded-2xl group
            ${item.span === "col" ? "md:col-span-2" : ""}
            ${item.span === "row" ? "md:row-span-2" : ""}
            ${item.span === "both" ? "md:col-span-2 md:row-span-2" : ""}
          `}
          style={{ aspectRatio: item.span === "col" ? "16/7" : "4/3" }}
        >
          <Image
            src={item.src}
            alt={item.alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent
                          opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
          {/* Caption */}
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0
                          group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <p
              className="text-white text-[12px] font-semibold leading-snug"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {item.caption}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────
function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <div className="relative bg-white border border-gray-100 rounded-2xl p-7 shadow-sm
                    hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
      {/* Quote icon */}
      <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center mb-5">
        <Quote size={14} className="text-red-400" />
      </div>

      <p
        className="text-gray-600 text-[13.5px] leading-relaxed mb-6 italic"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        "{item.quote}"
      </p>

      {/* Author */}
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${item.color}`}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {item.initials}
        </div>
        <div>
          <p
            className="text-[13px] font-bold text-gray-900"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {item.name}
          </p>
          <p
            className="text-[11px] text-gray-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {item.role}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LifeAtDreamsYatri() {
  return (
    <section className="py-24 border-t border-gray-100">

      {/* Header */}
      <Reveal className="text-center mb-16">
        <SectionLabel>Inside the Team</SectionLabel>
        <SectionHeading
          text="Life at "
          highlight="Dreams Yatri"
          highlightPosition="suffix"
          variant="light"
        />
        <p
          className="text-gray-400 text-[13.5px] mt-4 max-w-lg mx-auto leading-relaxed"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          We work hard, travel often, and genuinely enjoy what we do.
          Here's a glimpse into our everyday life.
        </p>
      </Reveal>

      {/* Photo Gallery */}
      <Reveal className="mb-20">
        <GalleryGrid />
      </Reveal>

      {/* Culture Pillars */}
      <Reveal className="mb-20">
        <div className="bg-gray-950 rounded-3xl p-8 sm:p-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Heading block */}
            <div className="lg:col-span-1 flex flex-col justify-center">
              <p
                className="text-[10px] font-bold tracking-[0.2em] uppercase text-red-400 mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Our Culture
              </p>
              <h3
                className="text-white font-extrabold leading-snug"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
                }}
              >
                What makes us different
              </h3>
            </div>

            {/* Culture points */}
            {CULTURE_POINTS.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4"
              >
                <span className="text-2xl">{p.icon}</span>
                <p
                  className="text-white font-semibold text-sm leading-snug"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {p.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Team Voices */}
      <Reveal className="mb-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-gray-100" />
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Team Voices
          </p>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTIMONIALS.map((item, i) => (
            <TestimonialCard key={i} item={item} />
          ))}
        </div>
      </Reveal>

    </section>
  );
}