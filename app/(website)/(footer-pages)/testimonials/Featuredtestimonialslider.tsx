"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Quote, MapPin, Star, ChevronLeft, ChevronRight, Play } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type FeaturedTestimonial = {
  name:        string;
  avatar:      string;
  location:    string;
  destination: string;
  rating:      number;
  date:        string;
  image:       string;
  quote:       string;
  highlight:   string;
  trip:        string;
  bgAccent?:   string; // optional tint color per slide
};

// ─────────────────────────────────────────────────────────────────────────────
// Demo data — replace with your actual FEATURED array
// ─────────────────────────────────────────────────────────────────────────────
const FEATURED_ITEMS: FeaturedTestimonial[] = [
  {
    name:        "Priya & Rohit Sharma",
    avatar:      "PR",
    location:    "Mumbai",
    destination: "Kashmir",
    rating:      5,
    date:        "March 2025",
    image:       "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=600&fit=crop&auto=format",
    quote:       "We'd been planning our Kashmir trip for three years. Every time, logistics killed it — hotels, cabs, permits, the uncertainty of it all. Dreams Yatri handed us an itinerary so airtight that the only thing we had to think about was which lens to use.",
    highlight:   "We just… showed up and fell in love with Kashmir.",
    trip:        "7N/8D Kashmir Grand Tour",
    bgAccent:    "#0EA5E9",
  },
  {
    name:        "Karan & Deepika Mehta",
    avatar:      "KD",
    location:    "Bangalore",
    destination: "Dubai",
    rating:      5,
    date:        "December 2024",
    image:       "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=900&h=600&fit=crop&auto=format",
    quote:       "First international trip together. The visa guidance alone was worth it — zero stress. Desert safari, Burj Khalifa, the souks — perfectly paced. We never felt like tourists on a schedule.",
    highlight:   "The most seamless international trip we could have asked for.",
    trip:        "5N/6D Dubai Honeymoon",
    bgAccent:    "#F97316",
  },
  {
    name:        "Meera Iyer",
    avatar:      "MI",
    location:    "Hyderabad",
    destination: "Thailand",
    rating:      5,
    date:        "October 2024",
    image:       "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=900&h=600&fit=crop&auto=format",
    quote:       "Solo female traveller going to Bangkok and Phuket for the first time. The team checked in every day. I never once felt alone or unsafe. Ended up extending by 2 days because I didn't want to leave.",
    highlight:   "I felt taken care of every single day.",
    trip:        "6N/7D Thailand Solo",
    bgAccent:    "#10B981",
  },
  {
    name:        "The Agarwal Family",
    avatar:      "AG",
    location:    "Jaipur",
    destination: "Rajasthan",
    rating:      5,
    date:        "November 2024",
    image:       "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=900&h=600&fit=crop&auto=format",
    quote:       "We did the full Rajasthan royal circuit — Udaipur, Jodhpur, Jaisalmer. Every hotel was a heritage haveli, every transfer was smooth. A trip that actually matched its photographs.",
    highlight:   "Rajasthan the way it was always meant to be experienced.",
    trip:        "9N/10D Rajasthan Heritage Tour",
    bgAccent:    "#F59E0B",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Star row
// ─────────────────────────────────────────────────────────────────────────────
function Stars({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          fill={i < count ? "#FBBF24" : "none"}
          stroke={i < count ? "#FBBF24" : "#D1D5DB"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  ["#FEE2E2","#DC2626"], ["#FEF3C7","#D97706"],
  ["#D1FAE5","#059669"], ["#EDE9FE","#7C3AED"],
];
function Avatar({ initials, index, size = 52 }: { initials: string; index: number; size?: number }) {
  const [bg, text] = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color: text,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: size * 0.32,
      flexShrink: 0, border: "2.5px solid white",
      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    }}>
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────────────────────
function ProgressBar({ active, duration }: { active: boolean; duration: number }) {
  return (
    <div className="h-0.5 bg-white/20 rounded-full overflow-hidden flex-1">
      <div
        className="h-full bg-white rounded-full"
        style={{
          width:      active ? "100%" : "0%",
          transition: active ? `width ${duration}ms linear` : "none",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function FeaturedTestimonialSlider({
  items    = FEATURED_ITEMS,
  autoplay = 6000,
}: {
  items?:    FeaturedTestimonial[];
  autoplay?: number;
}) {
  const [cur, setCur]       = useState(0);
  const [prev, setPrev]     = useState<number | null>(null);
  const [dir, setDir]       = useState<"next" | "prev">("next");
  const [animating, setAnim] = useState(false);
  const [paused, setPaused]  = useState(false);
const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = useCallback((next: number, direction: "next" | "prev") => {
    if (animating) return;
    setAnim(true);
    setDir(direction);
    setPrev(cur);
    setCur(next);
    setTimeout(() => { setPrev(null); setAnim(false); }, 650);
  }, [animating, cur]);

  const goNext = useCallback(() => go((cur + 1) % items.length, "next"), [cur, go, items.length]);
  const goPrev = useCallback(() => go((cur - 1 + items.length) % items.length, "prev"), [cur, go, items.length]);

  // Autoplay
  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(goNext, autoplay);
    return () => clearTimeout(timerRef.current);
  }, [cur, paused, goNext, autoplay]);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [goNext, goPrev]);

  const item = items[cur];

  return (
    <>
      <style>{`
        @keyframes slide-in-right  { from { opacity:0; transform:translateX(40px);  } to { opacity:1; transform:none; } }
        @keyframes slide-in-left   { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:none; } }
        @keyframes slide-out-right { from { opacity:1; transform:none; } to { opacity:0; transform:translateX(-40px); } }
        @keyframes slide-out-left  { from { opacity:1; transform:none; } to { opacity:0; transform:translateX(40px);  } }
        @keyframes img-zoom-in     { from { transform:scale(1.06); } to { transform:scale(1); } }
        @keyframes fade-up         { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        @keyframes highlight-in    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }

        .ft-content-enter-next { animation: slide-in-right 0.55s cubic-bezier(.4,0,.2,1) both; }
        .ft-content-enter-prev { animation: slide-in-left  0.55s cubic-bezier(.4,0,.2,1) both; }
        .ft-content-exit-next  { animation: slide-out-right 0.45s cubic-bezier(.4,0,.2,1) both; position:absolute; inset:0; pointer-events:none; }
        .ft-content-exit-prev  { animation: slide-out-left  0.45s cubic-bezier(.4,0,.2,1) both; position:absolute; inset:0; pointer-events:none; }
        .ft-img-enter          { animation: img-zoom-in 0.85s cubic-bezier(.4,0,.2,1) both; }
        .ft-quote-delay        { animation: fade-up 0.6s ease 0.15s both; }
        .ft-highlight-delay    { animation: highlight-in 0.5s ease 0.35s both; }
        .ft-author-delay       { animation: fade-up 0.5s ease 0.45s both; }
      `}</style>

      <section
        className="max-w-6xl mt-12 mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.12), 0 4px 24px rgba(0,0,0,0.06)" }}
        >
          <div className="grid lg:grid-cols-[1fr_460px] min-h-[480px]">

            {/* ── LEFT: cinematic image ── */}
            <div className="relative overflow-hidden bg-gray-900" style={{ minHeight: "320px" }}>

              {/* Background image with key-triggered zoom */}
              <img
                key={`img-${cur}`}
                src={item.image}
                alt={item.destination}
                className="ft-img-enter absolute inset-0 w-full h-full object-cover"
                loading="eager"
                draggable={false}
              />

              {/* Cinematic gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/40 hidden lg:block" />

              {/* Destination badge — top left */}
              <div className="absolute top-5 left-5 flex items-center gap-2">
                <div
                  className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-full"
                  style={{ background: item.bgAccent ?? "#EF4444", boxShadow: `0 2px 12px ${item.bgAccent ?? "#EF4444"}60` }}
                >
                  <MapPin size={11} />
                  {item.destination}
                </div>
                <div className="bg-black/40 backdrop-blur-sm text-white/80 text-xs font-semibold
                                px-3 py-1.5 rounded-full border border-white/15">
                  {item.trip}
                </div>
              </div>

              {/* Slide counter — top right */}
              <div className="absolute top-5 right-5 bg-black/40 backdrop-blur-sm border border-white/15
                              rounded-full px-3 py-1.5 text-white/70 text-xs font-semibold">
                {String(cur + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
              </div>

              {/* Progress bars — bottom */}
              <div className="absolute bottom-5 left-5 right-5 flex gap-2 items-center">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i, i > cur ? "next" : "prev")}
                    className="flex-1 cursor-pointer"
                    aria-label={`Go to slide ${i + 1}`}
                  >
                    <ProgressBar
                      active={i === cur && !paused}
                      duration={autoplay}
                    />
                  </button>
                ))}
              </div>

              {/* Navigation — prev / next on image */}
              <div className="absolute bottom-14 right-5 hidden sm:flex gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm
                             border border-white/20 text-white flex items-center justify-center
                             transition-all duration-200 hover:scale-110"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm
                             border border-white/20 text-white flex items-center justify-center
                             transition-all duration-200 hover:scale-110"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Thumbnail strip — bottom left on mobile */}
              <div className="absolute bottom-12 left-5 flex gap-2 lg:hidden">
                {items.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i, i > cur ? "next" : "prev")}
                    className="transition-all duration-200"
                    style={{
                      width:        i === cur ? 36 : 28,
                      height:       22,
                      borderRadius: 6,
                      overflow:     "hidden",
                      border:       i === cur ? "2px solid white" : "2px solid rgba(255,255,255,0.3)",
                      opacity:      i === cur ? 1 : 0.55,
                    }}
                  >
                    <img src={t.image} alt={t.destination} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* ── RIGHT: testimonial content ── */}
            <div className="bg-white flex flex-col justify-between relative overflow-hidden">

              {/* Accent top-right decoration */}
              <div
                className="absolute top-0 right-0 w-32 h-32 rounded-bl-full pointer-events-none"
                style={{
                  background:  `${item.bgAccent ?? "#EF4444"}10`,
                  transition:  "background 0.6s ease",
                }}
              />

              {/* Content wrapper — animated per slide */}
              <div className="relative flex-1 overflow-hidden">
                <div
                  key={`content-${cur}`}
                  className={`p-7 sm:p-9 flex flex-col h-full
                    ${dir === "next" ? "ft-content-enter-next" : "ft-content-enter-prev"}`}
                >
                  {/* Quote icon */}
                  <Quote
                    size={32}
                    className="mb-5 flex-shrink-0"
                    style={{ color: `${item.bgAccent ?? "#EF4444"}40` }}
                  />

                  {/* Main quote */}
                  <blockquote
                    className="ft-quote-delay text-gray-700 leading-relaxed flex-1 mb-6"
                    style={{
                      fontSize:   "clamp(0.9rem, 1.4vw, 1.02rem)",
                    }}
                  >
                    "{item.quote}"
                  </blockquote>

                  {/* Highlight pull-quote */}
                  <div
                    className="ft-highlight-delay rounded-2xl px-5 py-4 mb-6 relative overflow-hidden"
                    style={{
                      background: `${item.bgAccent ?? "#EF4444"}0C`,
                      border:     `1.5px solid ${item.bgAccent ?? "#EF4444"}22`,
                    }}
                  >
                    {/* Left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                      style={{ background: item.bgAccent ?? "#EF4444" }}
                    />
                    <p
                      className="pl-2"
                      style={{
                        fontSize:   "1rem",
                        fontStyle:  "italic",
                        fontWeight: 700,
                        color:      item.bgAccent ?? "#EF4444",
                        margin:     0,
                        lineHeight: 1.5,
                      }}
                    >
                      "{item.highlight}"
                    </p>
                  </div>

                  {/* Author row */}
                  <div
                    className="ft-author-delay flex items-center gap-4 pt-5 border-t border-gray-100"
                  >
                    <Avatar initials={item.avatar} index={cur} size={48} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-tight mb-1">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Stars count={item.rating} />
                        <span className="text-gray-300 text-xs">·</span>
                        <span className="text-gray-400 text-xs">{item.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin size={11} className="text-gray-300 flex-shrink-0" />
                        <span className="text-gray-400 text-xs">{item.location}</span>
                      </div>
                    </div>

                    {/* Verified badge */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ background: `${item.bgAccent ?? "#EF4444"}12` }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M9 12l2 2 4-4" stroke={item.bgAccent ?? "#EF4444"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" stroke={item.bgAccent ?? "#EF4444"} strokeWidth="1.8"/>
                        </svg>
                      </div>
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">
                        Verified
                      </span>
                    </div>
                  </div>
                </div>

                {/* Exit animation layer */}
                {prev !== null && (
                  <div
                    key={`exit-${prev}`}
                    className={`absolute inset-0 p-7 sm:p-9 flex flex-col bg-white
                      ${dir === "next" ? "ft-content-exit-next" : "ft-content-exit-prev"}`}
                  >
                    <Quote size={32} className="mb-5 text-red-100 flex-shrink-0" />
                    <p className="text-gray-400 text-sm leading-relaxed flex-1">
                      "{items[prev].quote}"
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop thumbnail strip — right panel bottom */}
              <div className="hidden lg:flex items-center gap-2 px-7 sm:px-9 pb-5 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-300 font-semibold mr-1">More</span>
                {items.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i, i > cur ? "next" : "prev")}
                    title={t.destination}
                    className="transition-all duration-200 flex-shrink-0"
                    style={{
                      width:        i === cur ? 44 : 32,
                      height:       28,
                      borderRadius: 8,
                      overflow:     "hidden",
                      border:       i === cur
                        ? `2px solid ${item.bgAccent ?? "#EF4444"}`
                        : "2px solid transparent",
                      opacity:      i === cur ? 1 : 0.45,
                      cursor:       "pointer",
                    }}
                  >
                    <img
                      src={t.image}
                      alt={t.destination}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </button>
                ))}

                {/* Mobile nav arrows — shown in right panel on small screens */}
                <div className="flex gap-1.5 ml-auto sm:hidden">
                  <button onClick={goPrev}
                    className="w-7 h-7 rounded-full border border-gray-200 flex items-center
                               justify-center text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={goNext}
                    className="w-7 h-7 rounded-full bg-red-500 border border-red-500 flex items-center
                               justify-center text-white hover:bg-red-600 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default FeaturedTestimonialSlider;