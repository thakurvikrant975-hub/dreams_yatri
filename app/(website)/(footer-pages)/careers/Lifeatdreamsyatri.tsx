"use client";

import Image from "next/image";
import { Reveal } from "../components/Reveal";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import { Quote } from "lucide-react";
import { CULTURE_POINTS, TESTIMONIALS, GALLERY } from "./data";
import Card from "@/app/components/ui/Card";
import { StarIcon } from "lucide-react";

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


function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <Card
      className="group relative flex flex-col overflow-hidden rounded-2xl border
                 border-gray-100 bg-white p-7 transition-all duration-200
                 hover:-translate-y-0.5 hover:border-gray-200"
      style={{ fontFamily: "'Figtree', sans-serif" }}
    >
      {/* Accent top stripe on hover */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: item.accent }}
      />

      {/* Decorative quote mark */}
      <span
        className="mb-3 block text-5xl leading-none select-none"
        style={{ color: item.accent, opacity: 0.22, fontFamily: "'DM Serif Display', serif" }}
      >
        "
      </span>

      {/* Stars */}
      <div className="mb-3 flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} className="text-yellow-400" />
        ))}
      </div>

      {/* Quote */}
      <p className="mb-6 flex-1 text-[14px] leading-relaxed text-gray-500">
        {item.quote}
      </p>

      {/* Divider */}
      <div className="mb-5 h-px bg-gray-100" />

      {/* Author row */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center
                     rounded-full text-xs font-semibold tracking-wide"
          style={{
            background: item.avatarBg,
            color: item.avatarText,
            border: `0.5px solid ${item.avatarBorder}`,
          }}
        >
          {item.initials}
        </div>

        <div className="flex-1">
          <p className="text-[13.5px] font-semibold text-gray-900">{item.name}</p>
          <p className="text-[11.5px] text-gray-400">
            {item.role} · {item.tenure}
          </p>
        </div>

        <span
          className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold tracking-wide"
          style={{
            background: item.badgeBg,
            color: item.badgeText,
            border: `0.5px solid ${item.badgeBorder}`,
          }}
        >
          {item.department}
        </span>
      </div>
    </Card>
  )
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
          <div className="grid sm:grid-cols-2 gap-6">
            {/* Heading block */}
            <div className="lg:col-span-1 flex flex-col justify-center">
              <p
                className="text-[10px] font-bold tracking-[0.2em] uppercase text-red-400 mb-3"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Our Culture
              </p>
              <SectionHeading
                text="What makes us"
                highlight="different"
                highlightPosition="suffix"
                variant="dark"
                level="h3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              {CULTURE_POINTS.map((p, i) => {
                const Icon = p.icon;

                return (
                  <div
                    key={i}
                    className="flex items-center w-full gap-4 bg-white/5 border border-white/10 rounded-2xl px-5 py-4"
                  >
                    <div className="flex items-center justify-center w-12 h-10 rounded-xl bg-white/10">
                      <Icon size={20} className="text-white/50" />
                    </div>

                    <p
                      className="text-white font-semibold text-sm leading-snug"
                    >
                      {p.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Team Voices */}
      <Reveal className="mb-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px flex-1 bg-red-100" />
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Team Voices
          </p>
          <div className="h-px flex-1 bg-red-100" />
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