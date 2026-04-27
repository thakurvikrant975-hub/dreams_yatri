"use client";

import { useRef, useState, useEffect, ElementType } from "react";
import {
    Shield, Phone, Heart, Navigation,
    CheckCircle, Smile, ArrowRight, Quote,
} from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Reveal
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
        left: "translateX(-24px)",
        right: "translateX(24px)",
    };
    return (
        <div ref={ref} className={className}
            style={{
                opacity: v ? 1 : 0,
                transform: v ? "none" : map[from],
                transition: `opacity 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.65s cubic-bezier(.4,0,.2,1) ${delay}ms`,
            }}>
            {children}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type BeliefItem = {
    icon: ElementType;
    title: string;
    desc: string;
    /** Short punchy pull-quote shown in the card accent area */
    mantra: string;
    /** Optional stat e.g. { value: "24/7", label: "On-trip support" } */
    stat?: { value: string; label: string };
    /** Accent color for icon bg and highlights — hex */
    accent: string;
};

export type WhatWeBelieveProps = {
    label?: string;
    title?: string;
    highlight?: string;
    subtitle?: string;
    items?: BeliefItem[];
    /** Unsplash or any image URL for the editorial feature panel */
    featureImage?: string;
    /** Testimonial shown inside the feature panel */
    quote?: { text: string; author: string; location: string };
};

// ─────────────────────────────────────────────────────────────────────────────
// Default data
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_ITEMS: BeliefItem[] = [
    {
        icon: Shield,
        title: "Zero Surprises",
        mantra: "Confirmed before you leave.",
        desc: "Every hotel, cab, and activity is locked in before your departure. We don't believe in 'we'll sort it.' If something changes, we absorb the problem, not you.",
        stat: { value: "100%", label: "Pre-confirmed bookings" },
        accent: "#EF4444",
    },
    {
        icon: Phone,
        title: "Always Reachable",
        mantra: "Emergencies don't keep business hours.",
        desc: "Day or night, our team picks up. Not a bot. Not a ticket system. A real person who knows your itinerary and has the vendor contacts to fix things fast.",
        stat: { value: "24/7", label: "On-trip support" },
        accent: "#0EA5E9",
    },
    {
        icon: Heart,
        title: "Made Personal",
        mantra: "Your trip, not a template.",
        desc: "We don't start with a package and bend you to fit it. We start with your pace, your people, and your must-haves — then build the itinerary around them.",
        stat: { value: "0", label: "Cookie-cutter packages" },
        accent: "#EC4899",
    },
    {
        icon: Smile,
        title: "Joy Is the Metric",
        mantra: "Not bookings. Not reviews. Joy.",
        desc: "We measure success by one thing: the feeling you have when you look back on the trip. Everything we do  hotel selection, timing, pace, food stops.",
        stat: { value: "98%", label: "Say they'd book again" },
        accent: "#F59E0B",
    },
    {
        icon: Navigation,
        title: "Local Depth",
        mantra: "We don't Google your destination.",
        desc: "Our vendor network means you eat where locals eat, sleep where the views are real, and avoid the tourist traps that every algorithm recommends. We know these places because we live them.",
        stat: { value: "300+", label: "Local vendor partners" },
        accent: "#10B981",
    },
    {
        icon: CheckCircle,
        title: "Honest Pricing",
        mantra: "The price you see is the price you pay.",
        desc: "No hidden charges. No fuel surcharges revealed on day three. No 'service fees' at checkout. Every cost is in your quote — and if it changes before you book, we tell you immediately.",
        stat: { value: "₹0", label: "Hidden charges. Ever." },
        accent: "#8B5CF6",
    },
];

const DEFAULT_QUOTE = {
    text: "I've booked five trips with Dreams Yatri now. The thing that keeps me coming back isn't just the places — it's that I completely trust them. I've never once had to worry.",
    author: "Priya Sharma",
    location: "Mumbai · 5 trips",
};

// ─────────────────────────────────────────────────────────────────────────────
// Belief card
// ─────────────────────────────────────────────────────────────────────────────
function BeliefCard({ item, index }: { item: BeliefItem; index: number }) {
    const [hovered, setHovered] = useState(false);
    const Icon = item.icon;

    return (
        <Reveal delay={index * 70} from="bottom">
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: "relative",
                    background: "#fff",
                    borderRadius: 20,
                    border: `1.5px solid ${hovered ? item.accent + "44" : "#F3F4F6"}`,
                    padding: "28px 28px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    transition: "border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease",
                    boxShadow: hovered
                        ? `0 16px 48px ${item.accent}14, 0 2px 8px rgba(0,0,0,0.04)`
                        : "0 1px 4px rgba(0,0,0,0.04)",
                    transform: hovered ? "translateY(-4px)" : "none",
                    height: "100%",
                    overflow: "hidden",
                }}
            >
                {/* Accent corner decoration */}
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: 80,
                        height: 80,
                        borderRadius: "0 20px 0 80px",
                        background: item.accent,
                        opacity: hovered ? 0.1 : 0.05,
                        transition: "opacity 0.25s ease",
                        pointerEvents: "none",
                    }}
                />

                {/* Icon */}
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: item.accent + "15",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 18,
                        flexShrink: 0,
                        transition: "background 0.25s ease",
                        ...(hovered && { background: item.accent + "25" }),
                    }}
                >
                    <Icon size={22} style={{ color: item.accent }} />
                </div>

                {/* Title */}
                <h3
                    style={{
                        fontSize: "1rem",
                        fontWeight: 800,
                        color: "#111827",
                        margin: "0 0 6px",
                        lineHeight: 1.3,
                    }}
                >
                    {item.title}
                </h3>

                {/* Mantra line */}
                <p
                    style={{
                        fontSize: "0.8rem",
                        fontStyle: "italic",
                        color: item.accent,
                        margin: "0 0 14px",
                        fontWeight: 600,
                    }}
                >
                    {item.mantra}
                </p>

                {/* Divider */}
                <div style={{ width: 32, height: 2, background: item.accent + "40", borderRadius: 2, marginBottom: 14 }} />

                {/* Desc */}
                <p
                    style={{

                        fontSize: 13.5,
                        color: "#6B7280",
                        lineHeight: 1.75,
                        margin: "0 0 20px",
                        flex: 1,
                    }}
                >
                    {item.desc}
                </p>

                {/* Stat */}
                {item.stat && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                            padding: "10px 14px",
                            borderRadius: 12,
                            background: item.accent + "0C",
                            border: `1px solid ${item.accent}22`,
                            marginTop: "auto",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "1.4rem",
                                fontWeight: 800,
                                color: item.accent,
                                lineHeight: 1,
                            }}
                        >
                            {item.stat.value}
                        </span>
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#9CA3AF",
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                            }}
                        >
                            {item.stat.label}
                        </span>
                    </div>
                )}
            </div>
        </Reveal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main section
// ─────────────────────────────────────────────────────────────────────────────
export function WhatWeBelieve({
    label = "Our Philosophy",
    title = "The principles we",
    highlight = "never compromise on",
    subtitle = "These aren't values on a wall. They're the decisions we make every single day — when it's easy and especially when it isn't.",
    items = DEFAULT_ITEMS,
    featureImage = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=1000&fit=crop&auto=format",
    quote = DEFAULT_QUOTE,
}: WhatWeBelieveProps) {

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,700;0,800;1,700&display=swap');
      `}</style>

            <section
                style={{
                    background: "#F9FAFB",
                    padding: "clamp(64px, 10vw, 112px) 24px",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {/* Faint dot grid background */}
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: "radial-gradient(circle, #D1D5DB 1.2px, transparent 1.2px)",
                        backgroundSize: "28px 28px",
                        opacity: 0.45,
                        pointerEvents: "none",
                    }}
                />

                <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", zIndex: 1 }}>

                    {/* ── TOP: two-column header ── */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 40,
                            marginBottom: 64,
                        }}
                        className="belief-header"
                    >
                        <Reveal from="left">
                            <p
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    color: "#EF4444",
                                    margin: "0 0 12px",
                                }}
                            >
                                {label}
                            </p>

                            <SectionHeading
                                text="The principles we"
                                highlight={highlight}
                                highlightPosition="suffix"
                                variant="light"
                            />

                            <p
                                style={{

                                    fontSize: "clamp(0.95rem, 1.6vw, 1.05rem)",
                                    color: "#6B7280",
                                    lineHeight: 1.75,
                                    maxWidth: 560,
                                    margin: 0,
                                }}
                            >
                                {subtitle}
                            </p>
                        </Reveal>
                    </div>

                    {/* ── MAIN: feature panel + grid ── */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "340px 1fr",
                            gap: 24,
                            alignItems: "start",
                        }}
                        className="belief-layout"
                    >

                        {/* ── Left: editorial feature panel ── */}
                        <Reveal from="left" className="belief-feature">
                            <div
                                style={{
                                    borderRadius: 24,
                                    overflow: "hidden",
                                    position: "sticky",
                                    top: 24,
                                }}
                            >
                                {/* Image */}
                                <div
                                    style={{
                                        position: "relative",
                                        height: 420,
                                        overflow: "hidden",
                                    }}
                                >
                                    <img
                                        src={featureImage}
                                        alt="What we believe"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                        loading="lazy"
                                    />
                                    {/* Overlay gradient */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.65) 100%)",
                                        }}
                                    />

                                    {/* Floating label */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            top: 20,
                                            left: 20,
                                            background: "rgba(239,68,68,0.88)",
                                            color: "#fff",

                                            fontSize: 11,
                                            fontWeight: 700,
                                            letterSpacing: "0.08em",
                                            textTransform: "uppercase",
                                            padding: "5px 12px",
                                            borderRadius: 999,
                                            backdropFilter: "blur(8px)",
                                        }}
                                    >
                                        Our Promise
                                    </div>

                                    {/* Bottom text over image */}
                                    <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
                                        <p
                                            style={{
                                                fontSize: "1.25rem",
                                                fontWeight: 700,
                                                color: "#fff",
                                                lineHeight: 1.35,
                                                margin: 0,
                                                fontStyle: "italic",
                                            }}
                                        >
                                            "You travel. We handle everything else."
                                        </p>
                                    </div>
                                </div>

                                {/* Quote panel */}
                                <div
                                    style={{
                                        background: "#111827",
                                        padding: "24px 24px 28px",
                                    }}
                                >
                                    <Quote size={20} style={{ color: "#EF4444", marginBottom: 12 }} />
                                    <p
                                        style={{

                                            fontSize: 13.5,
                                            color: "rgba(255,255,255,0.8)",
                                            lineHeight: 1.75,
                                            margin: "0 0 16px",
                                        }}
                                    >
                                        {quote.text}
                                    </p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: "50%",
                                                background: "rgba(239,68,68,0.2)",
                                                border: "1.5px solid rgba(239,68,68,0.4)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: 800,
                                                fontSize: 13,
                                                color: "#FCA5A5",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {quote.author.charAt(0)}
                                        </div>
                                        <div>
                                            <p
                                                style={{

                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: "#fff",
                                                    margin: 0,
                                                }}
                                            >
                                                {quote.author}
                                            </p>
                                            <p
                                                style={{

                                                    fontSize: 11,
                                                    color: "#6B7280",
                                                    margin: 0,
                                                }}
                                            >
                                                {quote.location}
                                            </p>
                                        </div>
                                        {/* Stars */}
                                        <div style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                                            {[...Array(5)].map((_, i) => (
                                                <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="#EF4444" stroke="none">
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                                </svg>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Bottom CTA card */}
                            <Reveal delay={items.length * 70} className="belief-cta-card mt-10">
                                <div
                                    style={{
                                        gridColumn: "1 / -1",
                                        background: "linear-gradient(135deg, #111827 0%, #1F2937 100%)",
                                        borderRadius: 20,
                                        padding: "28px 28px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: 20,
                                        border: "1.5px solid rgba(255,255,255,0.06)",
                                    }}
                                >
                                    <div>
                                        <p
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                letterSpacing: "0.1em",
                                                textTransform: "uppercase",
                                                color: "#FCA5A5",
                                                margin: "0 0 6px",
                                            }}
                                        >
                                            Experience the difference
                                        </p>
                                        <p
                                            style={{
                                                color: "#fff",
                                                margin: 0,
                                            }}
                                        >
                                            These aren't promises. They're our track record.
                                        </p>
                                    </div>
                                    <Link
                                        href="/contact"
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 8,
                                            background: "#EF4444",
                                            color: "#fff",
                                            fontWeight: 700,
                                            fontSize: 14,
                                            padding: "12px 24px",
                                            borderRadius: 12,
                                            textDecoration: "none",
                                            whiteSpace: "nowrap",
                                            flexShrink: 0,
                                            boxShadow: "0 4px 16px rgba(239,68,68,0.35)",
                                            transition: "opacity 0.2s",
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                                        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                                    >
                                        Plan a Trip <ArrowRight size={15} />
                                    </Link>
                                </div>
                            </Reveal>
                        </Reveal>

                        {/* ── Right: 2-col belief cards grid ── */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 16,
                                alignItems: "start",
                            }}
                            className="belief-grid"
                        >
                            {items.map((item, i) => (
                                <BeliefCard key={i} item={item} index={i} />
                            ))}

                        </div>
                    </div>
                </div>

                {/* Responsive styles */}
                <style>{`
          @media (max-width: 1023px) {
            .belief-layout {
              grid-template-columns: 1fr !important;
            }
            .belief-feature {
              display: none !important;
            }
          }
          @media (max-width: 639px) {
            .belief-grid {
              grid-template-columns: 1fr !important;
            }
            .belief-cta-card {
              grid-column: 1 / -1 !important;
            }
          }
        `}</style>
            </section>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export for standalone use / demo
// ─────────────────────────────────────────────────────────────────────────────
export default function WhatWeBelieveDemo() {
    return <WhatWeBelieve />;
}