"use client";

import { useState, useMemo, useRef, useEffect, useContext } from "react";
import {
  Search, Phone, Mail, MessageCircle,
  MapPin, CreditCard, Shield, Plane, Users, Clock,
  HelpCircle, Star, CheckCircle, X,
} from "lucide-react";
import { useContact } from "@/app/context/Global";
import Hero from "../components/Hero";
import Accordion from "@/app/components/ui/Accordian";
import { FAQS } from "./faq";
import Cta from "../components/Cta";
import HeroTitle from "../components/HeroTitle";

// ── Reveal on scroll ──────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(22px)", transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ── FAQ Data ──────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "booking", label: "Booking & Payments", icon: <CreditCard size={16} />, color: "#EF4444" },
  { id: "itinerary", label: "Itinerary & Planning", icon: <MapPin size={16} />, color: "#F97316" },
  { id: "travel", label: "Travel & Logistics", icon: <Plane size={16} />, color: "#0EA5E9" },
  { id: "safety", label: "Safety & Support", icon: <Shield size={16} />, color: "#10B981" },
  { id: "group", label: "Groups & Families", icon: <Users size={16} />, color: "#8B5CF6" },
  { id: "cancellation", label: "Cancellations & Refunds", icon: <Clock size={16} />, color: "#F59E0B" },
  { id: "international", label: "International Trips", icon: <Star size={16} />, color: "#EC4899" },
  { id: "general", label: "General", icon: <HelpCircle size={16} />, color: "#6B7280" },
];


// ── Page ──────────────────────────────────────────────────────────────────────
export default function FAQPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const contact = useContact();


  // Filter logic
  const results = useMemo(() => {
    let list = FAQS;
    if (activeCategory !== "all") list = list.filter((f) => f.cat === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
    }
    return list;
  }, [query, activeCategory]);

  // Reset open item on filter change
  useEffect(() => { setOpenId(null); }, [activeCategory, query]);

  const clearSearch = () => { setQuery(""); searchRef.current?.focus(); };

  // Group results by category for display
  const grouped = useMemo(() => {
    if (query.trim()) return [{ catId: "search", catLabel: `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`, items: results }];
    if (activeCategory !== "all") {
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      return [{ catId: activeCategory, catLabel: cat?.label ?? "", items: results }];
    }
    return CATEGORIES.map((cat) => ({
      catId: cat.id,
      catLabel: cat.label,
      items: results.filter((f) => f.cat === cat.id),
    })).filter((g) => g.items.length > 0);
  }, [results, query, activeCategory]);

  return (
    <div className="bg-white min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');
        @keyframes hero-rise {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes search-glow {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%      { box-shadow: 0 0 0 6px rgba(239,68,68,0.08); }
        }
        .faq-search:focus { outline: none; box-shadow: 0 0 0 3px rgba(239,68,68,0.15); border-color: #EF4444; }
        .cat-chip { transition: all 0.18s; border: 1.5px solid #E5E7EB; }
        .cat-chip:hover { border-color: #FECACA; background: #FEF2F2; color: #DC2626; }
        .cat-chip.active { background: #EF4444; border-color: #EF4444; color: white; }
        .contact-card { transition: all 0.2s; }
        .contact-card:hover { border-color: #FECACA; box-shadow: 0 8px 28px rgba(239,68,68,0.08); transform: translateY(-2px); }
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <Hero>

        <div className="max-w-6xl mx-auto px-6 sm:px-8 relative z-10">
          <div className="max-w-2xl">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase"
              style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#FCA5A5", animation: "hero-rise 0.5s ease both" }}>
              <HelpCircle size={11} />
              Help Centre
            </div>

            <HeroTitle highlight="Questions" paragraph="Everything you need to know before, during, and after booking with Dreams Yatri. Can't find your answer? Our team is one call away.">
              Frequently Asked
            </HeroTitle>

            {/* Search bar */}
            <div className="relative max-w-xl" style={{ animation: "hero-rise 0.55s ease 0.24s both" }}>
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveCategory("all"); }}
                placeholder="Search questions… e.g. cancellation, visa, payment"
                className="faq-search w-full pl-11 pr-11 py-3.5 rounded-xl bg-white text-gray-900 text-sm border border-gray-200 transition-all"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
              {query && (
                <button type="button" onClick={clearSearch} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-6 mt-8" style={{ animation: "hero-rise 0.55s ease 0.32s both" }}>
              {[{ v: `${FAQS.length}+`, l: "Questions Answered" }, { v: "8", l: "Topic Categories" }, { v: "24/7", l: "Support Available" }].map((s, i) => (
                <div key={i}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>{s.v}</p>
                  <p className="text-gray-500 text-xs mt-1 font-semibold tracking-widest uppercase">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Hero>



      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 pb-20">

        {/* Category chips */}
        {!query && (
          <Reveal className="py-8">
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`cat-chip px-4 py-2 rounded-full text-xs font-bold cursor-pointer bg-white text-gray-600 ${activeCategory === "all" ? "active" : ""}`}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                All Topics ({FAQS.length})
              </button>
              {CATEGORIES.map((cat) => {
                const count = FAQS.filter((f) => f.cat === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`cat-chip px-4 py-2 rounded-full text-xs font-bold cursor-pointer bg-white flex items-center gap-1.5 ${activeCategory === cat.id ? "active" : "text-gray-600"}`}
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    <span style={{ color: activeCategory === cat.id ? "rgba(255,255,255,0.8)" : cat.color }}>{cat.icon}</span>
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>
          </Reveal>
        )}

        {query && (
          <div className="pt-6 pb-2">
            <p className="text-sm text-gray-500">
              {results.length > 0
                ? <><span className="font-bold text-gray-900">{results.length}</span> result{results.length !== 1 ? "s" : ""} for "<span className="text-red-500 font-semibold">{query}</span>"</>
                : <>No results for "<span className="text-red-500 font-semibold">{query}</span>" — try different keywords or <button type="button" onClick={clearSearch} className="underline text-red-500 font-semibold">browse all topics</button></>}
            </p>
          </div>
        )}

        {/* FAQ sections */}
        <div className="mt-2">
          {grouped.length === 0 && query && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-300" />
              </div>
              <p className="text-gray-900 font-bold text-lg mb-2">No matches found</p>
              <p className="text-gray-500 text-sm mb-6">Try searching for "cancellation", "visa", "group booking", or "payment".</p>
              <button type="button" onClick={clearSearch}
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                View all questions
              </button>
            </div>
          )}

          {grouped.map((group, gi) => {
            const catMeta = CATEGORIES.find((c) => c.id === group.catId);
            return (
              <div key={group.catId} className={gi > 0 ? "mt-12" : ""}>
                {/* Group heading */}
                <Reveal className="flex items-center gap-3 mb-5">
                  {catMeta && (
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${catMeta.color}18`, color: catMeta.color }}
                    >
                      {catMeta.icon}
                    </span>
                  )}
                  <h2
                    className="text-gray-900 font-bold text-lg"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {group.catLabel}
                  </h2>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 font-semibold flex-shrink-0">{group.items.length} Q{group.items.length !== 1 ? "s" : ""}</span>
                </Reveal>

                {/* Accordion items */}
                <Accordion
                  variant="default"
                  multiple={false} // only one open at a time
                  className="flex flex-col gap-2.5"
                >
                  {group.items.map((item) => (
                    <Accordion.Item key={item.id} id={String(item.id)}>

                      <Accordion.Trigger className="justify-between">
                        <span className="font-semibold text-gray-900 text-sm leading-relaxed pr-2">
                          {item.q}
                        </span>

                        <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500">
                          <Accordion.Chevron />
                        </span>
                      </Accordion.Trigger>

                      <Accordion.Content>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {item.a}
                        </p>
                      </Accordion.Content>

                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            );
          })}
        </div>

        {/* ── Still have questions? ──────────────────────────────────────── */}
        {!query && activeCategory === "all" && (
          <Reveal className="mt-16 bg-gray-50 shadow-md border border-gray-100 rounded-2xl p-7 sm:p-9 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
              <CheckCircle size={22} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 mb-1">Didn't find what you were looking for?</p>
              <p className="text-gray-500 text-sm leading-relaxed">Use the search bar above or browse by topic. Still stuck? Our team will answer any question within a few hours.</p>
            </div>
            <a href={contact.support.emailUrl}
              className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors flex-shrink-0 no-underline"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: "0 3px 12px rgba(239,68,68,0.3)" }}>
              <Mail size={14} />
              Email Us
            </a>
          </Reveal>
        )}
      </div>

      {/* ── CONTACT SECTION ───────────────────────────────────────────────── */}
      <section className="bg-gray-950 py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">

          <Reveal className="text-center mb-14">
            <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-3">Still Need Help?</p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem, 3.5vw, 2.6rem)", fontWeight: 800, color: "#fff", margin: "0 0 14px" }}>
              Talk to a real person.{" "}
              <span style={{ color: "#EF4444", fontStyle: "italic" }}>Right now.</span>
            </h2>
            <p className="text-gray-400 max-w-md mx-auto leading-relaxed" style={{ fontSize: "15px" }}>
              No bots. No hold music. Our sales and support teams are here Monday to Saturday, 9 AM to 7 PM — and our emergency line runs 24/7.
            </p>
          </Reveal>

          {/* Contact cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">

            {/* Sales */}
            <Reveal delay={0}>
              <div className="contact-card bg-white/[0.04] border border-white/10 rounded-2xl p-7 h-full flex flex-col">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)" }}>
                  <Plane size={20} className="text-red-400" />
                </div>
                <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-1">Sales Team</p>
                <h3 className="text-white font-bold text-lg mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Plan a New Trip</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">
                  Looking to book a package or need a customised itinerary? Talk to our travel experts — they'll design something perfect for you.
                </p>
                <div className="flex flex-col gap-3 mt-auto">
                  <a href={contact.sales.phoneUrl}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-all no-underline group">
                    <Phone size={15} className="text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                      <p className="text-white font-semibold text-sm">{contact.sales.phone}</p>
                    </div>
                  </a>
                  <a href="mailto:sales@dreamsyatri.com"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-all no-underline">
                    <Mail size={15} className="text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Email</p>
                      <p className="text-white font-semibold text-sm">{contact.sales.email}</p>
                    </div>
                  </a>
                </div>
                <p className="text-gray-600 text-xs mt-4 flex items-center gap-1.5">
                  <Clock size={11} /> Mon – Sat, 9 AM – 7 PM IST
                </p>
              </div>
            </Reveal>

            {/* Support */}
            <Reveal delay={80}>
              <div className="contact-card bg-white/[0.04] border border-white/10 rounded-2xl p-7 h-full flex flex-col">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 flex-shrink-0" style={{ background: "rgba(16,185,129,0.15)" }}>
                  <Shield size={20} className="text-emerald-400" />
                </div>
                <p className="text-xs font-bold tracking-widest uppercase text-emerald-400 mb-1">Support Team</p>
                <h3 className="text-white font-bold text-lg mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Help with an Existing Trip</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">
                  Already booked? Questions about your itinerary, hotel, or transfer? Our support team handles amendments, cancellations, and on-trip emergencies.
                </p>
                <div className="flex flex-col gap-3 mt-auto">
                  <a href={contact.support.phoneUrl}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 transition-all no-underline">
                    <Phone size={15} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                      <p className="text-white font-semibold text-sm">{contact.support.phone}</p>
                    </div>
                  </a>
                  <a href={contact.support.emailUrl}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 transition-all no-underline">
                    <Mail size={15} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Email</p>
                      <p className="text-white font-semibold text-sm">{contact.support.email}</p>
                    </div>
                  </a>
                </div>
                <p className="text-gray-600 text-xs mt-4 flex items-center gap-1.5">
                  <Clock size={11} /> 24/7 for on-trip emergencies
                </p>
              </div>
            </Reveal>

            {/* WhatsApp */}
            <Reveal delay={160}>
              <div className="contact-card bg-white/[0.04] border border-white/10 rounded-2xl p-7 h-full flex flex-col">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 flex-shrink-0" style={{ background: "rgba(37,211,102,0.12)" }}>
                  <MessageCircle size={20} style={{ color: "#25D366" }} />
                </div>
                <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: "#25D366" }}>WhatsApp</p>
                <h3 className="text-white font-bold text-lg mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Chat With Us Instantly</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6 flex-1">
                  Prefer messaging? Drop us a WhatsApp message anytime. Share your query, get a quote, or ask a quick question — we typically reply within minutes.
                </p>
                <a
                  href={contact.whatsapp.phoneUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all no-underline mt-auto"
                  style={{ background: "#25D366", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif", boxShadow: "0 3px 14px rgba(37,211,102,0.25)" }}
                >
                  <MessageCircle size={16} />
                  Open WhatsApp
                </a>
                <p className="text-gray-600 text-xs mt-4 flex items-center gap-1.5">
                  <Clock size={11} /> Usually responds in under 10 min
                </p>
              </div>
            </Reveal>
          </div>

          {/* Office info strip */}
          <Reveal>
            <div className="border border-white/10 rounded-2xl px-7 py-5 flex flex-wrap items-center gap-6 justify-around">
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Head Office</p>
                  <p className="text-white text-sm font-semibold">Shimla, Himachal Pradesh – 171001</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-white/10" />
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Office Hours</p>
                  <p className="text-white text-sm font-semibold">Mon – Sat, 9:00 AM – 7:00 PM IST</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-white/10" />
              <div className="flex items-center gap-3">
                <Shield size={16} className="text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Emergency Line</p>
                  <p className="text-white text-sm font-semibold">24/7 for active bookings</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>


      <Cta />


    </div>
  );
}