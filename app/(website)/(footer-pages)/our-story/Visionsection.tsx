"use client";

import Image from "next/image";
import { Sunrise, Heart, Compass, Shield, Clock, MapPin } from "lucide-react";

// ─── Reveal animation wrapper (matches your existing Reveal component API) ───
// Replace with your actual <Reveal> import if different
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        animationDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── SectionHeading (matches your existing API) ───────────────────────────────
function SectionHeading({
  text,
  highlight,
  highlightPosition,
  variant,
}: {
  text: string;
  highlight: string;
  highlightPosition: "prefix" | "suffix";
  variant: "light" | "dark";
}) {
  const base = variant === "light" ? "text-gray-950" : "text-white";
  return (
    <h2
      className={`text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-6 ${base}`}
      style={{ fontFamily: "'Playfair Display', serif" }}
    >
      {highlightPosition === "prefix" && (
        <span className="text-red-500">{highlight} </span>
      )}
      {text}
      {highlightPosition === "suffix" && (
        <span className="text-red-500"> {highlight}</span>
      )}
    </h2>
  );
}

// ─── Stat item ────────────────────────────────────────────────────────────────
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span
        className="text-3xl sm:text-4xl font-bold text-white tabular-nums"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {value}
      </span>
      <span className="text-sm text-gray-400 mt-1 font-medium tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

// ─── Promise pill ─────────────────────────────────────────────────────────────
function Pill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-500/12 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full">
      <span className="w-1 h-1 rounded-full bg-red-400 inline-block" />
      {text}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VisionSection() {
  const promises = [
    "Pre-confirmed stays",
    "24/7 on-trip support",
    "Zero hidden costs",
    "Backup plans always ready",
  ];

  return (
    <section
      id="vision"
      aria-labelledby="vision-heading"
      className="relative bg-white overflow-hidden"
    >
      {/* ── Decorative background grid ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(#000 1px, transparent 1px), linear-gradient(to right, #000 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* ════════════════════════════════════════════════════════════════════
          BLOCK 1 — EDITORIAL HEADER (full-width, centered)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 pt-24 sm:pt-32 pb-0">
        <Reveal className="max-w-3xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="h-px w-8 bg-red-500" />
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-red-500">
              Our Vision
            </p>
            <span className="h-px w-8 bg-red-500" />
          </div>

          <SectionHeading
            text="Travel should feel like freedom —"
            highlight="not a second job."
            highlightPosition="suffix"
            variant="light"
          />

          <p className="text-gray-500 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            We exist so every traveller — first-timer or seasoned explorer — can
            be fully present in the moment they've been looking forward to,
            without a single logistics worry clouding it.
          </p>
        </Reveal>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          BLOCK 2 — IMMERSIVE DARK HERO STRIP
      ════════════════════════════════════════════════════════════════════ */}
      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 mt-20">
        <Reveal>
          <div className="relative rounded-[2rem] overflow-hidden bg-gray-950 min-h-[480px] sm:min-h-[560px] flex flex-col justify-end">

            {/* Background image */}
            <div className="absolute inset-0">
              <Image
                src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=85&auto=format&fit=crop"
                alt="Himalayan mountain range at golden hour — Dreams Yatri travel destinations"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1200px"
                className="object-cover object-center"
              />
              {/* Gradient overlay — bottom-up */}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-gray-950/10" />
            </div>

            {/* Content over image */}
            <div className="relative z-10 p-8 sm:p-12 lg:p-16">
              {/* Stats row */}
              <div className="flex flex-wrap gap-10 sm:gap-16 mb-10 sm:mb-12">
                <StatItem value="10,000+" label="Happy travellers" />
                <StatItem value="120+" label="Destinations" />
                <StatItem value="8 yrs" label="Of expertise" />
              </div>

              {/* Main copy */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16 items-end">
                <div>
                  <Sunrise size={36} className="text-red-500 mb-5" />
                  <h3
                    className="text-white text-2xl sm:text-3xl font-bold mb-4 leading-snug"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    A world where you show up
                    <br className="hidden sm:block" /> and just… enjoy.
                  </h3>
                  <p className="text-gray-400 text-base leading-relaxed max-w-md">
                    Our vision is a travel experience so seamlessly organised
                    that the only decision you make on the road is what to eat
                    next. Hotels confirmed. Cabs waiting. Guides briefed. Every
                    variable accounted for before you board.
                  </p>
                </div>

                {/* Promise pills */}
                <div className="flex flex-wrap gap-2.5 lg:justify-end">
                  {promises.map((t) => (
                    <Pill key={t} text={t} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          BLOCK 3 — THREE PILLAR CARDS
      ════════════════════════════════════════════════════════════════════ */}
      <div className="relative max-w-7xl mx-auto px-6 sm:px-10 mt-6 pb-24 sm:pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* ── Card 1: Designed for Joy (red, accent) ── */}
          <Reveal delay={60} className="relative bg-red-500 rounded-[1.75rem] p-8 sm:p-10 overflow-hidden group">
            {/* Decorative circles */}
            <div
              aria-hidden="true"
              className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 group-hover:scale-110 transition-transform duration-700"
            />
            <div
              aria-hidden="true"
              className="absolute top-6 right-6 w-20 h-20 rounded-full bg-white/5"
            />
            <Heart size={30} className="text-white mb-6" />
            <h3
              className="text-white text-xl sm:text-2xl font-bold mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Designed for Joy
            </h3>
            <p className="text-red-100 text-sm sm:text-base leading-relaxed">
              Every package is engineered backwards from the feeling we want you
              to have — not from what's cheapest to operate.
            </p>
          </Reveal>

          {/* ── Card 2: Rooted in India (image + overlay) ── */}
          <Reveal delay={120} className="relative rounded-[1.75rem] overflow-hidden min-h-[280px] group">
            <Image
              src="https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80&auto=format&fit=crop"
              alt="Taj Mahal reflecting in water — Rooted in India"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <Compass size={28} className="text-white mb-3" />
              <h3
                className="text-white text-xl sm:text-2xl font-bold mb-2"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Rooted in India
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                From Shimla's misty ridges to Rajasthan's golden deserts — we
                know these places because we live them.
              </p>
            </div>
          </Reveal>

          {/* ── Card 3: Reliability (dark, structured) ── */}
          <Reveal
            delay={180}
            className="sm:col-span-2 lg:col-span-1 bg-gray-950 rounded-[1.75rem] p-8 sm:p-10 relative overflow-hidden group"
          >
            <div
              aria-hidden="true"
              className="absolute top-0 right-0 w-56 h-56 bg-red-500/8 rounded-full blur-3xl group-hover:bg-red-500/14 transition-all duration-700"
            />
            <Shield size={30} className="text-red-500 mb-6" />
            <h3
              className="text-white text-xl sm:text-2xl font-bold mb-3"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Built on Reliability
            </h3>
            <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8">
              Every vendor is vetted. Every contingency is pre-planned. When
              something shifts — weather, road closures, cancellations — our
              operations team acts before you even notice.
            </p>

            {/* Mini feature list */}
            <ul className="space-y-3">
              {[
                { icon: Clock, text: "24/7 operations desk" },
                { icon: MapPin, text: "Ground teams across all routes" },
                { icon: Shield, text: "Fully insured travel packages" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center">
                    <Icon size={13} className="text-red-400" />
                  </span>
                  <span className="text-gray-400 text-sm">{text}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}