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

// ── Data ──────────────────────────────────────────────────────────────────────
const TIMELINE = [
    { year: "2019", icon: <Mountain size={16} />, title: "The Midnight That Changed Everything", body: "Stranded in Manali at midnight — hotel unconfirmed, cab missing, phone at 3%. That moment of helpless cold became the spark for everything." },
    { year: "2020", icon: <Zap size={16} />, title: "Built in Lockdown", body: "While the world paused, Vikrant mapped out every friction point in travel. Vendor networks, pricing models, backup protocols — the blueprint took shape." },
    { year: "2021", icon: <Users size={16} />, title: "First 100 Travellers", body: "Word of mouth carried us further than any ad. Hundred families explored Himachal Pradesh with zero logistics anxiety — that was the proof of concept." },
    { year: "2022", icon: <Globe size={16} />, title: "Expanding the Map", body: "Kashmir, Rajasthan, Uttarakhand, Goa — each destination added with the same obsession: can we make this completely worry-free?" },
    { year: "2023", icon: <Plane size={16} />, title: "Going International", body: "Dubai and Thailand joined the portfolio. 10,000+ travellers had trusted us by year-end. The team grew to match the ambition." },
    { year: "2024+", icon: <Star size={16} />, title: "The Vision Scales", body: "50+ destinations. A platform in the making. And the same promise we made in 2021: you travel, we handle everything else." },
];

const VALUES = [
    { icon: <Shield size={22} />, title: "Zero Surprises", body: "Every hotel, cab, and activity is confirmed before you depart. If something changes, we fix it — not you." },
    { icon: <Phone size={22} />, title: "Always Reachable", body: "Day or night, our team is a call away. Emergencies don't keep business hours, and neither do we." },
    { icon: <Heart size={22} />, title: "Made Personal", body: "Cookie-cutter packages don't exist here. Every trip is shaped around your pace, your preferences, your people." },
    { icon: <Smile size={22} />, title: "Joy is the Metric", body: "We don't measure success in bookings. We measure it in 'I can't wait to go back.'" },
    { icon: <Navigation size={22} />, title: "Local Depth", body: "We don't Google your destination. Our vendor network means you eat where locals eat and sleep where views are real." },
    { icon: <CheckCircle size={22} />, title: "Honest Pricing", body: "No hidden charges. No bait-and-switch. The price you see is the price you pay — with a full cost breakdown." },
];

const STATS = [
    { value: 10000, suffix: "+", label: "Happy Travellers" },
    { value: 50, suffix: "+", label: "Destinations" },
    { value: 98, suffix: "%", label: "Satisfaction Rate" },
    { value: 5, suffix: "+", label: "Years of Journeys" },
];

// ─────────────────────────────────────────────────────────────────────────────

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


            {/* ── VISION ───────────────────────────────────────────────────────── */}
            <section id="vision" className="py-24 sm:py-32 bg-white">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">

                    <Reveal className="text-center mb-20 max-w-2xl mx-auto">
                        <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-4">Our Vision</p>
                        <SectionHeading
                            text="Travel should feel like freedom"
                            highlight="not a second job."
                            highlightPosition="suffix"
                            variant="light"
                        />

                        <p className="text-gray-500 text-base leading-relaxed">
                            We exist so that every traveller — first-timer or seasoned explorer — can be fully present in the moment they've been looking forward to, without a single logistics worry clouding it.
                        </p>
                    </Reveal>

                    {/* Vision pillars — asymmetric layout */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Big left card */}
                        <Reveal delay={0} className="md:col-span-2 bg-gray-950 rounded-3xl p-8 sm:p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/15 transition-all duration-700" />
                            <Sunrise size={36} className="text-red-500 mb-6" />
                            <h3 className="text-white text-2xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                                A world where you show up and just… enjoy.
                            </h3>
                            <p className="text-gray-400 text-base leading-relaxed max-w-lg">
                                Our vision is a travel experience so seamlessly organised that the only decision you make on the road is what to eat next. Hotels confirmed. Cabs waiting. Guides briefed. Every variable accounted for before you board your flight.
                            </p>
                            <div className="mt-8 flex flex-wrap gap-3">
                                {["Pre-confirmed stays", "24/7 on-trip support", "Zero hidden costs", "Backup plans always ready"].map((t, i) => (
                                    <span key={i} className="text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full">{t}</span>
                                ))}
                            </div>
                        </Reveal>

                        {/* Right column — two stacked cards */}
                        <div className="flex flex-col gap-6">
                            <Reveal delay={100} className="bg-red-500 rounded-3xl p-7 relative overflow-hidden group">
                                <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
                                <Heart size={28} className="text-white mb-4" />
                                <h3 className="text-white text-lg font-bold mb-2">Designed for Joy</h3>
                                <p className="text-red-100 text-sm leading-relaxed">
                                    Every package is engineered backwards from the feeling we want you to have — not from what's cheapest to operate.
                                </p>
                            </Reveal>

                            <Reveal delay={160} className="bg-gray-50 border border-gray-200 rounded-3xl p-7">
                                <Compass size={28} className="text-gray-900 mb-4" />
                                <h3 className="text-gray-900 text-lg font-bold mb-2">Rooted in India</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    From Shimla's misty ridges to Rajasthan's golden deserts — we know these places because we live them.
                                </p>
                            </Reveal>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── TIMELINE ─────────────────────────────────────────────────────── */}
            <section className="py-24 sm:py-32 bg-gray-50">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">

                    <Reveal className="text-center mb-16">
                        <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-4">Our Journey</p>
                        <SectionHeading
                            text="From a cold midnight to"
                            highlight="10,000+ journeys."
                            highlightPosition="suffix"
                            variant="light"
                        />
                    </Reveal>

                    {/* Timeline — desktop: alternating; mobile: left-aligned */}
                    <div className="relative">
                        {/* Vertical line */}
                        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2" />

                        <div className="flex flex-col gap-0">
                            {TIMELINE.map((item, i) => {
                                const isLeft = i % 2 === 0;
                                return (
                                    <Reveal key={i} delay={i * 60}>
                                        <div className={`relative flex items-start gap-6 md:gap-0 py-8 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}`}>

                                            {/* Content box */}
                                            <div className={`flex-1 md:max-w-[calc(50%-40px)] ${isLeft ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
                                                <button
                                                    onClick={() => setActiveYear(activeYear === i ? -1 : i)}
                                                    className="w-full text-left md:text-inherit group"
                                                >
                                                    <div className={`bg-white border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:border-red-200 cursor-pointer ${activeYear === i ? "border-red-300 shadow-md shadow-red-500/10" : "border-gray-200"} ${isLeft ? "md:ml-auto" : ""}`}>
                                                        <div className={`flex items-center gap-3 mb-3 ${isLeft ? "md:justify-end" : ""}`}>
                                                            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-500 border border-red-100 text-xs font-bold px-3 py-1 rounded-full">
                                                                {item.icon} {item.year}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-gray-900 font-bold text-base mb-2">{item.title}</h3>
                                                        <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
                                                    </div>
                                                </button>
                                            </div>

                                            {/* Centre dot */}
                                            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                                <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${activeYear === i ? "bg-red-500 border-red-500 scale-125" : "bg-white border-gray-300"}`} />
                                            </div>

                                            {/* Mobile left dot */}
                                            <div className="md:hidden flex-shrink-0 mt-6">
                                                <div className={`w-3 h-3 rounded-full border-2 ${activeYear === i ? "bg-red-500 border-red-500" : "bg-white border-gray-300"}`} />
                                            </div>

                                            {/* Empty right side for alternation */}
                                            <div className="hidden md:block flex-1 md:max-w-[calc(50%-40px)]" />
                                        </div>
                                    </Reveal>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── VALUES ───────────────────────────────────────────────────────── */}
            <section className="py-24 sm:py-32 bg-white">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">

                    <Reveal className="text-center mb-16">
                        <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-4">What We Stand For</p>
                        <SectionHeading
                            text="The promises we "
                            highlight="don't break"
                            highlightPosition="suffix"
                            variant="light"
                        />
                    </Reveal>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {VALUES.map((v, i) => (
                            <Reveal key={i} delay={i * 60}
                                className="group border border-gray-200 hover:border-red-200 bg-white hover:bg-red-50/30 rounded-2xl p-7 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/5 cursor-default">
                                <div className="w-11 h-11 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-5 group-hover:bg-red-500 group-hover:text-white transition-colors duration-300">
                                    {v.icon}
                                </div>
                                <h3 className="text-gray-900 font-bold text-base mb-2">{v.title}</h3>
                                <p className="text-gray-500 text-sm leading-relaxed">{v.body}</p>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── TEAM TEASER ──────────────────────────────────────────────────── */}
            <section className="py-20 bg-gray-50">
                <div className="max-w-6xl mx-auto px-6 sm:px-8">
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