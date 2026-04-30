"use client";

import { useState } from "react";
import { Hero } from "../about/Ourstoryhero";
import { Plane } from "lucide-react";
import { HERO_STATS } from "./data";
import { Reveal } from "../components/Reveal";
import Openings from "./openings";
import ContactHr from "./ContactHr";
import Perks from "./Perks";
import WhatWeOffer from "./Whatweoffer";
import LifeAtDreamsYatri from "./Lifeatdreamsyatri";

export default function CareersPage() {
  return (
    <div
      className="bg-white min-h-screen"
    >


      {/* ── HERO ── */}
      <Hero variant="dark" decoration="grid" showWave watermark="✈">
        <div className="text-center">

          {/* Badge */}
          <Reveal>
            <div className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/30
                            rounded-full px-4 py-2 mb-8">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              <span
                className="text-red-400 text-xs font-bold uppercase tracking-widest"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
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
            <p
              className="text-gray-400 text-base sm:text-lg leading-relaxed mx-auto mb-10"
              style={{
                maxWidth: 500,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
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
                  <p
                    className="text-white font-extrabold leading-none mb-1.5"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
                    }}
                  >
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

        {/* Quick perks strip */}
        <Perks />

        {/* What We Offer — featured benefits + grid */}
        <WhatWeOffer />

        {/* Life at Dreams Yatri — gallery + testimonials */}
        <LifeAtDreamsYatri />

        {/* Open Positions */}
        <Openings />

        {/* How to Apply */}
        <Reveal className="mb-5">
          <div className="bg-gray-950 rounded-2xl p-7 sm:p-10">
            <div className="grid sm:grid-cols-2 gap-8 items-center">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-3"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  How to Apply
                </p>
                <h3
                  className="text-white font-bold mb-2"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)",
                  }}
                >
                  3 Simple Steps
                </h3>
                <p
                  className="text-gray-500 text-sm leading-relaxed"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  No portals. No long forms. We keep hiring simple and human.
                </p>
              </div>

              <div className="flex flex-col gap-5">
                {[
                  {
                    n: "01",
                    t: "Choose your role",
                    d: "Read the JDs above and pick the opening that matches your background.",
                  },
                  {
                    n: "02",
                    t: "Email your CV",
                    d: "Send it to hr@dreamsyatri.com with your name and role in the subject line.",
                  },
                  {
                    n: "03",
                    t: "We'll call you",
                    d: "Our HR team reviews applications within 3 working days and reaches out directly.",
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
                      <p
                        className="text-white font-bold text-sm mb-0.5"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {s.t}
                      </p>
                      <p
                        className="text-gray-500 text-xs leading-relaxed"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {s.d}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* Contact HR */}
        <ContactHr />

      </div>
    </div>
  );
}