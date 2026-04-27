"use client"

import { useState, useEffect, useRef } from "react";
import {
  Plane, MapPin, Hotel, Car, Compass, HeartHandshake,
  Clock, ShieldCheck, Star, ArrowRight, Quote,
  Camera, CheckCircle2, PhoneCall,
  Sparkles, Globe, Users, TrendingUp, ChevronLeft, ChevronRight,
  CalendarCheck, Headphones, Wallet, Mountain
} from "lucide-react";

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

const gallery = [
  { id: 1, src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80", label: "Swiss Alps", tag: "Europe" },
  { id: 2, src: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80", label: "Bali Temples", tag: "Asia" },
  { id: 3, src: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80", label: "Taj Mahal", tag: "India" },
  { id: 4, src: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=600&q=80", label: "Santorini", tag: "Greece" },
  { id: 5, src: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80", label: "Paris Streets", tag: "Europe" },
  { id: 6, src: "https://images.unsplash.com/photo-1501179691627-eeaa65ea017c?w=600&q=80", label: "Maldives", tag: "Ocean" },
  { id: 7, src: "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=600&q=80", label: "Desert Safari", tag: "Middle East" },
  { id: 8, src: "https://images.unsplash.com/photo-1548013146-72479768bada?w=600&q=80", label: "Ladakh Roads", tag: "India" },
];

const services = [
  { Icon: Hotel, title: "Hotel Booking", desc: "Handpicked, confirmed accommodations locked in before you pack — boutique stays to luxury resorts.", color: "text-red-500", bg: "bg-red-50", border: "border-red-100" },
  { Icon: Car, title: "Cab & Transfers", desc: "Airport pickups, city rides, outstation transfers. Driver details shared 24 hrs in advance. Always on time.", color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-100" },
  { Icon: Compass, title: "Activity Booking", desc: "Paragliding, safaris, city walks, food tours — every adventure curated and pre-booked for your vibe.", color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100" },
  { Icon: CalendarCheck, title: "Itinerary Planning", desc: "Share your dates and preferences. We send back a complete day-by-day plan — no research required.", color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-100" },
  { Icon: Headphones, title: "24/7 Support", desc: "Missed a flight? Hotel confusion? WhatsApp us at 2 AM. A real human responds in minutes.", color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-100" },
  { Icon: Wallet, title: "Best Price Promise", desc: "We negotiate rates you can't find online. Same quality, smarter price. No hidden fees, ever.", color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-100" },
];

const timelineData = [
  { year: "2018", title: "The Nightmare Trip", Icon: Mountain, desc: "Our founder landed in Manali at midnight — hotel unconfirmed, cab ghosted, phone at 3%. He stood in the cold in a strange city and thought: someone needs to fix this." },
  { year: "2019", title: "The Mission Takes Shape", Icon: Sparkles, desc: "After one too many panicked texts asking 'what do I do now?', the vision crystallised: build a travel service that removes every ounce of logistics anxiety." },
  { year: "2020", title: "Roamly is Born", Icon: Plane, desc: "Built from a laptop, fuelled by chai and conviction. One product, one promise — you travel, we handle every detail." },
  { year: "2021", title: "First 5,000 Travelers", Icon: Users, desc: "Word spread fast. Solo backpackers, honeymooners, families — all coming back with one thing in common: zero horror stories." },
  { year: "2022", title: "50,000 Happy Journeys", Icon: Globe, desc: "From Ladakh to Lombok, Rajasthan to Rome. 50,000 trips managed. A 98% hassle-free record that we're obsessively proud of." },
  { year: "2024", title: "200+ Destinations & Growing", Icon: TrendingUp, desc: "A team of 80 travel obsessives, 200+ destinations, and one singular obsession — making every trip feel effortless." },
];

const values = [
  { Icon: HeartHandshake, title: "Born from Real Pain", desc: "We didn't build this in a boardroom. We built it because we lived the chaos — unconfirmed hotels, missing cabs, and panicked midnight calls in unfamiliar cities.", color: "text-red-500", bg: "bg-red-50" },
  { Icon: ShieldCheck, title: "No Surprises, Ever", desc: "Full transparency on pricing, confirmations, and plans. What we promise, we deliver — every single time, without exception.", color: "text-emerald-500", bg: "bg-emerald-50" },
  { Icon: Star, title: "Travelers First", desc: "Every feature, every process, every decision starts with one question: does this make the traveler's experience better?", color: "text-amber-500", bg: "bg-amber-50" },
  { Icon: PhoneCall, title: "Real Humans, Always", desc: "No chatbots. No automated hold music. When you reach out, a real person who genuinely loves travel picks up.", color: "text-blue-500", bg: "bg-blue-50" },
];

const stats = [
  { number: "50K+", label: "Happy Travelers", Icon: Users },
  { number: "200+", label: "Destinations", Icon: Globe },
  { number: "98%", label: "Hassle-Free Rate", Icon: CheckCircle2 },
  { number: "24/7", label: "Expert Support", Icon: Clock },
];

const testimonials = [
  { name: "Priya S.", route: "Mumbai → Bali", text: "I literally just showed up at the airport. Hotel, cab, day trips — everything was already sorted. This is what travel should feel like.", initials: "PS" },
  { name: "Rahul M.", route: "Delhi → Manali", text: "The cab was waiting at the bus stand, the hotel was warm and confirmed. I've had so many bad trips before — this felt like a completely different world.", initials: "RM" },
  { name: "Ananya K.", route: "Bangalore → Rajasthan", text: "Eight of us with chaotic schedules. Roamly coordinated hotels, activities, and cabs for every single person. Zero drama. Just pure Rajasthan magic.", initials: "AK" },
];

const team = [
  { name: "Arjun Mehta", role: "Founder & Chief Explorer", Icon: Mountain, countries: "42 countries" },
  { name: "Simran Kaur", role: "Head of Experiences", Icon: Sparkles, countries: "38 countries" },
  { name: "Dev Patel", role: "Tech & Operations", Icon: Globe, countries: "29 countries" },
  { name: "Neha Sharma", role: "Customer Happiness", Icon: HeartHandshake, countries: "31 countries" },
];

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-0.5 bg-red-500" />
      <span className="text-red-500 text-xs font-bold uppercase tracking-widest">{children}</span>
    </div>
  );
}

function Gallery() {
  const [active, setActive] = useState(null);
  const [page, setPage] = useState(0);
  const perPage = 6;
  const total = Math.ceil(gallery.length / perPage);
  const visible = gallery.slice(page * perPage, page * perPage + perPage);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {visible.map((img, i) => (
          <Reveal key={img.id} delay={i * 0.06}>
            <div
              className="relative group cursor-pointer overflow-hidden rounded-2xl bg-gray-100"
              style={{ aspectRatio: "4/3" }}
              onClick={() => setActive(img)}
            >
              <img src={img.src} alt={img.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <span className="text-xs font-bold text-red-300 uppercase tracking-widest">{img.tag}</span>
                <p className="text-white font-bold text-sm">{img.label}</p>
              </div>
              <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={13} className="text-white" />
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      {total > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="p-2 rounded-full border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)}
              className={`h-2.5 rounded-full transition-all ${i === page ? "bg-red-500 w-6" : "bg-gray-300 hover:bg-gray-400 w-2.5"}`} />
          ))}
          <button onClick={() => setPage(p => Math.min(total - 1, p + 1))} disabled={page === total - 1}
            className="p-2 rounded-full border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      {active && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={active.src.replace("w=600", "w=1200")} alt={active.label} className="w-full rounded-2xl" />
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl">
              <span className="text-red-400 text-xs font-bold uppercase tracking-widest">{active.tag}</span>
              <p className="text-white text-xl font-bold">{active.label}</p>
            </div>
            <button onClick={() => setActive(null)}
              className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-white/30 transition-colors font-bold">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="bg-white" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ══ 1. HERO ══ */}
      <section className="relative min-h-[91vh] flex flex-col justify-center overflow-hidden bg-white pt-24 pb-20 px-6">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 80% 15%, rgba(239,68,68,0.07) 0%, transparent 50%), radial-gradient(circle at 15% 85%, rgba(239,68,68,0.05) 0%, transparent 50%)" }} />
        <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full bg-red-50 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-red-50/70 translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-4 py-2 mb-8">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-600 text-xs font-bold uppercase tracking-widest">Our Story</span>
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <h1 className="text-5xl sm:text-6xl font-black text-gray-900 leading-[1.1] mb-6" >
                  Travel Should<br />Feel Like{" "}
                  <span className="relative inline-block">
                    <span className="text-red-500">Freedom.</span>
                    <svg className="absolute -bottom-1 left-0 w-full overflow-visible" viewBox="0 0 200 8" fill="none">
                      <path d="M2 6 Q50 1 100 5 Q150 9 198 4" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.45" />
                    </svg>
                  </span>
                </h1>
              </Reveal>
              <Reveal delay={0.14}>
                <p className="text-gray-500 text-lg leading-relaxed mb-4">
                  We started Roamly because travel — the thing we love most — kept breaking us with logistics.
                  Unconfirmed hotels. Missing cabs. Panicked midnight calls in unfamiliar cities.
                </p>
                <p className="text-gray-800 text-lg leading-relaxed font-semibold mb-10">
                  So we built the travel company we always wished existed.
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="flex flex-wrap gap-4">
                  <button className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-7 py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-lg shadow-red-200 text-sm">
                    <Plane size={16} /> Plan My Trip
                  </button>
                  <button className="inline-flex items-center gap-2 border border-gray-200 hover:border-red-300 text-gray-600 hover:text-red-500 font-semibold px-7 bg-white py-3.5 rounded-full transition-all text-sm">
                    Read Our Story <ArrowRight size={16} />
                  </button>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-2 gap-4">
                {stats.map(({ number, label, Icon }, i) => (
                  <div key={i} className={`rounded-2xl p-6 border ${i === 0 ? "bg-red-500 border-red-500" : "bg-white border-gray-100 shadow-sm"}`}>
                    <Icon size={22} className={i === 0 ? "text-red-200 mb-3" : "text-red-400 mb-3"} />
                    <p className={`text-3xl font-black mb-1 ${i === 0 ? "text-white" : "text-gray-900"}`}>{number}</p>
                    <p className={`text-sm ${i === 0 ? "text-red-100" : "text-gray-500"}`}>{label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ 2. HOW IT STARTED ══ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>The Origin</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-16" >
              How It <span className="text-red-500">Started</span>
            </h2>
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
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900" >
                You Travel.<span className="text-red-500 ml-2">We Manage.</span>
              </h2>
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
              <h2 className="text-4xl sm:text-5xl font-black text-gray-900">
                Trips That<span className="text-red-500 ml-2">Became Stories</span>
              </h2>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Camera size={16} className="text-red-400" />
                <span>Real trips. Real travelers. Real memories.</span>
              </div>
            </div>
          </Reveal>
          <Gallery />
        </div>
      </section>

      {/* ══ 5. TIMELINE ══ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <SectionLabel>Our Journey</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-20">
              From One Bad Night to<span className="text-red-500 ml-2">50,000 Great Trips</span>
            </h2>
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

      {/* ══ 6. WHAT WE BELIEVE ══ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>Our Philosophy</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-16" >
              What We <span className="text-red-500">Believe</span>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {values.map(({ Icon, title, desc, color, bg }, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all h-full flex gap-5">
                  <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <Icon size={22} className={color} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 7. TESTIMONIALS ══ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>Traveler Stories</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-16" >
              Don't Take Our<span className="text-red-500 ml-2">Word For It</span>
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:border-red-200 hover:shadow-sm transition-all h-full flex flex-col">
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={13} className="text-amber-400 fill-amber-400" />)}
                  </div>
                  <Quote size={16} className="text-red-200 mb-3" />
                  <p className="text-gray-700 leading-relaxed text-sm flex-1 mb-6">{t.text}</p>
                  <div className="flex items-center gap-3 pt-5 border-t border-gray-200">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center font-black text-red-600 text-xs">{t.initials}</div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-red-400" />
                        <p className="text-xs text-gray-500">{t.route}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 8. TEAM ══ */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <SectionLabel>The Team</SectionLabel>
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">
              Travelers Who<span className="text-red-500 ml-2">Plan Your Travels</span>
            </h2>
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