"use client";

import { useRef, useState, useEffect, ElementType } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Reveal hook
// ─────────────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
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

function Reveal({
  children, delay = 0, from = "bottom", className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  from?: "bottom" | "left" | "right";
  className?: string;
}) {
  const { ref, v } = useInView();
  const map = {
    bottom: "translateY(28px)",
    left:   "translateX(-28px)",
    right:  "translateX(28px)",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    v ? 1 : 0,
        transform:  v ? "none" : map[from],
        transition: `opacity 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TimelineVariant = "light" | "dark";
export type TimelineLayout  = "alternating" | "left" | "right";

export type TimelineItem = {
  /** Year / date label shown as the red pill */
  year: string;
  /** Card headline */
  title: string;
  /** Body copy */
  desc: string;
  /** Lucide icon component — rendered inside the centre dot */
  icon?: ElementType;
  /**
   * Optional tag label shown above the title inside the card
   * e.g. "Milestone" | "Launch" | "Award"
   */
  tag?: string;
  /**
   * Optional stat highlighted inside the card
   * e.g. { value: "10K+", label: "Travellers" }
   */
  stat?: { value: string; label: string };
  /**
   * Optional image URL shown in the card.
   * Displayed as a 16:9 thumbnail above the card copy.
   */
  image?: string;
  /** Alt text for the image */
  imageAlt?: string;
};

export type TimelineProps = {
  items: TimelineItem[];

  /**
   * "light" → white background, dark text
   * "dark"  → dark background, light text
   * Default: "light"
   */
  variant?: TimelineVariant;

  /**
   * "alternating" → items alternate left / right (desktop)
   * "left"        → all cards on the right, dots on the left edge
   * "right"       → all cards on the left, dots on the right edge
   * Default: "alternating"
   */
  layout?: TimelineLayout;

  /** Stagger delay between items in ms. Default: 60 */
  staggerMs?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const TOKENS = {
  light: {
    bg:          "transparent",
    cardBg:      "#ffffff",
    cardBorder:  "#F3F4F6",
    cardHover:   "#FECACA",
    title:       "#111827",
    desc:        "#6B7280",
    tag:         "#9CA3AF",
    line:        "#E5E7EB",
    lineActive:  "#EF4444",
    statVal:     "#111827",
    statLabel:   "#9CA3AF",
    dot:         "#EF4444",
    dotBorder:   "#ffffff",
    dotShadow:   "0 0 0 4px rgba(239,68,68,0.15)",
    pillBg:      "#FEF2F2",
    pillText:    "#DC2626",
    pillBorder:  "#FECACA",
  },
  dark: {
    bg:          "transparent",
    cardBg:      "rgba(255,255,255,0.05)",
    cardBorder:  "rgba(255,255,255,0.10)",
    cardHover:   "rgba(239,68,68,0.4)",
    title:       "#ffffff",
    desc:        "#9CA3AF",
    tag:         "#6B7280",
    line:        "rgba(255,255,255,0.10)",
    lineActive:  "#EF4444",
    statVal:     "#ffffff",
    statLabel:   "#6B7280",
    dot:         "#EF4444",
    dotBorder:   "#111827",
    dotShadow:   "0 0 0 4px rgba(239,68,68,0.25)",
    pillBg:      "rgba(239,68,68,0.15)",
    pillText:    "#FCA5A5",
    pillBorder:  "rgba(239,68,68,0.3)",
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

function TimelineCard({
  item,
  t,
  align,
}: {
  item: TimelineItem;
  t: typeof TOKENS.light;
  align: "left" | "right";
}) {
  const [hovered, setHovered] = useState(false);
  const textAlign = align === "left" ? "right" : "left";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   t.cardBg,
        border:       `1.5px solid ${hovered ? t.cardHover : t.cardBorder}`,
        borderRadius: 20,
        overflow:     "hidden",
        transition:   "border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease",
        boxShadow:    hovered
          ? "0 12px 40px rgba(239,68,68,0.10), 0 2px 8px rgba(0,0,0,0.06)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transform:    hovered ? "translateY(-3px)" : "none",
      }}
    >
      {/* Image */}
      {item.image && (
        <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden" }}>
          <img
            src={item.image}
            alt={item.imageAlt ?? item.title}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transition: "transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94)",
              transform: hovered ? "scale(1.06)" : "scale(1)",
            }}
            loading="lazy"
            draggable={false}
          />
        </div>
      )}

      <div style={{ padding: "20px 22px 22px" }}>
        {/* Year pill + optional tag */}
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            8,
            marginBottom:   12,
            flexDirection:  align === "left" ? "row-reverse" : "row",
          }}
        >
          <span
            style={{
              fontSize:      11,
              fontWeight:    800,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              background:    t.pillBg,
              color:         t.pillText,
              border:        `1px solid ${t.pillBorder}`,
              borderRadius:  999,
              padding:       "3px 10px",
              whiteSpace:    "nowrap",
              fontFamily:    "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {item.year}
          </span>

          {item.tag && (
            <span
              style={{
                fontSize:      10,
                fontWeight:    700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color:         t.tag,
                fontFamily:    "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {item.tag}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            fontFamily:  "'Plus Jakarta Sans', sans-serif",
            fontSize:    "clamp(1rem, 1.8vw, 1.1rem)",
            fontWeight:  700,
            color:       t.title,
            margin:      "0 0 8px",
            lineHeight:  1.3,
            textAlign,
          }}
        >
          {item.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontFamily:  "'Plus Jakarta Sans', sans-serif",
            fontSize:    13,
            color:       t.desc,
            lineHeight:  1.7,
            margin:      "0 0 14px",
            textAlign,
          }}
        >
          {item.desc}
        </p>

        {/* Optional stat */}
        {item.stat && (
          <div
            style={{
              display:       "inline-flex",
              flexDirection: "column",
              alignItems:    align === "left" ? "flex-end" : "flex-start",
              gap:           2,
              padding:       "8px 14px",
              borderRadius:  12,
              background:    "rgba(239,68,68,0.08)",
              border:        "1px solid rgba(239,68,68,0.14)",
              width:         "auto",
            }}
          >
            <span
              style={{
                fontFamily:  "'Playfair Display', serif",
                fontSize:    "1.4rem",
                fontWeight:  800,
                color:       "#EF4444",
                lineHeight:  1,
              }}
            >
              {item.stat.value}
            </span>
            <span
              style={{
                fontFamily:    "'Plus Jakarta Sans', sans-serif",
                fontSize:      10,
                fontWeight:    700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color:         t.statLabel,
              }}
            >
              {item.stat.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Centre dot
// ─────────────────────────────────────────────────────────────────────────────

function CentreDot({ Icon, t }: { Icon?: ElementType; t: typeof TOKENS.light }) {
  return (
    <div
      style={{
        flexShrink:      0,
        width:           44,
        height:          44,
        borderRadius:    "50%",
        background:      t.dot,
        border:          `4px solid ${t.dotBorder}`,
        boxShadow:       t.dotShadow,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        zIndex:          10,
        position:        "relative",
      }}
    >
      {Icon
        ? <Icon size={16} color="#fff" />
        : <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", display: "block" }} />
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress line segment (animated on scroll)
// ─────────────────────────────────────────────────────────────────────────────

function LineSegment({ t, isLast }: { t: typeof TOKENS.light; isLast: boolean }) {
  const { ref, v } = useInView(0.2);
  if (isLast) return null;
  return (
    <div ref={ref} style={{ width: 2, flex: 1, minHeight: 32, background: t.line, position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position:   "absolute",
          top:        0, left: 0, right: 0,
          height:     v ? "100%" : "0%",
          background: t.lineActive,
          transition: "height 0.8s cubic-bezier(0.4,0,0.2,1) 0.15s",
          opacity:    0.5,
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Timeline
// ─────────────────────────────────────────────────────────────────────────────

export function Timeline({
  items,
  variant  = "light",
  layout   = "alternating",
  staggerMs = 60,
}: TimelineProps) {
  const t = TOKENS[variant];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');

        /* Mobile-only styles */
        @media (max-width: 639px) {
          .tl-desktop { display: none !important; }
          .tl-mobile  { display: flex !important; }
        }
        @media (min-width: 640px) {
          .tl-desktop { display: flex !important; }
          .tl-mobile  { display: none !important; }
        }
      `}</style>

      <div style={{ position: "relative", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

        {/* ── DESKTOP ── */}
        <div className="tl-desktop" style={{ display: "none", flexDirection: "column", gap: 0 }}>

          {/* Vertical centre spine */}
          <div
            style={{
              position:   "absolute",
              left:       layout === "left" ? 22 : layout === "right" ? "calc(100% - 22px)" : "50%",
              top:        22, bottom: 22,
              width:      2,
              background: t.line,
              transform:  "translateX(-50%)",
              zIndex:     0,
            }}
          />

          {items.map((item, i) => {
            // Determine card side
            const isLeft =
              layout === "alternating" ? i % 2 === 0 :
              layout === "left"       ? false :
                                        true;

            return (
              <Reveal key={i} delay={i * staggerMs} from="bottom">
                <div
                  style={{
                    display:     "flex",
                    alignItems:  "center",
                    gap:         0,
                    marginBottom: i < items.length - 1 ? 40 : 0,
                    position:    "relative",
                  }}
                >
                  {/* Left content area */}
                  <div style={{ flex: 1, paddingRight: layout === "right" ? 0 : 28 }}>
                    {(layout === "alternating" ? isLeft : layout === "right") && (
                      <Reveal from="left" delay={i * staggerMs + 80}>
                        <TimelineCard item={item} t={t} align="left" />
                      </Reveal>
                    )}
                  </div>

                  {/* Centre dot + connector lines */}
                  <div
                    style={{
                      display:        "flex",
                      flexDirection:  "column",
                      alignItems:     "center",
                      flexShrink:     0,
                      width:          44,
                      position:       "relative",
                      zIndex:         1,
                    }}
                  >
                    <CentreDot Icon={item.icon} t={t} />
                  </div>

                  {/* Right content area */}
                  <div style={{ flex: 1, paddingLeft: layout === "left" ? 28 : 0 }}>
                    {(layout === "alternating" ? !isLeft : layout === "left") && (
                      <Reveal from="right" delay={i * staggerMs + 80}>
                        <TimelineCard item={item} t={t} align="right" />
                      </Reveal>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* ── MOBILE — left-rail layout ── */}
        <div className="tl-mobile" style={{ display: "none", flexDirection: "column", gap: 0, paddingLeft: 52 }}>

          {/* Left spine */}
          <div
            style={{
              position:   "absolute",
              left:       20,
              top:        22, bottom: 22,
              width:      2,
              background: t.line,
              zIndex:     0,
            }}
          />

          {items.map((item, i) => (
            <Reveal key={i} delay={i * staggerMs} from="right">
              <div style={{ position: "relative", marginBottom: i < items.length - 1 ? 28 : 0 }}>

                {/* Mobile dot */}
                <div
                  style={{
                    position:   "absolute",
                    left:       -43,
                    top:        item.image ? "calc(28% + 0px)" : 14,
                    width:      36,
                    height:     36,
                    borderRadius: "50%",
                    background: t.dot,
                    border:     `3px solid ${t.dotBorder}`,
                    boxShadow:  t.dotShadow,
                    display:    "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex:     10,
                  }}
                >
                  {item.icon
                    ? <item.icon size={13} color="#fff" />
                    : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "block" }} />
                  }
                </div>

                <TimelineCard item={item} t={t} align="right" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo — remove before production
// ─────────────────────────────────────────────────────────────────────────────

import {
  Mountain, Zap, Users, Globe, Plane, Star,
  Award, Heart, MapPin, TrendingUp,
} from "lucide-react";

const DEMO_ITEMS: TimelineItem[] = [
  {
    year:     "2019",
    tag:      "The Spark",
    title:    "One Cold Night in Manali",
    desc:     "Stranded at midnight with a dead phone and an unconfirmed hotel, Vikrant asked himself why something he loved felt like punishment. A notebook came out. A company was born.",
    icon:     Mountain,
    image:    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=338&fit=crop&auto=format",
    imageAlt: "Manali mountains at night",
    stat:     { value: "1", label: "Promise Made" },
  },
  {
    year:     "2020",
    tag:      "Built in Lockdown",
    title:    "Blueprint in a Locked-Down World",
    desc:     "While the world paused, the team mapped every friction point in travel — vendor networks, pricing models, backup protocols. The architecture of zero-stress travel took shape.",
    icon:     Zap,
    image:    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=338&fit=crop&auto=format",
    imageAlt: "Planning on a desk",
    stat:     { value: "300+", label: "Vendors Onboarded" },
  },
  {
    year:     "2021",
    tag:      "Proof of Concept",
    title:    "First 100 Families Trust Us",
    desc:     "Word of mouth carried us further than any ad budget. A hundred families explored Himachal Pradesh with zero logistics anxiety. The model was validated.",
    icon:     Users,
    image:    "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&h=338&fit=crop&auto=format",
    imageAlt: "Happy family on a trip",
    stat:     { value: "100", label: "Trips Completed" },
  },
  {
    year:     "2022",
    tag:      "Expanding the Map",
    title:    "Kashmir, Rajasthan, Goa & Beyond",
    desc:     "Each new destination was added with the same obsession: can we make this completely worry-free? The answer, every time, was yes.",
    icon:     Globe,
    image:    "https://images.unsplash.com/photo-1548013146-72479768bada?w=600&h=338&fit=crop&auto=format",
    imageAlt: "Kashmir Dal Lake",
    stat:     { value: "12", label: "Destinations" },
  },
  {
    year:     "2023",
    tag:      "International Launch",
    title:    "Dubai & Thailand Join the Portfolio",
    desc:     "10,000+ travellers had trusted us by year-end. The team doubled. International packages launched with the same ground-level attention to detail.",
    icon:     Plane,
    image:    "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=338&fit=crop&auto=format",
    imageAlt: "Dubai skyline",
    stat:     { value: "10K+", label: "Happy Travellers" },
  },
  {
    year:     "2024+",
    tag:      "The Vision Scales",
    title:    "50+ Destinations. The Platform Begins.",
    desc:     "A full travel platform in development. More destinations, more travellers, and the same unbreakable promise: you travel, we handle everything else.",
    icon:     Star,
    image:    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=338&fit=crop&auto=format",
    imageAlt: "Adventure travel",
    stat:     { value: "50+", label: "Destinations" },
  },
];

export default function TimelineDemo() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Light variant */}
      <section style={{ background: "#ffffff", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1024, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#EF4444", marginBottom: 8 }}>Our Journey</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem,3.5vw,2.5rem)", fontWeight: 800, color: "#111827", margin: "0 0 48px" }}>
            From one bad night to{" "}
            <span style={{ color: "#EF4444", fontStyle: "italic" }}>50,000 great trips</span>
          </h2>
          <Timeline items={DEMO_ITEMS} variant="light" layout="alternating" />
        </div>
      </section>

      {/* Dark variant */}
      <section style={{ background: "#111827", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1024, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FCA5A5", marginBottom: 8 }}>Our Milestones</p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.7rem,3.5vw,2.5rem)", fontWeight: 800, color: "#fff", margin: "0 0 48px" }}>
            Every milestone,{" "}
            <span style={{ color: "#EF4444", fontStyle: "italic" }}>every story</span>
          </h2>
          <Timeline items={DEMO_ITEMS} variant="dark" layout="alternating" />
        </div>
      </section>
    </div>
  );
}