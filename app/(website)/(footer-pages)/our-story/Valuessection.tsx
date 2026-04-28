"use client";

import Image from "next/image";
import { SectionHeading } from "../components/SectionHeading";
import {
  ShieldCheck,
  Clock,
  MapPin,
  Headphones,
  Star,
  Users,
} from "lucide-react";
import { VALUES } from "./data";


export function ValuesSection() {
  return (
    <section className="relative py-24 sm:py-32 bg-[#0d0d0d] overflow-hidden">

      {/* ── Ambient background grain ───────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      />

      {/* ── Radial red glow ────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px] opacity-10"
        style={{ background: "radial-gradient(ellipse, #FB2B37 0%, transparent 70%)" }}
      />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-20 max-w-2xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase text-red-500 mb-5">
            <span className="w-8 h-px bg-red-500 inline-block" />
            What We Stand For
          </p>
          <SectionHeading
            text="The promises we "
            highlight="don't break"
            highlightPosition="suffix"
            variant="dark"
          />
          <p className="mt-5 text-gray-400 text-base leading-relaxed max-w-xl">
            Every trip we craft carries the weight of trust. These aren't talking points —
            they're the operational standards our team is held to daily.
          </p>
        </div>

        {/* ── Grid ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {VALUES.map((v, i) => (
            <ValueCard key={i} v={v} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CARD
───────────────────────────────────────────────────────────────────────────── */

interface Value {
  icon: React.ReactNode;
  title: string;
  body: string;
  stat: string;
  statLabel: string;
  image: string;
  alt: string;
}

function ValueCard({ v, delay }: { v: Value; delay: number }) {
  const Icon = v.icon;

  return (
    <div>
      <article className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:border-red-500/30 transition-all duration-500 hover:shadow-[0_0_40px_-8px_rgba(251,43,55,0.25)] cursor-default">

        {/* ── Image ──────────────────────────────────────────────────────────── */}
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={v.image}
            alt={v.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          {/* Dark overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/40 to-transparent" />

          {/* Stat badge — overlaid on image */}
          <div className="absolute bottom-4 left-5 flex flex-col">
            <span className="text-2xl font-black text-white leading-none tracking-tight">
              {v.stat}
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-red-400 mt-0.5">
              {v.statLabel}
            </span>
          </div>

          {/* Icon badge */}
          <div className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-red-400 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white group-hover:border-red-500 transition-all duration-300">
            <Icon size={18} />
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="p-6 pt-5">
          <h3 className="text-white font-bold text-[15px] mb-2 tracking-tight group-hover:text-red-400 transition-colors duration-300">
            {v.title}
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed group-hover:text-gray-400 transition-colors duration-300">
            {v.body}
          </p>

          {/* Bottom accent line */}
          <div className="mt-5 h-px w-0 group-hover:w-full bg-gradient-to-r from-red-500/60 to-transparent transition-all duration-500 ease-out" />
        </div>
      </article>
    </div>
  );
}