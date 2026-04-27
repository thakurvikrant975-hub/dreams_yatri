"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, MapPin, Quote, Star } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TestimonialItem = {
  /** Full review text */
  text: string;
  /** Reviewer's full name */
  name: string;
  /** City / trip context shown below name */
  route: string;
  /** Initials fallback if no photo */
  initials: string;
  /** Optional real photo URL */
  photo?: string;
  /** Google Maps / Google review direct URL */
  googleUrl?: string;
  /** Star rating 1–5. Default 5 */
  rating?: number;
  /** e.g. "Kashmir Tour", "Dubai Package" */
  tripTag?: string;
};

export type TestimonialSliderProps = {
  items: TestimonialItem[];
  /** Cards visible at once on desktop. Default: 3 */
  perView?: number;
  /** Auto-advance interval in ms. 0 = disabled. Default: 5000 */
  autoplay?: number;
  /** Section label above heading */
  label?: string;
  /** Main heading */
  heading?: string;
  /** Red italic highlight inside heading */
  headingHighlight?: string;
  /** Subheading */
  subheading?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Google icon SVG
// ─────────────────────────────────────────────────────────────────────────────
function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Responsive perView
// ─────────────────────────────────────────────────────────────────────────────
function usePerView(base: number) {
  const [pv, setPv] = useState(base);
  useEffect(() => {
    const calc = () => {
      if (window.innerWidth < 640) setPv(1);
      else if (window.innerWidth < 1024) setPv(2);
      else setPv(base);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [base]);
  return pv;
}

// ─────────────────────────────────────────────────────────────────────────────
// Touch / mouse drag
// ─────────────────────────────────────────────────────────────────────────────
function useDrag(onSwipe: (dir: -1 | 1) => void) {
  const startX = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
      dragging.current = true;
      moved.current = false;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!dragging.current) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      if (Math.abs(dx) > 44) { onSwipe(dx < 0 ? 1 : -1); moved.current = true; }
      dragging.current = false;
    },
    onMouseDown: (e: React.MouseEvent) => {
      startX.current = e.clientX;
      dragging.current = true;
      moved.current = false;
    },
    onMouseUp: (e: React.MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      if (Math.abs(dx) > 44) { onSwipe(dx < 0 ? 1 : -1); moved.current = true; }
      dragging.current = false;
    },
    wasMoved: () => moved.current,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_PALETTES = [
  ["#FEE2E2", "#DC2626"],
  ["#FEF3C7", "#D97706"],
  ["#E0F2FE", "#0284C7"],
  ["#D1FAE5", "#059669"],
  ["#EDE9FE", "#7C3AED"],
  ["#FCE7F3", "#DB2777"],
];

function Avatar({ photo, initials, index, size = 48 }: {
  photo?: string; initials: string; index: number; size?: number;
}) {
  const [err, setErr] = useState(false);
  const [bg, text] = AVATAR_PALETTES[index % AVATAR_PALETTES.length];

  if (photo && !err) {
    return (
      <img
        src={photo}
        alt={initials}
        onError={() => setErr(true)}
        style={{
          width: size, height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid #F3F4F6",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size,
      borderRadius: "50%",
      background: bg,
      color: text,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontWeight: 800,
      fontSize: size * 0.35,
      flexShrink: 0,
      border: `2px solid ${bg}`,
    }}>
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Star row
// ─────────────────────────────────────────────────────────────────────────────
function Stars({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
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
// Single card
// ─────────────────────────────────────────────────────────────────────────────
function TestimonialCard({ item, index, onGoogleClick }: {
  item: TestimonialItem;
  index: number;
  onGoogleClick: (e: React.MouseEvent, url: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   "#ffffff",
        borderRadius: 20,
        border:       `1.5px solid ${hovered ? "#FECACA" : "#F3F4F6"}`,
        padding:      "28px 26px 24px",
        display:      "flex",
        flexDirection: "column",
        height:       "100%",
        boxSizing:    "border-box",
        transition:   "border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease",
        boxShadow:    hovered
          ? "0 12px 40px rgba(239,68,68,0.08), 0 2px 8px rgba(0,0,0,0.04)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transform:    hovered ? "translateY(-4px)" : "none",
        position:     "relative",
        overflow:     "hidden",
      }}
    >
      {/* Decorative corner */}
      <div style={{
        position:   "absolute", top: 0, right: 0,
        width:      70, height: 70,
        borderRadius: "0 20px 0 70px",
        background: hovered ? "rgba(239,68,68,0.07)" : "rgba(239,68,68,0.03)",
        transition: "background 0.22s ease",
        pointerEvents: "none",
      }} />

      {/* Top row: stars + Google badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Stars count={item.rating ?? 5} />
        {item.googleUrl && (
          <button
            onClick={(e) => onGoogleClick(e, item.googleUrl!)}
            title="View on Google"
            style={{
              display:        "flex",
              alignItems:     "center",
              gap:            5,
              background:     hovered ? "#F9FAFB" : "transparent",
              border:         "1px solid #E5E7EB",
              borderRadius:   999,
              padding:        "4px 10px",
              cursor:         "pointer",
              transition:     "background 0.18s ease, border-color 0.18s ease",
              fontFamily:     "'Plus Jakarta Sans', sans-serif",
              fontSize:       10,
              fontWeight:     700,
              color:          "#6B7280",
              letterSpacing:  "0.04em",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#FEF2F2";
              e.currentTarget.style.borderColor = "#FECACA";
              e.currentTarget.style.color = "#DC2626";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = hovered ? "#F9FAFB" : "transparent";
              e.currentTarget.style.borderColor = "#E5E7EB";
              e.currentTarget.style.color = "#6B7280";
            }}
          >
            <GoogleIcon size={13} />
            Review
          </button>
        )}
      </div>

      {/* Trip tag */}
      {item.tripTag && (
        <span style={{
          display:       "inline-block",
          background:    "#FEF2F2",
          color:         "#DC2626",
          border:        "1px solid #FECACA",
          borderRadius:  999,
          fontSize:      10,
          fontWeight:    700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding:       "3px 10px",
          marginBottom:  14,
          fontFamily:    "'Plus Jakarta Sans', sans-serif",
          width:         "fit-content",
        }}>
          {item.tripTag}
        </span>
      )}

      {/* Quote icon */}
      <Quote size={16} style={{ color: "#FECACA", marginBottom: 10, flexShrink: 0 }} />

      {/* Review text */}
      <p style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize:   13.5,
        color:      "#374151",
        lineHeight: 1.78,
        margin:     "0 0 20px",
        flex:       1,
      }}>
        {item.text}
      </p>

      {/* Divider */}
      <div style={{ height: 1, background: "#F3F4F6", marginBottom: 18 }} />

      {/* Reviewer */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar photo={item.photo} initials={item.initials} index={index} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize:   13,
            fontWeight: 700,
            color:      "#111827",
            margin:     0,
            whiteSpace: "nowrap",
            overflow:   "hidden",
            textOverflow: "ellipsis",
          }}>
            {item.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
            <MapPin size={11} style={{ color: "#EF4444", flexShrink: 0 }} />
            <p style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize:   11,
              color:      "#9CA3AF",
              margin:     0,
              whiteSpace: "nowrap",
              overflow:   "hidden",
              textOverflow: "ellipsis",
            }}>
              {item.route}
            </p>
          </div>
        </div>

        {/* Google G mark on avatar side */}
        {item.googleUrl && (
          <div style={{
            width:          28, height: 28,
            borderRadius:   "50%",
            background:     "#F9FAFB",
            border:         "1px solid #E5E7EB",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            flexShrink:     0,
          }}>
            <GoogleIcon size={14} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main slider
// ─────────────────────────────────────────────────────────────────────────────
export function TestimonialSlider({
  items,
  perView    = 3,
  autoplay   = 5000,
  label      = "What Travellers Say",
  heading    = "Real trips.",
  headingHighlight = "Real stories.",
  subheading = "Every review below is from a verified traveller — unedited, unfiltered, and linked directly to Google.",
}: TestimonialSliderProps) {
  const pv        = usePerView(perView);
  const max       = Math.max(0, items.length - pv);
  const [idx, setIdx]       = useState(0);
  const [locked, setLocked] = useState(false);
  const autoRef = useRef<ReturnType<typeof setTimeout>>();

  const clamp  = (n: number) => Math.max(0, Math.min(max, n));
  const slide  = useCallback((next: number) => {
    if (locked) return;
    const c = clamp(next);
    if (c === idx) return;
    setLocked(true);
    setIdx(c);
    setTimeout(() => setLocked(false), 500);
  }, [locked, idx, max]);

  const prev = () => slide(idx - 1);
  const next = () => slide(idx + 1);

  // Autoplay
  useEffect(() => {
    if (!autoplay) return;
    autoRef.current = setInterval(() => {
      setIdx(i => {
        const n = i + 1;
        return n > max ? 0 : n;
      });
    }, autoplay);
    return () => clearInterval(autoRef.current);
  }, [autoplay, max]);

  // Pause autoplay on hover
  const pauseAutoplay  = () => clearInterval(autoRef.current);
  const resumeAutoplay = () => {
    if (!autoplay) return;
    autoRef.current = setInterval(() => {
      setIdx(i => { const n = i + 1; return n > max ? 0 : n; });
    }, autoplay);
  };

  // Keyboard nav
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [idx]);

  // Reset on resize
  useEffect(() => { setIdx(0); }, [pv]);

  const drag = useDrag((dir) => { dir === 1 ? next() : prev(); });

  const translatePct = -(idx * (100 / pv));
  const gapPx        = 16;

  const handleGoogleClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div
        onMouseEnter={pauseAutoplay}
        onMouseLeave={resumeAutoplay}
      >


        {/* ── Slider track ── */}
        <div style={{ position: "relative" }}>

          {/* Left fade */}
          {idx > 0 && (
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 40,
              width: 48, zIndex: 2, pointerEvents: "none",
            }} />
          )}
          {/* Right fade */}
          {idx < max && (
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 40,
              width: 48, zIndex: 2, pointerEvents: "none",
            }} />
          )}

          {/* Overflow container */}
          <div
            style={{ overflow: "hidden", borderRadius: 20 }}
            onTouchStart={drag.onTouchStart}
            onTouchEnd={drag.onTouchEnd}
            onMouseDown={drag.onMouseDown}
            onMouseUp={drag.onMouseUp}
            onMouseLeave={drag.onMouseUp}
            className="py-6"
          >
            {/* Moving track */}
            <div
              style={{
                display:    "flex",
                gap:        `${gapPx}px`,
                transition: locked
                  ? "transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                  : "transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                transform:  `translateX(calc(${translatePct}% - ${idx * gapPx / pv}px))`,
                willChange: "transform",
                cursor:     "grab",
                alignItems: "stretch",
              }}
            >
              {items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    flexShrink: 0,
                    width:      `calc((100% - ${(pv - 1) * gapPx}px) / ${pv})`,
                    display:    "flex",
                    flexDirection: "column",
                  }}
                >
                  <TestimonialCard
                    item={item}
                    index={i}
                    onGoogleClick={handleGoogleClick}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ── Controls ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>

            {/* Dot indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {Array.from({ length: max + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => slide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    height:       6,
                    width:        i === idx ? 28 : 6,
                    borderRadius: 999,
                    background:   i === idx ? "#EF4444" : "#E5E7EB",
                    border:       "none",
                    padding:      0,
                    cursor:       "pointer",
                    transition:   "width 0.3s cubic-bezier(0.25,0.46,0.45,0.94), background 0.3s ease",
                    flexShrink:   0,
                  }}
                />
              ))}
            </div>

            {/* Prev / count / Next */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={prev}
                disabled={idx === 0}
                aria-label="Previous"
                style={{
                  width:          40, height: 40,
                  borderRadius:   "50%",
                  border:         "1.5px solid #E5E7EB",
                  background:     "#fff",
                  color:          idx === 0 ? "#D1D5DB" : "#111827",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  cursor:         idx === 0 ? "not-allowed" : "pointer",
                  opacity:        idx === 0 ? 0.45 : 1,
                  transition:     "all 0.18s ease",
                  flexShrink:     0,
                }}
                onMouseEnter={e => {
                  if (idx !== 0) {
                    e.currentTarget.style.borderColor = "#EF4444";
                    e.currentTarget.style.color = "#EF4444";
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "#E5E7EB";
                  e.currentTarget.style.color = idx === 0 ? "#D1D5DB" : "#111827";
                }}
              >
                <ChevronLeft size={18} />
              </button>

              <span style={{
                fontFamily:  "'Plus Jakarta Sans', sans-serif",
                fontSize:    12,
                fontWeight:  600,
                color:       "#9CA3AF",
                width:       44,
                textAlign:   "center",
                userSelect:  "none",
              }}>
                {idx + 1} / {max + 1}
              </span>

              <button
                onClick={next}
                disabled={idx === max}
                aria-label="Next"
                style={{
                  width:          40, height: 40,
                  borderRadius:   "50%",
                  border:         "none",
                  background:     idx === max ? "#F3F4F6" : "#EF4444",
                  color:          "#fff",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  cursor:         idx === max ? "not-allowed" : "pointer",
                  opacity:        idx === max ? 0.45 : 1,
                  transition:     "all 0.18s ease",
                  boxShadow:      idx === max ? "none" : "0 3px 12px rgba(239,68,68,0.35)",
                  flexShrink:     0,
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo — remove before production, keep only TestimonialSlider export
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_ITEMS: TestimonialItem[] = [
  {
    name:       "Priya & Rohit Sharma",
    initials:   "PR",
    route:      "Mumbai · Kashmir Grand Tour",
    tripTag:    "Kashmir",
    rating:     5,
    photo:      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&auto=format&face=1",
    googleUrl:  "https://maps.google.com",
    text:       "We'd been planning Kashmir for three years. Every time, logistics killed it. Dreams Yatri handed us an itinerary so airtight that the only thing we had to think about was which lens to use. We just showed up and fell in love.",
  },
  {
    name:       "Amit Verma",
    initials:   "AV",
    route:      "Delhi · Manali Family Package",
    tripTag:    "Himachal Pradesh",
    rating:     5,
    googleUrl:  "https://maps.google.com",
    text:       "Booked a family trip to Manali with my parents who are 65+. The team customised the entire itinerary around their pace — no rushing, no panic. My father said it was the best holiday of his life.",
  },
  {
    name:       "Sneha Kulkarni",
    initials:   "SK",
    route:      "Pune · Goa Girls Trip",
    tripTag:    "Goa",
    rating:     5,
    photo:      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&auto=format",
    googleUrl:  "https://maps.google.com",
    text:       "Planned a bachelorette for 8 girls and I was terrified something would go wrong. Nothing did. Villas, transfers, beach shacks — all sorted. Dreams Yatri turned a logistical nightmare into the most fun week of our lives.",
  },
  {
    name:       "Karan & Deepika Mehta",
    initials:   "KD",
    route:      "Bangalore · Dubai Honeymoon",
    tripTag:    "Dubai",
    rating:     5,
    googleUrl:  "https://maps.google.com",
    text:       "First international trip together. The visa guidance alone was worth it — zero stress. Desert safari, Burj Khalifa, the souks — perfectly paced. We never once felt like tourists on a schedule.",
  },
  {
    name:       "Meera Iyer",
    initials:   "MI",
    route:      "Hyderabad · Thailand Solo",
    tripTag:    "Thailand",
    rating:     5,
    photo:      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&auto=format",
    googleUrl:  "https://maps.google.com",
    text:       "Solo female traveller going to Bangkok and Phuket for the first time. The team checked in every day. I never once felt alone or unsafe. Ended up extending by 2 days because I didn't want to leave.",
  },
  {
    name:       "Rajesh Nair",
    initials:   "RN",
    route:      "Chennai · Rajasthan Royal Circuit",
    tripTag:    "Rajasthan",
    rating:     5,
    googleUrl:  "https://maps.google.com",
    text:       "I'm the kind of traveller who reads every review obsessively before booking. I spent exactly 20 minutes with Dreams Yatri, shared my wish list, and got back an itinerary I couldn't have built myself in a week.",
  },
];

export default function TestimonialSliderDemo() {
  return (
        <TestimonialSlider items={DEMO_ITEMS} perView={3} autoplay={5000} />
  );
}