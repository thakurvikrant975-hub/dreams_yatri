"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
export type HeroImage = { src: string; alt: string; label?: string };

export type PageHeroProps = {
  headingLine1: string;
  headingHighlight: string;
  headingLine2Prefix?: string;
  headingLine2Suffix?: string;
  subheading: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  leftImages?: HeroImage[];
  rightImages?: HeroImage[];
  badge?: string;
};

// ── International destination images ─────────────────────────────────────────
const LEFT_IMGS: HeroImage[] = [
  { src: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=300&fit=crop&auto=format", alt: "Dubai skyline", label: "Dubai" },
  { src: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=280&fit=crop&auto=format", alt: "Singapore", label: "Singapore" },
  { src: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop&auto=format", alt: "Bangkok", label: "Bangkok" },
  { src: "https://images.unsplash.com/photo-1549144511-f099e773c147?w=400&h=280&fit=crop&auto=format", alt: "Santorini", label: "Santorini" },
  { src: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=400&h=300&fit=crop&auto=format", alt: "Maldives", label: "Maldives" },
  { src: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=280&fit=crop&auto=format", alt: "Paris", label: "Paris" },
];

const RIGHT_IMGS: HeroImage[] = [
  { src: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop&auto=format", alt: "Tokyo", label: "Tokyo" },
  { src: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=280&fit=crop&auto=format", alt: "Bali", label: "Bali" },
  { src: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=400&h=300&fit=crop&auto=format", alt: "Taj Mahal", label: "Agra" },
  { src: "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=400&h=280&fit=crop&auto=format", alt: "Venice", label: "Venice" },
  { src: "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=400&h=300&fit=crop&auto=format", alt: "Rome", label: "Rome" },
  { src: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400&h=280&fit=crop&auto=format", alt: "New York", label: "New York" },
];

// ── Infinite scroll strip ─────────────────────────────────────────────────────
function ScrollStrip({ images, direction, speed = 35 }: {
  images: HeroImage[];
  direction: "up" | "down";
  speed?: number;
}) {
  const doubled = [...images, ...images];
  return (
    <div
      className="overflow-hidden flex-1"
// style={{
//   maskImage: "linear-gradient(to bottom, transparent 0%, black 3%, black 95%, transparent 100%)",
//   WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 3%, black 95%, transparent 100%)",
// }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          animation: `strip-${direction} ${speed}s linear infinite`,
          willChange: "transform",
        }}
      >
        {doubled.map((img, i) => (
          <div
            key={i}
            className="relative rounded-2xl overflow-hidden flex-shrink-0 group"
            style={{ width: "100%", height: i % 3 === 0 ? "128px" : i % 3 === 1 ? "106px" : "118px" }}
          >
            <img
              src={img.src}
              alt={img.alt}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            {img.label && (
              <div
                className="absolute bottom-0 left-0 right-0 px-2.5 py-2"
                style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}
              >
                <span className="text-white text-xs font-bold tracking-wider">{img.label}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/20 transition-colors duration-300 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        let cur = 0;
        const inc = Math.ceil(to / 50);
        const t = setInterval(() => {
          cur = Math.min(cur + inc, to);
          setVal(cur);
          if (cur >= to) clearInterval(t);
        }, 28);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export function PageHero({
  headingLine1,
  headingHighlight,
  headingLine2Prefix = "",
  headingLine2Suffix = "!",
  subheading,
  ctaLabel = "Explore Packages",
  ctaHref = "/packages",
  secondaryCtaLabel,
  secondaryCtaHref = "#",
  leftImages = LEFT_IMGS,
  rightImages = RIGHT_IMGS,
  badge,
}: PageHeroProps) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLoaded(true), 60); return () => clearTimeout(t); }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,700&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&display=swap');

        @keyframes strip-up   { from { transform: translateY(0);    } to { transform: translateY(-50%); } }
        @keyframes strip-down { from { transform: translateY(-50%); } to { transform: translateY(0);    } }

        @keyframes hero-rise  {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes badge-pop  {
          from { opacity: 0; transform: scale(0.75) rotate(-8deg); }
          to   { opacity: 1; transform: scale(1)    rotate(-8deg); }
        }
        @keyframes stamp-float-a {
          0%,100% { transform: translateY(0)    rotate(-14deg); }
          50%     { transform: translateY(-9px) rotate(-14deg); }
        }
        @keyframes stamp-float-b {
          0%,100% { transform: translateY(0)   rotate(10deg); }
          50%     { transform: translateY(-7px) rotate(10deg); }
        }
        @keyframes ticker {
          from { transform: translateX(0);    }
          to   { transform: translateX(-50%); }
        }
        @keyframes ping-dot {
          0%,100% { opacity: 1; transform: scale(1);   }
          50%     { opacity: 0.4; transform: scale(0.6); }
        }

        .ph-stamp-a { animation: stamp-float-a 4.5s ease-in-out infinite; }
        .ph-stamp-b { animation: stamp-float-b 5.5s ease-in-out infinite 1.2s; }

        .ph-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #EF4444; color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700; font-size: 15px; letter-spacing: -0.01em;
          padding: 14px 30px; border-radius: 14px; border: none;
          text-decoration: none; cursor: pointer;
          box-shadow: 0 6px 22px rgba(239,68,68,0.38), 0 2px 6px rgba(239,68,68,0.18);
          transition: background 0.18s, transform 0.15s, box-shadow 0.18s;
        }
        .ph-btn-primary:hover {
          background: #DC2626;
          transform: translateY(-2px);
          box-shadow: 0 10px 32px rgba(239,68,68,0.45), 0 3px 10px rgba(239,68,68,0.22);
        }
        .ph-btn-primary:active { transform: translateY(0); }

        .ph-btn-secondary {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent; color: #374151;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 600; font-size: 15px;
          padding: 13px 26px; border-radius: 14px;
          border: 1.5px solid #E5E7EB;
          text-decoration: none; cursor: pointer;
          transition: border-color 0.18s, color 0.18s, background 0.18s;
        }
        .ph-btn-secondary:hover { border-color: #EF4444; color: #EF4444; background: #FEF2F2; }
      `}</style>

      <section
        className="relative w-full bg-white overflow-hidden max-h-[95vh]"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >

        {/* Dot-grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #D1D5DB 1.3px, transparent 1.3px)",
            backgroundSize: "26px 26px",
            opacity: 0.55,
          }}
        />

        {/* Giant italic watermark */}
        {/* <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden="true"
        //   style={{ overflow: "hidden" }}
        >
          <span
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(100px, 22vw, 260px)",
              fontWeight: 800,
              fontStyle: "italic",
              color: "#F3F4F6",
              letterSpacing: "-0.05em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            WANDER
          </span>
        </div> */}

        {/* Red circle accent — top right */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-red-500/[0.07] pointer-events-none" />
        <div className="absolute -top-8 right-10 w-28 h-28 rounded-full bg-red-500/[0.09] pointer-events-none" />

        {/* Floating passport stamps */}
        <div className="ph-stamp-a absolute top-[10%] right-[22%] pointer-events-none select-none z-20" aria-hidden="true">
          <svg viewBox="0 0 96 96" width="82" height="82">
            <circle cx="48" cy="48" r="42" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="7 4" opacity="0.22" />
            <circle cx="48" cy="48" r="33" fill="none" stroke="#EF4444" strokeWidth="1" opacity="0.12" />
            <text x="48" y="44" textAnchor="middle" fontSize="9" fontWeight="700" fill="#EF4444" fontFamily="'Plus Jakarta Sans',sans-serif" letterSpacing="2" opacity="0.3">DREAMS</text>
            <text x="48" y="56" textAnchor="middle" fontSize="9" fontWeight="700" fill="#EF4444" fontFamily="'Plus Jakarta Sans',sans-serif" letterSpacing="2" opacity="0.3">YATRI</text>
            <text x="48" y="66" textAnchor="middle" fontSize="7" fill="#EF4444" fontFamily="'Plus Jakarta Sans',sans-serif" opacity="0.2">✈ EXPLORE</text>
          </svg>
        </div>

        <div className="ph-stamp-b absolute bottom-[18%] left-[21%] pointer-events-none select-none z-20" aria-hidden="true">
          <svg viewBox="0 0 96 96" width="70" height="70">
            <circle cx="48" cy="48" r="42" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="7 4" opacity="0.18" />
            <text x="48" y="50" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#EF4444" fontFamily="'Plus Jakarta Sans',sans-serif" letterSpacing="1.5" opacity="0.22">TRAVEL</text>
          </svg>
        </div>

        {/* Three-column layout */}
        <div
          className="relative z-10 flex w-full max-h-[88vh]"
          style={{ alignItems: "stretch" }}
        >

          {/* LEFT image columns */}
          <div
            className="flex-shrink-0 flex gap-2.5 pl-3 sm:pl-5"
            style={{
              width: "clamp(140px, 17vw, 220px)",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.55s ease",
            }}
          >
            <ScrollStrip images={leftImages.slice(0, 4)} direction="down" speed={30} />
            <ScrollStrip images={leftImages.slice(2)} direction="up" speed={42} />
          </div>

          {/* CENTRE content */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-3 sm:px-6">

            {/* Badge */}
            {badge && (
              <div
                className="inline-flex items-center gap-2 mb-7"
                style={{
                  background: "#FEF2F2",
                  border: "1.5px solid #FECACA",
                  color: "#B91C1C",
                  padding: "7px 16px",
                  borderRadius: "100px",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  transform: "rotate(-1.5deg)",
                  animation: loaded ? "badge-pop 0.5s ease 0.05s both" : "none",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "ping-dot 1.8s ease-in-out infinite" }} />
                {badge}
              </div>
            )}

            {/* Heading block */}
            <div style={{ animation: loaded ? "hero-rise 0.65s ease 0.12s both" : "none" }}>
              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(2.4rem, 5.8vw, 4.2rem)",
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1.08,
                  letterSpacing: "-0.025em",
                  margin: 0,
                }}
              >
                {headingLine1}
              </h1>

              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "clamp(2.4rem, 5.8vw, 4.2rem)",
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1.15,
                  letterSpacing: "-0.025em",
                  margin: "4px 0 0",
                }}
              >
                {headingLine2Prefix && <span style={{ marginRight: "0.22em" }}>{headingLine2Prefix}</span>}

                {/* Highlighted word */}
                <span style={{ position: "relative", display: "inline-block" }}>
                  {/* Yellow highlight brush stroke behind text */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "-4px", right: "-4px",
                      bottom: "6px",
                      height: "38%",
                      background: "rgba(239,68,68,0.12)",
                      borderRadius: "4px",
                      zIndex: 0,
                      display: "block",
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      color: "#EF4444",
                      fontStyle: "italic",
                    }}
                  >
                    {headingHighlight}
                  </span>
                  {/* Squiggle */}
                  <span
                    style={{
                      position: "absolute",
                      left: 0, right: 0, bottom: "-8px",
                      display: "block",
                      lineHeight: 0,
                    }}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 300 10" preserveAspectRatio="none" style={{ width: "100%", height: "8px" }}>
                      <path d="M0 7 Q37.5 1 75 7 Q112.5 13 150 7 Q187.5 1 225 7 Q262.5 13 300 7"
                        stroke="#EF4444" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.55" />
                    </svg>
                  </span>
                </span>

                {headingLine2Suffix && <span style={{ color: "#111827" }}>{headingLine2Suffix}</span>}
              </h1>
            </div>

            {/* Subheading */}
            <p
              style={{
                fontSize: "clamp(0.95rem, 1.8vw, 1.08rem)",
                color: "#6B7280",
                lineHeight: 1.75,
                maxWidth: "380px",
                margin: "18px auto 0",
                animation: loaded ? "hero-rise 0.65s ease 0.22s both" : "none",
              }}
            >
              {subheading}
            </p>

            {/* CTAs */}
            <div
              className="flex flex-wrap justify-center gap-3 mt-8"
              style={{ animation: loaded ? "hero-rise 0.65s ease 0.32s both" : "none" }}
            >
              {ctaLabel && (
                <a href={ctaHref} className="ph-btn-primary">
                  {ctaLabel}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              )}
              {secondaryCtaLabel && (
                <a href={secondaryCtaHref} className="ph-btn-secondary">
                  {secondaryCtaLabel}
                </a>
              )}
            </div>

            {/* Stats */}
            <div
              className="flex flex-wrap justify-center gap-8 mt-9"
              style={{ animation: loaded ? "hero-rise 0.65s ease 0.42s both" : "none" }}
            >
              {[
                { to: 10000, sfx: "+", label: "Happy Travellers" },
                { to: 50,    sfx: "+", label: "Destinations" },
                { to: 98,    sfx: "%", label: "Satisfaction Rate" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <p style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(1.5rem, 2.8vw, 2rem)",
                    fontWeight: 800,
                    color: "#111827",
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    <CountUp to={s.to} suffix={s.sfx} />
                  </p>
                  <p style={{
                    fontSize: "10px",
                    color: "#9CA3AF",
                    margin: "4px 0 0",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT image columns */}
          <div
            className="flex-shrink-0 flex gap-2.5 pr-3 sm:pr-5"
            style={{
              width: "clamp(140px, 17vw, 220px)",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.55s ease 0.08s",
            }}
          >
            <ScrollStrip images={rightImages.slice(3)} direction="up" speed={36} />
            <ScrollStrip images={rightImages.slice(0, 4)} direction="down" speed={28} />
          </div>
        </div>

        {/* Destination ticker — red bar */}
        <div
          className="relative z-10 overflow-hidden flex items-center"
          style={{ height: "40px", background: "#EF4444" }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, #EF4444, transparent)" }} />
          <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to left, #EF4444, transparent)" }} />

          <div
            style={{
              display: "flex",
              whiteSpace: "nowrap",
              animation: "ticker 26s linear infinite",
              willChange: "transform",
            }}
          >
            {[
              "Dubai", "Bali", "Paris", "Tokyo", "Maldives", "Singapore",
              "Bangkok", "Venice", "Santorini", "Rajasthan", "Kashmir", "Goa",
              "Dubai", "Bali", "Paris", "Tokyo", "Maldives", "Singapore",
              "Bangkok", "Venice", "Santorini", "Rajasthan", "Kashmir", "Goa",
            ].map((d, i) => (
              <span
                key={i}
                style={{
                  color: "rgba(255,255,255,0.92)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  padding: "0 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "18px",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                {d}
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "5px" }}>●</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// ── Default export ────────────────────────────────────────────────────────────
export default function PageHeroDefault() {
  return (
    <PageHero
      badge="Dreams Yatri · 50+ Destinations"
      headingLine1="Your Tour,"
      headingLine2Prefix="Perfectly"
      headingHighlight="Personalised"
      headingLine2Suffix="!"
      subheading="Expertly curated multi-day tours crafted around your pace, your people, and your budget."
      ctaLabel="Explore Packages"
      ctaHref="/packages"
      secondaryCtaLabel="Talk to an Expert"
      secondaryCtaHref="/contact"
    />
  );
}