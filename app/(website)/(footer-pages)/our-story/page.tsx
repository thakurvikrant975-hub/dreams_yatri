"use client";

import { useEffect, useRef, useState } from "react";
import {
    MapPin, Compass, Heart, Users, Star, Zap,
    Mountain, Sunrise, Navigation, Quote, ArrowRight,
    Phone, Shield, Smile, Globe, CheckCircle, Plane
} from "lucide-react";
import { PageHero } from "../components/PageHero";
import { SectionHeading } from "../components/SectionHeading";
import Link from "next/link";
import OurJourneyTimeline from "../about/TimelineSection";
import { ValuesSection } from "./Valuessection";
import VisionSection from "./Visionsection";

// ── Intersection observer hook for scroll reveals ─────────────────────────────
function useInView(threshold = 0.15) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, inView };
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
    const [val, setVal] = useState(0);
    const { ref, inView } = useInView(0.3);
    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const step = Math.ceil(to / 60);
        const t = setInterval(() => {
            start += step;
            if (start >= to) { setVal(to); clearInterval(t); } else setVal(start);
        }, 24);
        return () => clearInterval(t);
    }, [inView, to]);
    return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Reveal wrapper ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
    const { ref, inView } = useInView();
    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(32px)",
                transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
            }}
        >
            {children}
        </div>
    );
}

export default function OurStoryPage() {
    const [activeYear, setActiveYear] = useState(0);

    return (
        <div className="bg-white text-gray-900 overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap" rel="stylesheet" />

            {/* ── HERO ─────────────────────────────────────────────────────────── */}
            <PageHero
                badge="Our Story · Since 2019"
                headingLine1="We Didn't Start a Company."
                headingHighlight="We Solved a Problem."
                subheading="Want to know why?."
                ctaLabel="Read Our Story"
                ctaHref="#story"
            />

            {/* ── FOUNDER STORY ────────────────────────────────────────────────── */}
            <section id="story" className="py-24 sm:py-32 bg-white">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">

                    <div className="grid lg:grid-cols-2 gap-16 items-start">

                        {/* Left — visual */}
                        <Reveal className="relative">
                            {/* Large quote card */}
                            <div className="relative bg-gray-950 rounded-3xl p-8 sm:p-10 overflow-hidden">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/10 rounded-full blur-3xl" />
                                <Quote size={40} className="text-red-500 mb-6 opacity-80" />
                                <p className="text-white text-xl sm:text-2xl leading-relaxed font-medium mb-6"
                                    style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>
                                    "I always loved to travel. The spontaneity, the new faces, the food you can't find anywhere else. But every trip came with a shadow — the anxiety of logistics in an unfamiliar place."
                                </p>
                                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 font-bold text-sm">V</div>
                                    <div>
                                        <p className="text-white font-semibold text-sm">Vikrant Thakur</p>
                                        <p className="text-gray-500 text-xs">Founder, Dreams Yatri</p>
                                    </div>
                                </div>
                            </div>

                            {/* Floating stat pill */}
                            <div className="absolute -bottom-5 -right-4 bg-red-500 text-white rounded-2xl px-5 py-3 shadow-xl shadow-red-500/30">
                                <p className="text-2xl font-extrabold leading-none">10K+</p>
                                <p className="text-xs text-red-100 mt-0.5">Trips Delivered</p>
                            </div>

                            {/* Shimla tag */}
                            <div className="absolute -top-4 -left-3 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-lg flex items-center gap-2">
                                <MapPin size={13} className="text-red-500" />
                                <span className="text-xs font-semibold text-gray-700">Shimla, Himachal Pradesh</span>
                            </div>
                        </Reveal>

                        {/* Right — text narrative */}
                        <div className="flex flex-col gap-8">
                            <Reveal delay={100}>
                                <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-4">The Origin Story</p>
                                <SectionHeading
                                    text="One night in Manali."
                                    highlight="Midnight. 3% battery."
                                    highlightPosition="suffix"
                                    variant="light"
                                />
                            </Reveal>

                            <Reveal delay={150}>
                                <div className="relative border-l-2 border-red-100 pl-6">
                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                                    <p className="text-gray-600 text-base leading-relaxed">
                                        Vikrant Thakur landed in Manali at midnight. Hotel unconfirmed. Cab not responding. Phone on 3%. Standing in the cold, surrounded by strangers — he asked himself why something he loved felt like punishment.
                                    </p>
                                </div>
                            </Reveal>

                            <Reveal delay={250}>
                                <div className="relative border-l-2 border-red-100 pl-6">
                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-red-100" />
                                    <p className="text-gray-600 text-base leading-relaxed">
                                        Dreams Yatri was born not from a business plan, but from a personal promise: <em className="text-gray-800 not-italic font-semibold">nobody who books with us will ever stand in the cold wondering what to do next.</em>
                                    </p>
                                </div>
                            </Reveal>

                            <Reveal delay={300}>
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 mt-2">
                                    <p className="text-gray-700 text-sm leading-relaxed">
                                        <span className="font-bold text-gray-900">Based in Shimla, Himachal Pradesh</span> — we understand the mountains, the roads, and the people better than anyone. That local depth is our unfair advantage.
                                    </p>
                                </div>
                            </Reveal>
                        </div>
                    </div>
                </div>
            </section>




            {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
      <OurJourneyTimeline />
      <ValuesSection />
      <VisionSection />



            {/* ── TEAM TEASER ──────────────────────────────────────────────────── */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-7xl mx-auto px-6 sm:px-8">
                    <div className="bg-gray-950 rounded-3xl overflow-hidden">
                        <div className="grid md:grid-cols-2 gap-0">

                            {/* Left text */}
                            <Reveal className="p-10 sm:p-14 flex flex-col justify-center relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
                                <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-4">The People</p>
                                <SectionHeading
                                    text="A team of travellers who happen to run a"
                                    highlight="Travel Company"
                                    highlightPosition="suffix"
                                    variant="dark"
                                />

                                <p className="text-gray-400 text-base leading-relaxed mb-8">
                                    Everyone at Dreams Yatri has stood at a bus stop in an unfamiliar city, eaten street food they couldn't name, and slept in a hotel room with a view worth the entire trip. That's our hiring criteria.
                                </p>
                                <Link href="/careers"
                                    className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors w-fit"
                                    style={{ boxShadow: "0 4px 16px rgba(239,68,68,0.3)" }}>
                                    Join the Team <ArrowRight size={15} />
                                </Link>
                            </Reveal>

                            {/* Right — decorative grid of destination cards */}
<div className="p-8 grid grid-cols-2 gap-3 content-center">
  {[
    {
      dest: "Shimla",
      tag: "HQ",
      image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=300&fit=crop&auto=format",
    },
    {
      dest: "Kashmir",
      tag: "Top Pick",
      image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&auto=format",
    },
    {
      dest: "Rajasthan",
      tag: "Heritage",
      image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=400&h=300&fit=crop&auto=format",
    },
    {
      dest: "Dubai",
      tag: "International",
      image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=300&fit=crop&auto=format",
    },
  ].map((d, i) => (
    <Reveal
      key={i}
      delay={i * 80}
      className="relative rounded-2xl overflow-hidden min-h-[120px] flex flex-col justify-between cursor-default group"
    >
      {/* Background image */}
      <img
        src={d.image}
        alt={d.dest}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        loading="lazy"
        draggable={false}
      />

      {/* Dark gradient overlay — stronger at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

      {/* Border shimmer on hover */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10 group-hover:ring-white/25 transition-all duration-300" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-4">
        <span className="text-[10px] font-bold text-white/50 tracking-widest uppercase">
          {d.tag}
        </span>
        <div>
          <p className="text-white font-bold text-base leading-tight">{d.dest}</p>
          <div className="flex mt-1.5 gap-0.5">
            {[...Array(5)].map((_, j) => (
              <Star key={j} size={10} fill="#EF4444" stroke="none" />
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  ))}
</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Animations ───────────────────────────────────────────────────── */}
            <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
        </div>
    );
}