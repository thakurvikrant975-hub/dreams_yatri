"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, ChevronDown, Phone, Mail, MessageCircle,
  MapPin, CreditCard, Shield, Plane, Users, Clock,
  HelpCircle, Star, CheckCircle, X,
} from "lucide-react";

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
  { id: "booking",       label: "Booking & Payments",    icon: <CreditCard size={16} />,      color: "#EF4444" },
  { id: "itinerary",     label: "Itinerary & Planning",  icon: <MapPin size={16} />,           color: "#F97316" },
  { id: "travel",        label: "Travel & Logistics",    icon: <Plane size={16} />,            color: "#0EA5E9" },
  { id: "safety",        label: "Safety & Support",      icon: <Shield size={16} />,           color: "#10B981" },
  { id: "group",         label: "Groups & Families",     icon: <Users size={16} />,            color: "#8B5CF6" },
  { id: "cancellation",  label: "Cancellations & Refunds", icon: <Clock size={16} />,          color: "#F59E0B" },
  { id: "international", label: "International Trips",   icon: <Star size={16} />,             color: "#EC4899" },
  { id: "general",       label: "General",               icon: <HelpCircle size={16} />,       color: "#6B7280" },
];

const FAQS = [
  // Booking & Payments
  { id: 1, cat: "booking", q: "How do I book a trip with Dreams Yatri?", a: "You can book by filling out the enquiry form on our website, calling us directly at +91 70239 07023, or emailing us at sales@dreamsyatri.com. Our team will get back to you within a few hours to discuss your requirements and share a customised itinerary." },
  { id: 2, cat: "booking", q: "What payment methods do you accept?", a: "We accept UPI, NEFT/IMPS bank transfers, credit/debit cards, and EMI options for select packages. A booking is confirmed only after the advance payment is received." },
  { id: 3, cat: "booking", q: "How much advance do I need to pay to confirm a booking?", a: "Typically 25–30% of the total package cost is required to confirm your booking. The remaining amount is collected 7–10 days before your departure date. For last-minute bookings, full payment may be required upfront." },
  { id: 4, cat: "booking", q: "Is my booking confirmed immediately after payment?", a: "Yes. Once your advance payment is received, we send you a formal booking confirmation with your itinerary, hotel vouchers, transport details, and emergency contact numbers within 24 hours." },
  { id: 5, cat: "booking", q: "Do you offer EMI options for expensive packages?", a: "Yes, EMI options are available for packages above ₹30,000 through select credit cards and BNPL partners. Ask our sales team for the latest options when you enquire." },
  { id: 6, cat: "booking", q: "Is the price fixed or can it change after booking?", a: "Once your booking is confirmed in writing and advance payment received, the package price is locked. Any price changes due to fuel surcharges, hotel rate increases, or tax revisions are communicated before confirmation — never after." },

  // Itinerary & Planning
  { id: 7, cat: "itinerary", q: "Can I customise my itinerary?", a: "Absolutely — in fact, that's our default. Tell us your travel dates, group size, budget, interests (adventure, heritage, leisure, pilgrimage), and any specific places you want to visit. We build the itinerary around you, not the other way around." },
  { id: 8, cat: "itinerary", q: "How far in advance should I book?", a: "We recommend booking at least 15–20 days in advance for domestic trips and 30–45 days for international packages to ensure the best availability and pricing. For peak seasons (December–January, summer, and festive periods), booking 60–90 days ahead is strongly advised." },
  { id: 9, cat: "itinerary", q: "Do you provide hotel recommendations or does the traveller choose?", a: "We provide hotel recommendations across budget, standard, and premium tiers based on your preferences. You can choose from our curated list or request alternatives. All our partner hotels are verified by our team." },
  { id: 10, cat: "itinerary", q: "What is included in a typical package?", a: "A standard package includes accommodation, meals as per the itinerary (CP/MAP/AP basis), transfers (airport/railway to hotel and all sightseeing), a guide where applicable, and emergency support. Flights and personal expenses are typically excluded unless specifically mentioned." },
  { id: 11, cat: "itinerary", q: "Can you add activities or experiences to my itinerary?", a: "Yes. We can arrange adventure activities (trekking, white water rafting, paragliding), cultural experiences, cooking classes, wildlife safaris, and more. Let us know your interests and we'll incorporate them." },
  { id: 12, cat: "itinerary", q: "Do you provide a guide at every destination?", a: "Local guides are included for destinations where they add significant value (heritage cities, wildlife reserves, pilgrimage sites). For leisure beach or hill station trips, a dedicated guide may not be necessary — but our support team is always reachable." },

  // Travel & Logistics
  { id: 13, cat: "travel", q: "Are flights/trains included in your packages?", a: "By default, most packages cover ground transfers only. We can assist with flight or train bookings as an add-on and recommend the best routes. The final package quote will clearly specify what's included." },
  { id: 14, cat: "travel", q: "What type of vehicles do you use for transfers?", a: "We use well-maintained, air-conditioned vehicles appropriate for the terrain — hatchbacks or sedans for flat routes, SUVs and Innova Crystas for mountain routes (Himachal, Ladakh, Uttarakhand). All vehicles are operated by experienced local drivers." },
  { id: 15, cat: "travel", q: "What happens if my flight is delayed and I miss the pick-up?", a: "Inform us as soon as you know about the delay. Our operations team will reschedule your pick-up at no extra charge. We monitor your flight and proactively adjust logistics wherever possible." },
  { id: 16, cat: "travel", q: "Do you arrange airport or railway station pick-up and drop?", a: "Yes. Airport and railway station transfers are included in most packages. Share your arrival and departure details at the time of booking and everything will be pre-arranged." },
  { id: 17, cat: "travel", q: "What should I pack for a hill station or mountain trip?", a: "Layered clothing is key for hill stations. Carry thermal innerwear, a good windcheater or down jacket, sturdy walking shoes, sunscreen, sunglasses, and a first-aid kit. For high-altitude destinations (Ladakh, Spiti), acclimatisation medication is recommended — consult your doctor beforehand." },
  { id: 18, cat: "travel", q: "Is connectivity available at all destinations?", a: "Major destinations have good mobile connectivity. Remote areas like Spiti Valley, some parts of Ladakh, and deep forest regions may have limited or no network. We brief you in advance about connectivity and recommend offline maps and downloaded content." },

  // Safety & Support
  { id: 19, cat: "safety", q: "What happens in a travel emergency?", a: "Our operations team is reachable 24/7. Every traveller receives an emergency contact number before departure. In the event of a medical emergency, vehicle breakdown, or natural disruption, we coordinate alternative arrangements and keep you informed at every step." },
  { id: 20, cat: "safety", q: "Is travel insurance included?", a: "Travel insurance is not included by default but is strongly recommended. We can help you purchase a suitable policy. For international packages, travel insurance covering medical emergencies and trip cancellation is mandatory." },
  { id: 21, cat: "safety", q: "Are your partner hotels safe and verified?", a: "Yes. Every hotel in our network has been physically inspected or verified by our team. We only work with properties that meet our minimum standards for cleanliness, safety, and location. If a property doesn't meet the mark on arrival, we arrange an alternative at no cost to you." },
  { id: 22, cat: "safety", q: "Is it safe to travel solo with Dreams Yatri?", a: "Yes. We have extensive experience with solo travellers, including solo female travellers. Our team checks in daily, your transfers and stays are all confirmed in advance, and you always have a direct line to our support team throughout your trip." },
  { id: 23, cat: "safety", q: "Do you share our personal and payment data?", a: "No. Your data is used solely for trip planning and coordination. We do not share personal or payment information with third parties. Our systems comply with standard data protection practices." },

  // Groups & Families
  { id: 24, cat: "group", q: "Do you handle group bookings?", a: "Yes. We specialise in group travel — corporate offsites, school/college trips, wedding groups, and family reunions. Groups of 10+ get dedicated account management and preferential pricing." },
  { id: 25, cat: "group", q: "Can you accommodate senior citizens or travellers with mobility needs?", a: "Absolutely. We plan trips keeping physical comfort and medical needs in mind. Slower pace, ground-floor rooms, accessible transport, and medical proximity are all factors we factor in. Just share requirements at enquiry stage." },
  { id: 26, cat: "group", q: "Can you plan a family trip with young children?", a: "Yes — family trips are one of our most booked categories. We choose child-friendly hotels, activities suitable for different age groups, and ensure meal flexibility. We also advise on the best destinations for families with specific age groups." },
  { id: 27, cat: "group", q: "Do you organise honeymoon packages?", a: "Yes. Our honeymoon packages are designed for privacy, romance, and surprise moments — candlelight setups, scenic room upgrades, shikara rides, and curated experiences. Share your vision and we'll bring it to life." },
  { id: 28, cat: "group", q: "Can you handle corporate team outings or offsites?", a: "Yes. We handle corporate travel end-to-end — from destination scouting and hotel negotiation to team activity planning and logistics. We've organised offsites for teams ranging from 15 to 200+ people." },

  // Cancellations & Refunds
  { id: 29, cat: "cancellation", q: "What is your cancellation policy?", a: "Cancellation charges depend on how far in advance you cancel: 30+ days before travel — 10% deduction; 15–29 days — 25% deduction; 7–14 days — 50% deduction; less than 7 days — 75–100% deduction. Specific terms are mentioned in your booking confirmation." },
  { id: 30, cat: "cancellation", q: "How do I request a cancellation or modification?", a: "Contact us via email at support@dreamsyatri.com or call +91 70239 07099. All cancellations and modifications must be confirmed in writing. Verbal requests are not processed." },
  { id: 31, cat: "cancellation", q: "How long does a refund take?", a: "Refunds are processed within 7–10 business days after cancellation confirmation. The amount is returned to the original payment source. Bank transfer refunds may take an additional 2–3 business days to reflect." },
  { id: 32, cat: "cancellation", q: "What if the trip is cancelled due to a natural disaster or government advisory?", a: "In cases of force majeure — natural disasters, political unrest, government travel bans — we offer full rescheduling at no charge, or a refund minus actual non-recoverable costs (hotel deposits, activity pre-payments). We always try to protect your money." },
  { id: 33, cat: "cancellation", q: "Can I reschedule my trip to a different date?", a: "Yes, rescheduling is allowed subject to availability and supplier terms. If rescheduled more than 15 days before travel, there is typically no rescheduling fee. Last-minute rescheduling may incur a fee — speak to our team for your specific case." },

  // International Trips
  { id: 34, cat: "international", q: "Do you assist with visa applications?", a: "Yes. For international packages, we provide complete visa guidance — document checklist, application form support, and tracking. For UAE (Dubai) and Thailand, we assist with visa-on-arrival or e-visa applications. Visa fee is not included in the package cost." },
  { id: 35, cat: "international", q: "Which international destinations do you cover?", a: "Currently we offer packages for Dubai, Thailand (Bangkok, Phuket, Krabi), Southeast Asia (Singapore, Bali, Vietnam), and select European destinations. We are actively expanding our international portfolio." },
  { id: 36, cat: "international", q: "Is travel insurance mandatory for international trips?", a: "Yes, travel insurance covering medical emergencies, trip cancellation, and baggage loss is mandatory for all international packages. We can help you purchase a suitable policy." },
  { id: 37, cat: "international", q: "What currency should I carry for international trips?", a: "We advise carrying USD or Euro as a base currency, along with the local currency of your destination. We provide a currency and spending guide as part of your pre-departure briefing. We also recommend a multi-currency forex card." },
  { id: 38, cat: "international", q: "Will there be a language barrier at international destinations?", a: "At major tourist destinations like Dubai, Bangkok, Singapore, and Bali, English is widely spoken in hotels, restaurants, and tourist areas. Our partners at each destination are local and can assist in your language if needed." },

  // General
  { id: 39, cat: "general", q: "Where is Dreams Yatri based?", a: "We are headquartered in Shimla, Himachal Pradesh. Our local roots give us deep expertise in mountain travel across HP, Uttarakhand, and Kashmir — and our growing team covers all major Indian and select international destinations." },
  { id: 40, cat: "general", q: "How is Dreams Yatri different from booking on my own?", a: "When you book independently, you carry the entire logistics burden — hotel confirmations, transport coordination, backup plans, emergency contacts. We absorb all of that. You travel; we manage everything else. Our vendor network also gets you better rates and quality than most direct bookings." },
  { id: 41, cat: "general", q: "Do you have physical offices I can visit?", a: "Our primary office is in Shimla, Himachal Pradesh. While most of our consultations happen via phone and video call, you're welcome to visit in person. Call ahead to schedule an appointment." },
  { id: 42, cat: "general", q: "Can I speak to a real person before booking?", a: "Always. We don't do bots. Call +91 70239 07023 (Mon–Sat, 9 AM–7 PM) or WhatsApp us and a real travel expert will pick up. No automated menus, no hold music." },
  { id: 43, cat: "general", q: "Do you work with travel agents or only direct customers?", a: "We work with both. If you're a travel agent looking to partner with us for packages, reach out to our business development team at sales@dreamsyatri.com. We offer competitive B2B rates and dedicated account support." },
];

// ── Accordion Item ────────────────────────────────────────────────────────────
function AccordionItem({ item, isOpen, onToggle, index }: {
  item: typeof FAQS[0]; isOpen: boolean; onToggle: () => void; index: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) setHeight(isOpen ? contentRef.current.scrollHeight : 0);
  }, [isOpen]);

  return (
    <Reveal delay={index * 30}>
      <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${isOpen ? "border-red-200 shadow-sm shadow-red-500/5" : "border-gray-100 hover:border-gray-200"}`}>
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50/60 transition-colors"
        >
          <span className="font-semibold text-gray-900 text-sm leading-relaxed pr-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {item.q}
          </span>
          <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 mt-0.5 ${isOpen ? "bg-red-500 text-white rotate-180" : "bg-gray-100 text-gray-500"}`}>
            <ChevronDown size={14} />
          </span>
        </button>

        <div style={{ height, overflow: "hidden", transition: "height 0.3s ease" }}>
          <div ref={contentRef}>
            <div className="px-5 pb-5 pt-1 border-t border-gray-50">
              <p className="text-gray-600 text-sm leading-relaxed" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {item.a}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FAQPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
      <section className="relative bg-gray-950 overflow-hidden" style={{ paddingTop: "88px", paddingBottom: "72px" }}>

        {/* Grid texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "52px 52px" }} />

        {/* Red glow blobs */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-red-500/10 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 rounded-full bg-red-500/06 blur-[70px] pointer-events-none" />

        {/* Decorative question mark */}
        <div className="absolute right-8 sm:right-20 top-1/2 -translate-y-1/2 pointer-events-none select-none" aria-hidden="true">
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(120px, 18vw, 240px)", fontWeight: 800, fontStyle: "italic", color: "rgba(255,255,255,0.025)", lineHeight: 1 }}>?</span>
        </div>

        <div className="max-w-6xl mx-auto px-6 sm:px-8 relative z-10">
          <div className="max-w-2xl">

            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase"
              style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#FCA5A5", animation: "hero-rise 0.5s ease both" }}>
              <HelpCircle size={11} />
              Help Centre
            </div>

            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)", fontWeight: 800, color: "#fff", lineHeight: 1.1, margin: "0 0 16px", animation: "hero-rise 0.55s ease 0.08s both" }}>
              Frequently Asked{" "}
              <span style={{ color: "#EF4444", fontStyle: "italic" }}>Questions</span>
            </h1>

            <p className="text-gray-400 leading-relaxed mb-8"
              style={{ fontSize: "clamp(0.95rem, 1.8vw, 1.05rem)", maxWidth: "480px", animation: "hero-rise 0.55s ease 0.16s both" }}>
              Everything you need to know before, during, and after booking with Dreams Yatri. Can't find your answer? Our team is one call away.
            </p>

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
      </section>

      {/* Wave */}
      <svg className="block -mt-px bg-white" viewBox="0 0 1200 56" preserveAspectRatio="none" height="56" width="100%">
        <path d="M0 0 Q300 56 600 28 Q900 0 1200 38 L1200 0 Z" fill="#030712" />
      </svg>

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
                <div className="flex flex-col gap-2.5">
                  {group.items.map((item, idx) => (
                    <AccordionItem
                      key={item.id}
                      item={item}
                      index={idx}
                      isOpen={openId === item.id}
                      onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Still have questions? ──────────────────────────────────────── */}
        {!query && activeCategory === "all" && (
          <Reveal className="mt-16 bg-gray-50 border border-gray-100 rounded-2xl p-7 sm:p-9 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 flex-shrink-0">
              <CheckCircle size={22} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 mb-1">Didn't find what you were looking for?</p>
              <p className="text-gray-500 text-sm leading-relaxed">Use the search bar above or browse by topic. Still stuck? Our team will answer any question within a few hours.</p>
            </div>
            <a href="mailto:support@dreamsyatri.com"
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
                  <a href="tel:+917023907023"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-all no-underline group">
                    <Phone size={15} className="text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                      <p className="text-white font-semibold text-sm">+91 70239 07023</p>
                    </div>
                  </a>
                  <a href="mailto:sales@dreamsyatri.com"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 transition-all no-underline">
                    <Mail size={15} className="text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Email</p>
                      <p className="text-white font-semibold text-sm">sales@dreamsyatri.com</p>
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
                  <a href="tel:+917023907099"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 transition-all no-underline">
                    <Phone size={15} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                      <p className="text-white font-semibold text-sm">+91 70239 07099</p>
                    </div>
                  </a>
                  <a href="mailto:support@dreamsyatri.com"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 transition-all no-underline">
                    <Mail size={15} className="text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Email</p>
                      <p className="text-white font-semibold text-sm">support@dreamsyatri.com</p>
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
                  href="https://wa.me/917023907023?text=Hi%2C%20I%20have%20a%20question%20about%20booking%20with%20Dreams%20Yatri."
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
            <div className="border border-white/10 rounded-2xl px-7 py-5 flex flex-wrap items-center gap-6">
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

      {/* ── CTA strip ─────────────────────────────────────────────────────── */}
      <section className="bg-red-500 py-14 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
        <Reveal className="relative z-10 max-w-xl mx-auto">
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)", fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>
            Ready to plan your trip?
          </h2>
          <p className="text-red-100 text-sm leading-relaxed mb-7">
            Stop researching, start travelling. Our team will handle every detail.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="/contact" className="inline-flex items-center gap-2 bg-white text-red-500 hover:bg-red-50 font-bold px-7 py-3.5 rounded-xl text-sm transition-colors no-underline"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.14)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Plan My Trip
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
            <a href="tel:+917023907023" className="inline-flex items-center gap-2 border border-white/40 hover:border-white text-white font-semibold px-7 py-3.5 rounded-xl text-sm transition-all no-underline"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Phone size={14} /> +91 70239 07023
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}