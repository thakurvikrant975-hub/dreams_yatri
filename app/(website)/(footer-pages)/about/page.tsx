"use client"

import { useState, useEffect, useRef } from "react";
import {
  Plane, MapPin, Hotel, Car, Compass, HeartHandshake,
  Clock, ShieldCheck, Star, ArrowRight, Quote,
  Camera, CheckCircle2, PhoneCall,
  Sparkles, Globe, TrendingUp, ChevronLeft, ChevronRight,
  CalendarCheck, Headphones, Wallet, Mountain
} from "lucide-react";
import Hero from "../components/Hero";
import {services, timelineData, values, stats, testimonials, team } from "./data";
import { Gallery } from "./Gallery";
import { gallery } from "./data";
import { SectionHeading } from "../components/SectionHeading";
import { WhatWeBelieve } from "./Whatwebelieve";
import TestimonialSlider from "./TestimonialSlider";
import { OurStoryHero } from "./Ourstoryhero";

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



function SectionLabel({ children }) {
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

      {/* ══ 2. HOW IT STARTED ══ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>The Origin</SectionLabel>
            <SectionHeading
                text="How It"
                highlight="Started"
                highlightPosition="suffix"
                variant="light"
              />
          </Reveal>
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-5">
              <Reveal delay={0.05}>
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm relative">
                  <div className="absolute -top-5 -left-3">
                    <div className="bg-red-500 rounded-2xl w-12 h-12 flex items-center justify-center shadow-lg shadow-red-200">
                      <Quote size={20} className="text-white" />
                    </div>
                  </div>
                  <p className="text-gray-700 text-[17px] leading-relaxed mt-3 mb-4">
                    "I've always loved to travel. The spontaneity, the new faces, the food you can't find anywhere else. But every trip came with a shadow — the anxiety of logistics in an unfamiliar place."
                  </p>
                  <p className="text-gray-700 text-[17px] leading-relaxed">
                    "One night in Manali, I landed at midnight. Hotel unconfirmed. Cab not responding. Phone at 3%. Standing in the cold, surrounded by strangers —
                    <strong className="text-gray-900"> I asked myself why something I love feels like punishment.</strong>"
                  </p>
                  <div className="mt-7 flex items-center gap-3 pt-6 border-t border-gray-100">
                    <div className="w-11 h-11 bg-red-100 rounded-full flex items-center justify-center font-black text-red-600">V</div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">Vikrant Thakur</p>
                      <p className="text-xs text-gray-500">Founder, DremsYatri</p>
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="bg-red-500 rounded-3xl p-8 text-white">
                  <Sparkles size={22} className="text-red-200 mb-4" />
                  <p className="text-xl font-bold mb-3">So I built the solution.</p>
                  <p className="text-red-100 leading-relaxed">
                    Roamly was born not as a startup idea, but as a personal mission — remove every ounce of friction from travel so that every person, wherever they go, can focus entirely on the experience and not the logistics.
                  </p>
                </div>
              </Reveal>
            </div>
            <div className="space-y-3">
              {[
                { Icon: Hotel, problem: "Arriving at midnight to an unconfirmed hotel in a strange city", solution: "Hotel confirmed days in advance. Check-in details sent to your phone." },
                { Icon: Car, problem: "Cab driver not responding. Standing at the station alone.", solution: "Driver briefed, contact shared, live-tracking available." },
                { Icon: Compass, problem: "No idea what to do. Overwhelmed by 1,000 Google results.", solution: "Curated activity list, pre-booked, tailored to your interests." },
                { Icon: Headphones, problem: "40 minutes on hold with faceless customer care, no resolution.", solution: "WhatsApp a real expert. Response in under 5 minutes." },
              ].map(({ Icon, problem, solution }, i) => (
                <Reveal key={i} delay={i * 0.07}>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:border-red-200 hover:shadow-sm transition-all group">
                    <div className="flex gap-4 items-start">
                      <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 transition-colors mt-0.5">
                        <Icon size={18} className="text-red-500" />
                      </div>
                      <div>
                        <p className="text-gray-400 line-through text-sm mb-2">{problem}</p>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                          <p className="text-gray-800 text-sm font-medium">{solution}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ 3. YOU TRAVEL. WE MANAGE. ══ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>What We Do</SectionLabel>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-16 gap-6">
              <SectionHeading
                text="You Travel"
                highlight="We Manage"
                highlightPosition="suffix"
                variant="light"
              />
              <p className="text-gray-500 text-base max-w-sm leading-relaxed">Every detail that keeps you up at night before a trip — hotels, cabs, activities, emergencies — consider it handled.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map(({ Icon, title, desc, color, bg, border }, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className={`rounded-2xl p-7 border-2 ${border} ${bg} hover:shadow-md transition-all duration-300 h-full group`}>
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-5 shadow-sm group-hover:scale-110 transition-transform">
                    <Icon size={22} className={color} />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
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

      {/* ══ 5. TIMELINE ══ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <SectionLabel>Our Journey</SectionLabel>

            <SectionHeading
                text="From One Bad Night to"
                highlight="50,000 Great Trips"
                highlightPosition="suffix"
                variant="light"
              />
            
          </Reveal>

          <div className="relative">
            {/* Vertical line — desktop center, mobile left */}
            <div className="absolute left-5 sm:left-1/2 top-2 bottom-2 w-px bg-gray-200 sm:-translate-x-px" />

            <div className="space-y-10">
              {timelineData.map(({ year, title, Icon, desc }, i) => {
                const isLeft = i % 2 === 0;
                return (
                  <Reveal key={i} delay={0.04}>
                    <div className="relative flex items-start sm:items-center pl-14 sm:pl-0">

                      {/* Mobile dot */}
                      <div className="absolute left-[13px] top-4 w-5 h-5 rounded-full bg-red-500 border-4 border-white shadow-md sm:hidden z-10" />

                      {/* Desktop layout */}
                      <div className="hidden sm:flex w-full items-center gap-0">
                        {/* Left side */}
                        <div className={`w-[calc(50%-2rem)] ${isLeft ? "pr-8" : ""}`}>
                          {isLeft && (
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all text-right">
                              <span className="inline-block text-xs font-black text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1 mb-3">{year}</span>
                              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                            </div>
                          )}
                        </div>

                        {/* Center dot */}
                        <div className="flex-shrink-0 w-16 flex items-center justify-center z-10">
                          <div className="w-10 h-10 rounded-full bg-red-500 border-4 border-white shadow-md flex items-center justify-center">
                            <Icon size={16} className="text-white" />
                          </div>
                        </div>

                        {/* Right side */}
                        <div className={`w-[calc(50%-2rem)] ${!isLeft ? "pl-8" : ""}`}>
                          {!isLeft && (
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-red-200 transition-all">
                              <span className="inline-block text-xs font-black text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1 mb-3">{year}</span>
                              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mobile card */}
                      <div className="sm:hidden bg-white rounded-2xl p-5 border border-gray-100 shadow-sm w-full">
                        <span className="inline-block text-xs font-black text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1 mb-3">{year}</span>
                        <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </section>

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

      {/* ══ 8. TEAM ══ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>The Team</SectionLabel>

            <SectionHeading
              text="Travelers Who"
              highlight="Plan Your Travels"
              highlightPosition="suffix"
              variant="light"
            />
            <p className="text-gray-500 text-base mb-16 max-w-lg leading-relaxed">Our team has collectively visited 80+ countries. We're not just planners — we're obsessive travelers who happen to be really good at logistics.</p>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {team.map(({ name, role, Icon, countries }, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-red-200 hover:shadow-sm transition-all text-center group">
                  <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-red-100 transition-colors">
                    <Icon size={26} className="text-red-500" />
                  </div>
                  <p className="font-bold text-gray-900 text-sm">{name}</p>
                  <p className="text-gray-400 text-xs mt-1 mb-3 leading-tight">{role}</p>
                  <div className="flex items-center justify-center gap-1">
                    <Globe size={11} className="text-red-400" />
                    <span className="text-xs text-red-500 font-semibold">{countries}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 9. CTA — WHITE CARD matching footer ══ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="grid lg:grid-cols-2">

                {/* Left — red */}
                <div className="bg-red-500 p-10 sm:p-12 flex flex-col justify-between relative overflow-hidden min-h-[340px]">
                  <div className="absolute -top-16 -right-16 w-48 h-48 bg-red-400 rounded-full opacity-30 pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-red-600 rounded-full opacity-20 pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-6">
                      <Plane size={18} className="text-red-200" />
                      <span className="text-red-200 text-xs font-bold uppercase tracking-widest">Ready to go?</span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4" >
                      Your Next Trip,<br />Zero Tension.
                    </h3>
                    <p className="text-red-100 leading-relaxed text-[15px]">
                      Hotels confirmed. Cabs arranged. Activities booked. You just show up and enjoy.
                    </p>
                  </div>
                  <div className="relative mt-8 flex flex-wrap gap-2">
                    {["No hidden fees", "Free consultation", "24/7 support"].map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white/15 rounded-full px-3.5 py-1.5">
                        <CheckCircle2 size={13} className="text-white" />
                        <span className="text-white text-xs font-medium">{t}</span>
                      </div>
                    ))}
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