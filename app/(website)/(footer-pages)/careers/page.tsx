"use client";

import { useState, useRef, useEffect } from "react";
import { Hero } from "../about/Ourstoryhero";
import {
  Plane, MapPin, Briefcase, Clock, Mail, Phone,
  ChevronDown, Globe, TrendingUp, Users, Heart,
  CheckCircle, Circle, ArrowRight,
} from "lucide-react";
import { PERKS, HERO_STATS, OPENINGS } from "./data";
import { Reveal } from "../components/Reveal";
import { SectionLabel } from "../components/SectionLabel";
import { SectionHeading } from "../components/SectionHeading";
import Openings from "./openings";


export default function CareersPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const toggle = (id: number) => setOpenId(p => p === id ? null : id);

  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');`}</style>

      {/* ── HERO using your Hero wrapper ── */}
      <Hero variant="dark" decoration="grid" showWave watermark="✈">
        <div className="text-center">

          {/* Badge */}
          <Reveal>
            <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/30
                            rounded-full px-4 py-2 mb-8">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                We're Hiring
              </span>
            </div>
          </Reveal>

          {/* Headline */}
          <Reveal delay={80}>
            <h1
              className="text-white leading-[1.1] mb-5"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)",
                fontWeight: 800,
              }}
            >
              Build Careers That{" "}
              <span className="text-red-500 italic">Go Places</span>
            </h1>
          </Reveal>

          {/* Sub-copy */}
          <Reveal delay={140}>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed mx-auto mb-10"
              style={{ maxWidth: 500, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Join a fast-growing travel company headquartered in Shimla.
              We craft journeys for thousands of travellers — and we need
              passionate people to help us scale.
            </p>
          </Reveal>

          {/* Hero stats */}
          <Reveal delay={200}>
            <div className="flex flex-wrap justify-center gap-10 sm:gap-16">
              {HERO_STATS.map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-white font-extrabold leading-none mb-1.5"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
                    }}>
                    {s.value}
                  </p>
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Hero>

      {/* ── BODY ── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 pb-24">

        {/* PERKS */}
        <section className="pt-16 pb-16">
          <Reveal className="text-center mb-12">
            <SectionLabel>Life at DreamsYatri</SectionLabel>
            <SectionHeading
              text="Why Works"
              highlight="with us"
              highlightPosition="suffix"
              variant="light"
            />
          </Reveal>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PERKS.map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center h-full
                                flex flex-col hover:border-red-200 hover:shadow-lg
                                hover:shadow-red-500/[0.05] hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center
                                  justify-center mx-auto mb-4 flex-shrink-0">
                    <Icon size={22} />
                  </div>
                  <p className="font-bold text-gray-900 text-sm mb-1.5"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{title}</p>
                  <p className="text-gray-400 text-xs leading-relaxed"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <Openings />



        {/* HOW TO APPLY — dark card */}
        <Reveal className="mb-5">
          <div className="bg-gray-950 rounded-2xl p-7 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-3">
                  How to Apply
                </p>
                <h3 className="text-white font-bold mb-2"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
                  }}>
                  3 Simple Steps
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  No portals. No long forms. We keep hiring simple and human.
                </p>
              </div>

              <div className="flex flex-col gap-5">
                {[
                  {
                    n: "01", t: "Choose your role",
                    d: "Read the JDs above and pick the opening that matches your background."
                  },
                  {
                    n: "02", t: "Email your CV",
                    d: "Send it to hr@dreamsyatri.com with your name and role in the subject line."
                  },
                  {
                    n: "03", t: "We'll call you",
                    d: "Our HR team reviews applications within 3 working days and reaches out directly."
                  },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                                 text-xs font-extrabold"
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        color: "#EF4444",
                        fontFamily: "'Playfair Display', serif",
                      }}
                    >
                      {s.n}
                    </span>
                    <div>
                      <p className="text-white font-bold text-sm mb-0.5"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.t}</p>
                      <p className="text-gray-500 text-xs leading-relaxed"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* CONTACT HR */}
        <Reveal>
          <div className="bg-white border border-gray-100 rounded-2xl p-7 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">
                  Have Questions?
                </p>
                <h3 className="font-bold text-gray-900 mb-2"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(1.2rem, 2.5vw, 1.55rem)",
                  }}>
                  Talk to Our HR Team
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Not sure which role fits you, or want to know more before applying?
                  Reach out — we're happy to help.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { href: "mailto:hr@dreamsyatri.com", Icon: Mail, label: "Email HR", value: "hr@dreamsyatri.com" },
                  { href: "tel:+917023907023", Icon: Phone, label: "Call Us", value: "+91 70239 07023" },
                  { href: "tel:+917023907099", Icon: Phone, label: "Alternate", value: "+91 70239 07099" },
                ].map(({ href, Icon, label, value }, i) => (
                  <a
                    key={i}
                    href={href}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100
                               bg-gray-50 no-underline group hover:border-red-200 hover:bg-red-50/40
                               transition-all duration-200"
                  >
                    <span className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center
                                     justify-center flex-shrink-0 group-hover:bg-red-500
                                     group-hover:text-white transition-colors duration-200">
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                        {value}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* CTA STRIP */}
      <section className="bg-red-500 py-16 px-6 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <Reveal className="relative z-10 max-w-xl mx-auto">
          <h2
            className="text-white font-extrabold mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)",
            }}
          >
            Ready to Join the Team?
          </h2>
          <p className="text-red-100 text-sm leading-relaxed mb-7"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Send your CV to <strong>hr@dreamsyatri.com</strong> — we'll take it from there.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="mailto:hr@dreamsyatri.com?subject=Job%20Application%20%E2%80%94%20Dreams%20Yatri"
              className="inline-flex items-center gap-2 bg-white text-red-500 hover:bg-red-50
                         font-bold px-7 py-3.5 rounded-xl text-sm no-underline transition-colors"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.14)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <Mail size={15} />
              Email hr@dreamsyatri.com
            </a>
            <a
              href="/careers"
              className="inline-flex items-center gap-2 border border-white/40 hover:border-white
                         text-white font-semibold px-7 py-3.5 rounded-xl text-sm no-underline transition-all"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              View All Roles <ArrowRight size={15} />
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}