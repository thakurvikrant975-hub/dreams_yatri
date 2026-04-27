"use client";

import { useState, useRef, useEffect } from "react";
import { Hero } from "../about/Ourstoryhero";
import {
  Plane, MapPin, Briefcase, Clock, Mail, Phone,
  ChevronDown, Globe, TrendingUp, Users, Heart,
  CheckCircle, Circle, ArrowRight,
} from "lucide-react";

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
    <div ref={ref} className={className} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : "translateY(22px)",
      transition: `opacity 0.6s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.6s cubic-bezier(.4,0,.2,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
const HERO_STATS = [
  { value: "4",    label: "Open Positions"   },
  { value: "50+",  label: "Destinations"     },
  { value: "10K+", label: "Happy Travellers" },
];

const PERKS = [
  { icon: Globe,      title: "FAM Trips",         desc: "Explore destinations firsthand on company-sponsored familiarisation tours." },
  { icon: TrendingUp, title: "Fast Growth",        desc: "Early-stage company — your impact is visible, and promotions are merit-based." },
  { icon: Users,      title: "Collaborative Team", desc: "Small, focused team where every person's work directly shapes company outcomes." },
  { icon: Heart,      title: "Travel Perks",       desc: "Exclusive discounts on personal travel bookings for you and your family." },
];

const OPENINGS = [
  {
    id: 1,
    title:       "Sales Executive",
    department:  "Sales",
    type:        "Full-time",
    location:    "Shimla, HP",
    experience:  "1–3 Years",
    badge:       "Urgent Hiring",
    badgeCls:    "bg-red-50 text-red-600 border border-red-200",
    description: "Drive revenue by converting inbound leads into confirmed bookings. You'll engage with prospective travellers across phone, WhatsApp, and email — understanding their requirements and presenting the right packages with confidence.",
    responsibilities: [
      "Handle inbound enquiries and follow up on leads from Google Ads and organic channels",
      "Understand customer travel requirements and recommend suitable packages",
      "Achieve monthly booking and revenue targets",
      "Maintain accurate lead records in the CRM",
      "Coordinate with the operations team post-confirmation",
    ],
    requirements: [
      "1–3 years of sales experience (travel industry preferred)",
      "Strong verbal communication in Hindi and English",
      "Comfort working with CRM tools and WhatsApp Business",
      "Target-driven with a customer-first mindset",
    ],
  },
  {
    id: 2,
    title:       "Travel Expert",
    department:  "Product",
    type:        "Full-time",
    location:    "Shimla, HP",
    experience:  "2–4 Years",
    badge:       "Open",
    badgeCls:    "bg-green-50 text-green-700 border border-green-200",
    description: "Craft memorable travel experiences by designing detailed, accurate, and competitive tour packages. You are the backbone of our product — your itinerary knowledge directly impacts what we sell and how customers experience their journeys.",
    responsibilities: [
      "Research and build itineraries for HP, Kashmir, Rajasthan, Goa, and international destinations",
      "Source, negotiate, and manage hotel, transport, and activity vendor relationships",
      "Price packages competitively while maintaining healthy margins",
      "Ensure all itinerary documentation is accurate and up-to-date",
      "Support the sales team with destination knowledge during customer calls",
    ],
    requirements: [
      "2–4 years in travel operations or tour planning",
      "Strong knowledge of domestic destinations (HP, Kashmir, Rajasthan mandatory)",
      "Vendor negotiation and costing experience",
      "Detail-oriented with excellent written communication",
    ],
  },
  {
    id: 3,
    title:       "Business Development Manager",
    department:  "Growth",
    type:        "Full-time",
    location:    "Shimla / Remote",
    experience:  "4–7 Years",
    badge:       "Senior Role",
    badgeCls:    "bg-indigo-50 text-indigo-700 border border-indigo-200",
    description: "Own our B2B and partnership growth strategy. You will identify and close partnerships with corporates, schools, travel agents, and international inbound operators — expanding our distribution beyond direct consumer channels.",
    responsibilities: [
      "Identify and develop B2B partnerships with corporates, educational institutions, and travel agents",
      "Build and manage a pipeline of channel partners across North India",
      "Lead outreach for international inbound tourism from UK, USA, Australia, and GCC markets",
      "Negotiate and finalise partnership agreements",
      "Represent Dreams Yatri at travel trade fairs and networking events",
    ],
    requirements: [
      "4–7 years in business development, preferably in travel or hospitality",
      "Proven B2B sales track record with a strong professional network",
      "Excellent presentation and negotiation skills",
      "Willingness to travel for client meetings and trade events",
    ],
  },
  {
    id: 4,
    title:       "Operations Manager",
    department:  "Operations",
    type:        "Full-time",
    location:    "Shimla, HP",
    experience:  "3–6 Years",
    badge:       "Open",
    badgeCls:    "bg-green-50 text-green-700 border border-green-200",
    description: "Own the end-to-end execution of confirmed tours — from vendor coordination to on-trip customer support. You ensure every traveller experience matches what was promised at the point of sale, protecting our brand and reputation.",
    responsibilities: [
      "Coordinate with hotels, transporters, and guides to ensure seamless tour execution",
      "Manage last-minute changes, cancellations, and on-trip escalations",
      "Oversee documentation: vouchers, confirmations, and travel kits",
      "Monitor vendor quality and address service failures proactively",
      "Build and maintain relationships with key vendors across all active destinations",
    ],
    requirements: [
      "3–6 years in travel operations or tour management",
      "Strong vendor network in Himachal Pradesh preferred",
      "Calm under pressure with exceptional problem-solving skills",
      "Proficient in MS Office; experience with booking systems is a plus",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// JobCard — smooth animated accordion
// ─────────────────────────────────────────────────────────────────────────────
function JobCard({
  job, isOpen, onToggle,
}: {
  job: typeof OPENINGS[0]; isOpen: boolean; onToggle: () => void;
}) {
  const bodyRef  = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useEffect(() => {
    if (bodyRef.current) setH(isOpen ? bodyRef.current.scrollHeight : 0);
  }, [isOpen]);

  const mailSubject = encodeURIComponent(`Application for ${job.title} — Dreams Yatri`);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all duration-200
      ${isOpen
        ? "border-red-200 shadow-xl shadow-red-500/[0.06] bg-white"
        : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      {/* Header button */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 focus:outline-none"
      >
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${job.badgeCls}`}>
              {job.badge}
            </span>
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
              {job.department}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-gray-900 mb-3 leading-snug pr-4">
            {job.title}
          </h3>

          {/* Meta */}
          <div className="flex flex-wrap gap-4">
            {[
              { Icon: MapPin,    text: job.location  },
              { Icon: Briefcase, text: job.type      },
              { Icon: Clock,     text: job.experience},
            ].map(({ Icon, text }, i) => (
              <span key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
                <Icon size={11} className="text-gray-300 flex-shrink-0" />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Chevron */}
        <span className={`flex-shrink-0 mt-1 w-8 h-8 rounded-lg border flex items-center
                          justify-center transition-all duration-200
                          ${isOpen
                            ? "rotate-180 bg-red-50 border-red-200 text-red-500"
                            : "rotate-0 bg-gray-50 border-gray-200 text-gray-400"
                          }`}>
          <ChevronDown size={15} />
        </span>
      </button>

      {/* Animated body */}
      <div style={{ height: h, overflow: "hidden", transition: "height 0.35s cubic-bezier(.4,0,.2,1)" }}>
        <div ref={bodyRef}>
          <div className="px-6 pb-6 border-t border-gray-100">
            <p className="text-gray-500 text-sm leading-relaxed mt-5 mb-6">
              {job.description}
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {/* What You'll Do */}
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-700 mb-3">
                  What You'll Do
                </p>
                <ul className="flex flex-col gap-2.5">
                  {job.responsibilities.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                      <CheckCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What We're Looking For */}
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-700 mb-3">
                  What We're Looking For
                </p>
                <ul className="flex flex-col gap-2.5">
                  {job.requirements.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                      <Circle size={13} className="text-red-300 flex-shrink-0 mt-0.5" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Apply row */}
            <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-gray-100">
              <a
                href={`mailto:hr@dreamsyatri.com?subject=${mailSubject}`}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white
                           font-bold text-sm px-5 py-2.5 rounded-xl transition-colors no-underline"
                style={{ boxShadow: "0 3px 12px rgba(239,68,68,0.3)" }}
              >
                <Mail size={14} />
                Apply via Email
              </a>
              <p className="text-xs text-gray-400">
                Send CV to{" "}
                <strong className="text-gray-700 font-semibold">hr@dreamsyatri.com</strong>
                {" "}· Subject: <em>"{job.title} — Dreams Yatri"</em>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
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
                fontSize:   "clamp(2.2rem, 5.5vw, 3.8rem)",
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
                       fontSize:   "clamp(1.8rem, 4vw, 2.4rem)",
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
            <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">
              Life at Dreams Yatri
            </p>
            <h2 className="font-bold text-gray-900"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize:   "clamp(1.6rem, 3vw, 2.2rem)",
                }}>
              Why Work With Us
            </h2>
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

        {/* OPENINGS */}
        <section className="mb-16">
          <Reveal className="text-center mb-10">
            <p className="text-xs font-bold tracking-widest uppercase text-red-500 mb-3">
              Current Openings
            </p>
            <h2 className="font-bold text-gray-900 mb-3"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize:   "clamp(1.6rem, 3vw, 2.2rem)",
                }}>
              Find Your Role
            </h2>
            <p className="text-gray-400 text-sm" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              To apply, email your CV to{" "}
              <a href="mailto:hr@dreamsyatri.com"
                 className="text-red-500 font-semibold underline underline-offset-2 hover:text-red-600 transition-colors">
                hr@dreamsyatri.com
              </a>
            </p>
          </Reveal>

          <div className="flex flex-col gap-3">
            {OPENINGS.map((job, i) => (
              <Reveal key={job.id} delay={i * 50}>
                <JobCard
                  job={job}
                  isOpen={openId === job.id}
                  onToggle={() => toggle(job.id)}
                />
              </Reveal>
            ))}
          </div>
        </section>

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
                      fontSize:   "clamp(1.2rem, 2.5vw, 1.6rem)",
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
                  { n: "01", t: "Choose your role",
                    d: "Read the JDs above and pick the opening that matches your background." },
                  { n: "02", t: "Email your CV",
                    d: "Send it to hr@dreamsyatri.com with your name and role in the subject line." },
                  { n: "03", t: "We'll call you",
                    d: "Our HR team reviews applications within 3 working days and reaches out directly." },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                                 text-xs font-extrabold"
                      style={{
                        background:  "rgba(239,68,68,0.15)",
                        color:       "#EF4444",
                        fontFamily:  "'Playfair Display', serif",
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
                      fontSize:   "clamp(1.2rem, 2.5vw, 1.55rem)",
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
                  { href: "mailto:hr@dreamsyatri.com", Icon: Mail,  label: "Email HR", value: "hr@dreamsyatri.com" },
                  { href: "tel:+917023907023",         Icon: Phone, label: "Call Us",  value: "+91 70239 07023"  },
                  { href: "tel:+917023907099",         Icon: Phone, label: "Alternate",value: "+91 70239 07099"  },
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
            backgroundSize:  "26px 26px",
          }}
        />
        <Reveal className="relative z-10 max-w-xl mx-auto">
          <h2
            className="text-white font-extrabold mb-3"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize:   "clamp(1.5rem, 3.5vw, 2.2rem)",
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