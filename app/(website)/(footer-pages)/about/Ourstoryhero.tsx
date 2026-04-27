"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Hero wrapper component
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState, useEffect } from "react";
import { Plane, ArrowRight, Users, MapPin, Star, Clock } from "lucide-react";
import Link from "next/link";


type HeroVariant = "dark" | "light";
type HeroDecoration = "grid" | "dots" | "none";

interface HeroProps {
  children: React.ReactNode;
  className?: string;
  /** "dark" → gray-950 bg, white text  |  "light" → white bg, dark text */
  variant?: HeroVariant;
  /** Background texture pattern. Default: "grid" */
  decoration?: HeroDecoration;
  /** Show the wave divider at bottom. Default: true */
  showWave?: boolean;
  /** Custom watermark character/word. Pass null to hide. Default: none */
  watermark?: string | null;
}

export function Hero({
  children,
  className = "",
  variant = "dark",
  decoration = "grid",
  showWave = true,
  watermark,
}: HeroProps) {
  const isDark = variant === "dark";

  const bgClass     = isDark ? "bg-gray-950" : "bg-white";
  const waveFill    = isDark ? "#030712" : "#ffffff";
  const waveOuterBg = isDark ? "bg-white"  : "bg-gray-950";

  const textureStyle =
    decoration === "grid"
      ? {
          backgroundImage:
            isDark
              ? "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)"
              : "linear-gradient(#000 1px,transparent 1px),linear-gradient(90deg,#000 1px,transparent 1px)",
          backgroundSize: "52px 52px",
        }
      : decoration === "dots"
      ? {
          backgroundImage: `radial-gradient(circle, ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)"} 1.2px, transparent 1.2px)`,
          backgroundSize: "26px 26px",
        }
      : {};

  return (
    <>
      <section
        className={`relative ${bgClass} overflow-hidden ${className}`}
        style={{ paddingTop: "88px", paddingBottom: "72px" }}
      >
        {/* Texture */}
        {decoration !== "none" && (
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={textureStyle}
          />
        )}

        {/* Red glow blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-red-500/10 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-red-500/10 blur-[70px] pointer-events-none" />

        {/* Optional watermark */}
        {watermark && (
          <div
            className="absolute right-8 sm:right-20 top-1/2 -translate-y-1/2 pointer-events-none select-none"
            aria-hidden="true"
          >
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(120px, 18vw, 240px)",
                fontWeight: 800,
                fontStyle: "italic",
                color: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.025)",
                lineHeight: 1,
              }}
            >
              {watermark}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 sm:px-8 relative z-10">
          {children}
        </div>
      </section>

      {/* Wave divider */}
      {showWave && (
        <svg
          className={`block -mt-px ${waveOuterBg}`}
          viewBox="0 0 1200 56"
          preserveAspectRatio="none"
          height="56"
          width="100%"
        >
          <path
            d="M0 0 Q300 56 600 28 Q900 0 1200 38 L1200 0 Z"
            fill={waveFill}
          />
        </svg>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reveal
// ─────────────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setV(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el); return () => obs.disconnect();
  }, []);
  return { ref, v };
}

function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, v } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    v ? 1 : 0,
        transform:  v ? "none" : "translateY(22px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Count-up
// ─────────────────────────────────────────────────────────────────────────────
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref  = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        let cur = 0;
        const step = Math.ceil(to / 55);
        const t = setInterval(() => {
          cur = Math.min(cur + step, to);
          setVal(cur);
          if (cur >= to) clearInterval(t);
        }, 26);
      }
    }, { threshold: 0.5 });
    obs.observe(el); return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Our Story Hero — dark variant
// ─────────────────────────────────────────────────────────────────────────────

const STATS = [
  { icon: Users,   number: 10000, suffix: "+", label: "Happy Travellers",  featured: true  },
  { icon: MapPin,  number: 50,    suffix: "+", label: "Destinations",      featured: false },
  { icon: Star,    number: 4.9,   suffix: "/5", label: "Google Rating",    featured: false, fixed: "4.9/5" },
  { icon: Clock,   number: 5,     suffix: "+yr", label: "Years of Trips",  featured: false, fixed: "5+ yrs" },
];

export function OurStoryHero() {
  return (
    <Hero variant="dark" decoration="grid" showWave={true} watermark="Story">
      <div className="grid lg:grid-cols-2 gap-14 xl:gap-20 items-center">

        {/* ── Left copy ── */}
        <div>

          {/* Badge */}
          <Reveal>
            <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-full px-4 py-2 mb-8">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Our Story
              </span>
            </div>
          </Reveal>

          {/* Headline */}
          <Reveal delay={80}>
            <h1
              className="text-white leading-[1.1] mb-6"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize:   "clamp(2.4rem, 5.5vw, 4rem)",
                fontWeight: 800,
              }}
            >
              Travel Should Feel Like{" "}
              <span className="relative inline-block">
                <span className="text-red-500 italic">Freedom.</span>
                {/* Squiggle underline */}
                <svg
                  className="absolute -bottom-1 left-0 w-full overflow-visible"
                  viewBox="0 0 200 8"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6 Q50 1 100 5 Q150 9 198 4"
                    stroke="#EF4444"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.5"
                  />
                </svg>
              </span>
            </h1>
          </Reveal>

          {/* Body copy */}
          <Reveal delay={140}>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", maxWidth: 480 }}>
              We started because travel kept breaking us—unconfirmed hotels, missing cabs, midnight panic.
            </p>
            <p className="text-white text-base sm:text-lg leading-relaxed font-semibold mb-10">
              So we built the travel company we always wished existed.
            </p>
          </Reveal>

          {/* CTAs */}
          <Reveal delay={200}>
            <div className="flex flex-wrap gap-3">
              <a
                href="/contact"
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white
                           font-bold px-7 py-3.5 rounded-xl transition-all text-sm no-underline"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  boxShadow:  "0 4px 18px rgba(239,68,68,0.38)",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "none")}
              >
                <Plane size={15} /> Plan My Trip
              </a>
              <Link
                href="/our-story"
                className="inline-flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl
                           text-sm no-underline transition-all"
                style={{
                  fontFamily:  "'Plus Jakarta Sans', sans-serif",
                  background:  "rgba(255,255,255,0.07)",
                  border:      "1.5px solid rgba(255,255,255,0.15)",
                  color:       "#fff",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              >
                Read Our Story <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>

          {/* Trust micro-row */}
          <Reveal delay={260}>
            <div className="flex flex-wrap items-center gap-5 mt-8 pt-8 border-t border-white/[0.08]">
              {["Pre-confirmed every time", "24/7 emergency line", "No hidden charges"].map((t, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 text-xs text-gray-500 font-medium"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  <span className="w-1 h-1 rounded-full bg-red-500" />
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        {/* ── Right: stat grid ── */}
        <Reveal delay={100}>
          <div className="grid grid-cols-2 gap-3.5">
            {STATS.map(({ icon: Icon, number, suffix, label, featured, fixed }, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 border transition-all duration-300 flex flex-col group"
                style={{
                  background: featured
                    ? "linear-gradient(135deg, #EF4444, #DC2626)"
                    : "rgba(255,255,255,0.04)",
                  border: featured
                    ? "1.5px solid rgba(239,68,68,0.4)"
                    : "1.5px solid rgba(255,255,255,0.08)",
                  boxShadow: featured
                    ? "0 8px 32px rgba(239,68,68,0.28)"
                    : "none",
                }}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 flex-shrink-0"
                  style={{
                    background: featured ? "rgba(255,255,255,0.18)" : "rgba(239,68,68,0.12)",
                  }}
                >
                  <Icon
                    size={17}
                    style={{ color: featured ? "#fff" : "#EF4444" }}
                  />
                </div>

                {/* Number */}
                <p
                  className="mb-1 leading-none"
                  style={{
                    fontSize:   "clamp(1.6rem, 2.8vw, 2.1rem)",
                    fontWeight: 800,
                    color:      featured ? "#fff" : "#fff",
                  }}
                >
                  {fixed
                    ? fixed
                    : <><CountUp to={number} suffix={suffix} /></>
                  }
                </p>

                {/* Label */}
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    color: featured ? "rgba(255,255,255,0.7)" : "#6B7280",
                  }}
                >
                  {label}
                </p>

                {/* Featured card corner decoration */}
                {featured && (
                  <div
                    className="absolute top-0 right-0 w-16 h-16 rounded-tr-2xl rounded-bl-2xl pointer-events-none"
                    style={{ background: "rgba(255,255,255,0.10)" }}
                  />
                )}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </Hero>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────────────────────
export default OurStoryHero;