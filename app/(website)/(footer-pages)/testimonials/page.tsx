"use client";

import { useState, useEffect, useRef } from "react";
import { Star, Quote, MapPin, ChevronDown, Filter } from "lucide-react";
import { AVATAR_COLORS, TESTIMONIALS, DESTINATIONS, FEATURED_ITEMS } from "./data";
import Hero from "../components/Hero";
import { FeaturedTestimonialSlider } from "./Featuredtestimonialslider";

// ── Reveal on scroll ──────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({
  children, delay = 0, className = "", from = "bottom",
}: {
  children: React.ReactNode; delay?: number; className?: string; from?: "bottom" | "left" | "right";
}) {
  const { ref, visible } = useInView();
  const translateMap = { bottom: "translateY(28px)", left: "translateX(-28px)", right: "translateX(28px)" };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0,0)" : translateMap[from],
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Count-up ──────────────────────────────────────────────────────────────────
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        let cur = 0; const step = Math.ceil(to / 55);
        const t = setInterval(() => { cur = Math.min(cur + step, to); setVal(cur); if (cur >= to) clearInterval(t); }, 26);
      }
    }, { threshold: 0.5 });
    obs.observe(el); return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Star rating ───────────────────────────────────────────────────────────────
function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} fill={i < count ? "#EF4444" : "none"} stroke={i < count ? "#EF4444" : "#D1D5DB"} />
      ))}
    </div>
  );
}



function Avatar({ initials, index }: { initials: string; index: number }) {
  const [bg, text] = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div
      className="rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ width: 44, height: 44, background: bg, color: text, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {initials}
    </div>
  );
}

// ── Testimonial card ──────────────────────────────────────────────────────────
function TestimonialCard({ t, index, delay = 0 }: { t: typeof TESTIMONIALS[0]; index: number; delay?: number }) {
  return (
    <Reveal delay={delay} className="h-full">
      <div
        className="h-full flex flex-col rounded-2xl border border-gray-200 shadow-lg p-6 transition-all duration-300 hover:border-red-200 hover:shadow-xl hover:shadow-red-500/5 group"
        style={{ minHeight: "220px" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar initials={t.avatar} index={index} />
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {t.name}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">{t.location}</p>
            </div>
          </div>
          <Quote size={18} className="text-red-200 group-hover:text-red-400 transition-colors flex-shrink-0 mt-1" />
        </div>

        {/* Stars + date */}
        <div className="flex items-center gap-3 mb-4">
          <Stars count={t.rating} />
          <span className="text-gray-300 text-xs">·</span>
          <span className="text-gray-500 text-xs">{t.date}</span>
        </div>

        {/* Quote */}
        <p
          className="text-gray-600 text-sm leading-relaxed flex-1"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          "{t.quote}"
        </p>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-700">
            <MapPin size={11} className="text-red-400" />
            {t.destination}
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "#FEF2F2", color: "#DC2626" }}
          >
            {t.trip.split(" ").slice(0, 2).join(" ")}
          </span>
        </div>
      </div>
    </Reveal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TestimonialsPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [showAll, setShowAll] = useState(false);

  const filtered = activeFilter === "All"
    ? TESTIMONIALS
    : TESTIMONIALS.filter((t) => t.destination === activeFilter);

  const visible = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div
      className="bg-white min-h-screen"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >


      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <Hero>

        <div className="max-w-6xl mx-auto px-6 py-12 sm:px-8 relative z-10">
          <div className="max-w-2xl">
            {/* Label */}
            <div
              className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase"
              style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#FCA5A5", animation: "hero-rise 0.55s ease both" }}
            >
              <Star size={11} fill="#FCA5A5" stroke="none" />
              Traveller Stories
            </div>

            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)",
                fontWeight: 800, color: "#fff",
                lineHeight: 1.1, margin: "0 0 20px",
                animation: "hero-rise 0.6s ease 0.08s both",
              }}
            >
              10,000 journeys.{" "}
              <span style={{ color: "#EF4444", fontStyle: "italic" }}>10,000 stories.</span>
            </h1>

            <p
              className="text-gray-400 leading-relaxed mb-0"
              style={{ fontSize: "clamp(0.95rem, 1.8vw, 1.08rem)", maxWidth: "500px", animation: "hero-rise 0.6s ease 0.16s both" }}
            >
              Don't take our word for it. Every review below is from a real traveller who trusted us with one of the most important decisions of their year.
            </p>
          </div>

          {/* Stat row */}
          <div
            className="flex flex-wrap gap-8 mt-12"
            style={{ animation: "hero-rise 0.6s ease 0.24s both" }}
          >
            {[
              { val: 10000, sfx: "+", label: "Trips Delivered" },
              { val: 98, sfx: "%", label: "Recommend Us" },
              { val: 4.9, sfx: "/5", label: "Avg. Rating", fixed: true },
              { val: 50, sfx: "+", label: "Destinations" },
            ].map((s, i) => (
              <div key={i}>
                <p style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>
                  {s.fixed ? "4.9/5" : <><CountUp to={s.val} suffix={s.sfx} /></>}
                </p>
                <p className="text-gray-500 text-xs mt-1.5 font-semibold tracking-widest uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Hero>

      <FeaturedTestimonialSlider items={FEATURED_ITEMS} autoplay={6000} />

      {/* ── TRUST BAND ────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: "⭐", value: "4.9/5", label: "Google Rating" },
              { icon: "🏆", value: "100%", label: "Verified Reviews" },
              { icon: "🔁", value: "72%", label: "Repeat Travellers" },
              { icon: "💬", value: "10,000+", label: "Happy Families" },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="flex flex-col items-center">
                  <span className="text-2xl mb-2" role="img">{s.icon}</span>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, color: "#111827", margin: 0 }}>{s.value}</p>
                  <p className="text-gray-500 text-xs font-semibold mt-1 tracking-wide uppercase">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FILTER + GRID ─────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-8 py-16">

        {/* Filter bar */}
        <Reveal className="mb-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold mr-1">
              <Filter size={14} />
              Filter by
            </div>
            {DESTINATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setActiveFilter(d); setShowAll(false); }}
                className={`filter-btn ${activeFilter === d ? "active" : ""}`}
              >
                {d}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Section heading */}
        <Reveal className="mb-10">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-2">All Reviews</p>
              <h2
                style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.5rem, 3vw, 2.2rem)", fontWeight: 700, color: "#111827", margin: 0 }}
              >
                {activeFilter === "All" ? "What our travellers say" : `Reviews — ${activeFilter}`}
              </h2>
            </div>
            <p className="text-gray-400 text-sm font-medium">
              {filtered.length} review{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        </Reveal>

        {/* Cards grid */}
        {filtered.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visible.map((t, i) => (
                <TestimonialCard key={t.id} t={t} index={i} delay={i * 50} />
              ))}
            </div>

            {/* Show more */}
            {!showAll && filtered.length > 6 && (
              <Reveal className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="inline-flex items-center gap-2 border-2 border-gray-200 hover:border-red-400 text-gray-600 hover:text-red-500 font-bold px-8 py-3.5 rounded-xl transition-all text-sm"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Show all {filtered.length} reviews
                  <ChevronDown size={16} />
                </button>
              </Reveal>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-semibold">No reviews yet for this destination.</p>
            <p className="text-sm mt-1">Check back soon — we're adding new ones every week.</p>
          </div>
        )}
      </section>

      {/* ── VIDEO TESTIMONIAL PLACEHOLDER ─────────────────────────────────── */}
      <section className="bg-gray-950 py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-3">In Their Own Words</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 700, color: "#fff", margin: 0 }}>
              Watch what our travellers say
            </h2>
          </Reveal>

          {/* 3 video placeholders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { name: "Priya & Rohit", dest: "Kashmir", thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=300&fit=crop&auto=format" },
              { name: "Amit Verma", dest: "Manali", thumb: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=500&h=300&fit=crop&auto=format" },
              { name: "Karan & Deepika", dest: "Dubai", thumb: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&h=300&fit=crop&auto=format" },
            ].map((v, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="relative rounded-2xl overflow-hidden group cursor-pointer" style={{ aspectRatio: "16/9" }}>
                  <img src={v.thumb} alt={v.dest} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/55 transition-colors duration-300" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-red-500/80 group-hover:border-red-500 transition-all duration-300">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ marginLeft: "3px" }}>
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 p-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
                    <p className="text-white font-bold text-sm">{v.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin size={11} className="text-red-400" />
                      <span className="text-gray-300 text-xs">{v.dest}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="text-center mt-8">
            <p className="text-gray-600 text-sm">Video testimonials coming soon · <a href="#" className="text-red-400 hover:text-red-300 font-semibold transition-colors underline underline-offset-2">Subscribe to our channel</a></p>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="bg-red-500 py-20 px-6 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <Reveal className="relative z-10 max-w-xl mx-auto">
          <p className="text-red-100 text-xs font-bold tracking-widest uppercase mb-4">Ready to Write Your Story?</p>
          <h2
            style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem, 4vw, 2.8rem)", fontWeight: 800, color: "#fff", margin: "0 0 16px" }}
          >
            Join 10,000+ travellers who came back smiling.
          </h2>
          <p className="text-red-100 text-base leading-relaxed mb-8">
            Tell us where you want to go. We'll make sure every moment feels exactly like you imagined.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-red-500 hover:bg-red-50 font-bold px-8 py-3.5 rounded-xl text-sm transition-colors"
              style={{ boxShadow: "0 4px 18px rgba(0,0,0,0.14)" }}
            >
              Plan My Trip
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
            <a
              href="tel:+917023907023"
              className="inline-flex items-center gap-2 border border-white/40 hover:border-white text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-all"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Call Us
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}