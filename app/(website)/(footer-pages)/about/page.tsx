"use client"

import { useState, useEffect, useRef } from "react";
import {
  Plane, MapPin, Hotel, Car, Compass, HeartHandshake,
  Clock, ShieldCheck, Star, ArrowRight, Quote,
  Camera, CheckCircle2, PhoneCall,
  Sparkles, Globe, TrendingUp, ChevronLeft, ChevronRight,
  CalendarCheck, Headphones, Wallet, Mountain
} from "lucide-react";
import Image from "next/image";
import { services, timelineData, values, stats, testimonials, team } from "./data";
import { Gallery } from "./Gallery";
import { gallery } from "./data";
import { SectionHeading } from "../components/SectionHeading";
import { WhatWeBelieve } from "./Whatwebelieve";
import TestimonialSlider from "./TestimonialSlider";
import { OurStoryHero } from "./Ourstoryhero";
import Link from "next/link";
import { TeamSection } from "./TeamSection";
import OurJourneyTimeline from "./TimelineSection";
import Card from "@/app/components/ui/Card";
import { OriginSection } from "./OriginSection";

const useInView = (threshold = 0.12) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
};

const Reveal = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.65s cubic-bezier(.4,0,.2,1) ${delay}s, transform 0.65s cubic-bezier(.4,0,.2,1) ${delay}s`,
    }}>{children}</div>
  );
};



function SectionLabel({ children }:{ children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-0.5 bg-red-500" />
      <span className="text-red-500 text-xs font-bold uppercase tracking-widest">{children}</span>
    </div>
  );
}



export default function AboutPage() {
  return (
    <div className="bg-white" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <OurStoryHero />
      <OriginSection />



{/* ══ 3. YOU TRAVEL. WE MANAGE. ══ */}
<section
  className="relative py-28 px-6 bg-white overflow-hidden"
  aria-labelledby="services-heading"
>
  {/* Subtle background texture */}
  <div
    className="absolute inset-0 opacity-[0.03] pointer-events-none"
    style={{
      backgroundImage: `radial-gradient(circle at 1px 1px, #FB2B37 1px, transparent 0)`,
      backgroundSize: "40px 40px",
    }}
    aria-hidden="true"
  />

  <div className="max-w-7xl mx-auto relative z-10">

    {/* ── Header Block ─────────────────────────────────────── */}
    <Reveal>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-20 gap-8">
        <div>
          <SectionLabel>What We Do</SectionLabel>
            <SectionHeading
                text="You travel and we"
                highlight="Manage"
                highlightPosition="suffix"
                variant="light"
              />
        </div>
        <p className="text-gray-500 max-w-md leading-relaxed lg:text-right">
          Every detail that keeps you up at night before a trip — hotels, cabs,
          activities, emergencies — consider it handled.
        </p>
      </div>
    </Reveal>

    {/* ── Hero Feature Card (top full-width) ──────────────── */}
    <Reveal>
      <div className="relative rounded-3xl overflow-hidden mb-5 group h-[380px] md:h-[460px]">
        <Image
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=85"
          alt="Dreams Yatri travel packages — scenic road trip through mountains with happy travellers"
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out"
          sizes="(max-width: 768px) 100vw, 1200px"
          priority
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/80 via-gray-950/40 to-transparent" />

        {/* Text overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
          <p className="text-rose-400 text-sm font-semibold uppercase tracking-widest mb-3">
            End-to-End Travel Management
          </p>
          <h3 className="text-white text-3xl md:text-4xl font-bold max-w-lg leading-tight">
            One call. Every detail sorted before you land.
          </h3>
          <p className="text-gray-300 text-base mt-3 max-w-md">
            From the moment you enquire to the moment you return — Dreams Yatri
            handles every moving part of your trip.
          </p>
        </div>

        {/* Trust badge */}
        <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-center">
          <p className="text-white text-2xl font-bold leading-none">5000+</p>
          <p className="text-gray-300 text-xs mt-1">Happy Travellers</p>
        </div>
      </div>
    </Reveal>

    {/* ── 6-Card Service Grid ──────────────────────────────── */}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {services.map(({ Icon, title, desc, color, bg, border, image, imageAlt }, i) => (
        <Reveal key={i} delay={i * 0.07}>
          <Card
            className={`group rounded-2xl border ${border} overflow-hidden hover:shadow-xl transition-all duration-500 h-full flex flex-col shadow-lg border-gray-200`}
          >
            {/* Card Image */}
            <div className="relative h-44">
              <Image
                src={image}
                alt={imageAlt}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                loading={i < 3 ? "eager" : "lazy"}
              />
              {/* Subtle tint overlay matching card color */}
              <div className={`absolute inset-0 ${bg} opacity-10 group-hover:opacity-10 transition-opacity duration-500`} />

              {/* Icon badge floating on image */}
              <div className="absolute bottom-0 left-5 translate-y-1/2 z-50">
                <div className={`w-12 h-12 rounded-xl ${bg} border-2 ${border} flex items-center justify-center shadow-md z-50`}>
                  <Icon size={20} className={color} />
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-6 pt-10 flex flex-col flex-1">
              <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed flex-1">{desc}</p>
              <div className={`mt-4 h-0.5 w-8 ${bg} rounded-full border ${border} group-hover:w-16 transition-all duration-500`} />
            </div>
          </Card>
        </Reveal>
      ))}
    </div>

    {/* ── Bottom Stats Row ─────────────────────────────────── */}
    <Reveal delay={0.3}>
      <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100">
        {[
          { value: "12+", label: "Destinations Covered" },
          { value: "5000+", label: "Trips Completed" },
          { value: "4.8★", label: "Average Rating" },
          { value: "24/7", label: "Support Available" },
        ].map(({ value, label }) => (
          <div
            key={label}
            className="bg-white py-8 px-6 text-center hover:bg-rose-50 transition-colors duration-300"
          >
            <p className="text-3xl font-bold text-[#FB2B37]">{value}</p>
            <p className="text-gray-500 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>
    </Reveal>

  </div>
</section>

      {/* ══ 4. PHOTO GALLERY ══ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>Moments We've Made</SectionLabel>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-12 gap-4">

              <SectionHeading
                text="Trips That"
                highlight="Became Stories"
                highlightPosition="suffix"
                variant="light"
              />
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Camera size={16} className="text-red-400" />
                <span>Real trips. Real travelers. Real memories.</span>
              </div>
            </div>
          </Reveal>
          <Gallery gallery={gallery} perView={3} />
        </div>
      </section>

      <OurJourneyTimeline />

      <WhatWeBelieve
        label="Our Philosophy"
        title="The principles we"
        highlight="never compromise on"
        subtitle="These aren't values on a wall..."
      />

      {/* ══ 7. TESTIMONIALS ══ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>Traveler Stories</SectionLabel>
            <SectionHeading
              text="Don't Take Our"
              highlight="Word For It"
              highlightPosition="suffix"
              variant="light"
            />
          </Reveal>
          <TestimonialSlider
            items={testimonials}   // TestimonialItem[]
            perView={3}            // cards visible at once
            autoplay={5000}        // ms, 0 = off
            label="What Travellers Say"
            heading="Real trips."
            headingHighlight="Real stories."
          />
        </div>
      </section>

    <TeamSection />

      {/* ══ 9. CTA — WHITE CARD matching footer ══ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="grid lg:grid-cols-2">

                {/* Left — red */}
                {/* Left — image with red overlay */}
                <div className="relative lg:col-span-1 flex flex-col justify-between overflow-hidden min-h-[340px]">

                  {/* Background Image */}
                  <img
                    src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80"
                    alt="Mountain travel destination"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                  />

                  {/* Red gradient overlay — maintains brand color while keeping image visible */}
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-400/20 via-slate-300/15 to-slate-500/20" />
                  {/* Decorative blobs — keep your existing ones */}
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-slate-400 rounded-full opacity-20 pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-slate-600 rounded-full opacity-20 pointer-events-none" />

                  {/* Content */}
                  <div className="relative p-10 sm:p-12 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center gap-2 mb-6">
                        <Plane size={18} className="text-black" />
                        <span className="text-black text-xs font-bold uppercase tracking-widest">Ready to go?</span>
                      </div>
                      <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
                        Your Next Trip,<br />Zero Tension.
                      </h3>
                      <p className="text-white leading-relaxed text-[15px]">
                        Hotels confirmed. Cabs arranged. Activities booked. You just show up and enjoy.
                      </p>
                    </div>
                    <div className="mt-8 flex flex-wrap gap-2">
                      {["No hidden fees", "Free consultation", "24/7 support"].map((t, i) => (
                        <div key={i} className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3.5 py-1.5">
                          <CheckCircle2 size={13} className="text-white" />
                          <span className="text-white text-xs font-medium">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right — white */}
                <div className="bg-white p-10 sm:p-12 flex flex-col justify-center">
                  <h4 className="text-2xl font-black text-gray-900 mb-2" >Start Planning Today</h4>
                  <p className="text-gray-500 text-sm mb-8 leading-relaxed">Tell us where you want to go and when. Our travel experts will put together a complete, personalised plan — no commitment needed.</p>
                  <div className="space-y-4 mb-8">
                    {[
                      { Icon: MapPin, text: "200+ destinations worldwide" },
                      { Icon: Clock, text: "Plan delivered within 24 hours" },
                      { Icon: HeartHandshake, text: "Dedicated travel manager assigned" },
                    ].map(({ Icon, text }, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Icon size={15} className="text-red-500" />
                        </div>
                        <span className="text-gray-700 text-sm">{text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button className="flex-1 inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-md shadow-red-100 text-sm cursor-pointer">
                      <Plane size={15} /> Plan My Trip
                    </button>
                    <button className="flex-1 inline-flex bg-gray-900 hover:bg-gray-950 items-center justify-center gap-2 border border-gray-200 hover:border-red-300 text-white font-semibold px-6 py-3.5 rounded-full transition-all text-sm cursor-pointer hover:scale-[1.02]">
                      <PhoneCall size={15} /> Talk to Expert
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

    </div>
  );
}