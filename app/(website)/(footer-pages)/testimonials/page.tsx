"use client";

import { useState, useEffect, useRef } from "react";
import { Star, Quote, MapPin, ChevronDown, Filter } from "lucide-react";
import { AVATAR_COLORS, TESTIMONIALS, DESTINATIONS, FEATURED_ITEMS } from "./data";
import Hero from "../components/Hero";
import { FeaturedTestimonialSlider } from "./Featuredtestimonialslider";
import { SectionHeading } from "../components/SectionHeading";
import Reviews from "./Reviews";

// ── Reveal on scroll ──────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function Reveal({
  children, delay = 0, className = "", from = "bottom",
}: {
  children: React.ReactNode; delay?: number; className?: string; from?: "bottom" | "left" | "right";
}) {
  const { ref, visible } = useInView();
  const translateMap = { bottom: "translateY(28px)", left: "translateX(-28px)", right: "translateX(28px)" };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0,0)" : translateMap[from],
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Count-up ──────────────────────────────────────────────────────────────────
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        let cur = 0; const step = Math.ceil(to / 55);
        const t = setInterval(() => { cur = Math.min(cur + step, to); setVal(cur); if (cur >= to) clearInterval(t); }, 26);
      }
    }, { threshold: 0.5 });
    obs.observe(el); return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}






// ── Page ──────────────────────────────────────────────────────────────────────
export default function TestimonialsPage() {

  return (
    <div
      className="bg-white min-h-screen"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >


      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <Hero>

        <div className="max-w-6xl mx-auto px-6 py-12 sm:px-8 relative z-10">
          <div className="max-w-2xl">
            {/* Label */}
            <div
              className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border text-xs font-bold tracking-widest uppercase"
              style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.28)", color: "#FCA5A5", animation: "hero-rise 0.55s ease both" }}
            >
              <Star size={11} fill="#FCA5A5" stroke="none" />
              Traveller Stories
            </div>

            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(2.2rem, 5.5vw, 3.8rem)",
                fontWeight: 800, color: "#fff",
                lineHeight: 1.1, margin: "0 0 20px",
                animation: "hero-rise 0.6s ease 0.08s both",
              }}
            >
              10,000 journeys.{" "}
              <span style={{ color: "#EF4444", fontStyle: "italic" }}>10,000 stories.</span>
            </h1>

            <p
              className="text-gray-400 leading-relaxed mb-0"
              style={{ fontSize: "clamp(0.95rem, 1.8vw, 1.08rem)", maxWidth: "500px", animation: "hero-rise 0.6s ease 0.16s both" }}
            >
              Don't take our word for it. Every review below is from a real traveller who trusted us with one of the most important decisions of their year.
            </p>
          </div>

          {/* Stat row */}
          <div
            className="flex flex-wrap gap-8 mt-12"
            style={{ animation: "hero-rise 0.6s ease 0.24s both" }}
          >
            {[
              { val: 10000, sfx: "+", label: "Trips Delivered" },
              { val: 98, sfx: "%", label: "Recommend Us" },
              { val: 4.9, sfx: "/5", label: "Avg. Rating", fixed: true },
              { val: 50, sfx: "+", label: "Destinations" },
            ].map((s, i) => (
              <div key={i}>
                <p style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>
                  {s.fixed ? "4.9/5" : <><CountUp to={s.val} suffix={s.sfx} /></>}
                </p>
                <p className="text-gray-500 text-xs mt-1.5 font-semibold tracking-widest uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Hero>

      <FeaturedTestimonialSlider items={FEATURED_ITEMS} autoplay={6000} />
      <Reviews />

 

      {/* ── VIDEO TESTIMONIAL PLACEHOLDER ─────────────────────────────────── */}
      <section className="bg-gray-950 py-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <Reveal className="text-center mb-12">
            <p className="text-xs font-bold tracking-widest uppercase text-red-400 mb-3">In Their Own Words</p>
            <SectionHeading
              text="Watch what our "
              highlight="travellers say"
              highlightPosition="suffix"
              variant="dark"
            />
          </Reveal>

          {/* 3 video placeholders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { name: "Priya & Rohit", dest: "Kashmir", thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=500&h=300&fit=crop&auto=format" },
              { name: "Amit Verma", dest: "Manali", thumb: "https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=500&h=300&fit=crop&auto=format" },
              { name: "Karan & Deepika", dest: "Dubai", thumb: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=500&h=300&fit=crop&auto=format" },
            ].map((v, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="relative rounded-2xl overflow-hidden group cursor-pointer" style={{ aspectRatio: "16/9" }}>
                  <img src={v.thumb} alt={v.dest} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/55 transition-colors duration-300" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:bg-red-500/80 group-hover:border-red-500 transition-all duration-300">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ marginLeft: "3px" }}>
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="absolute bottom-0 left-0 right-0 p-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
                    <p className="text-white font-bold text-sm">{v.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin size={11} className="text-red-400" />
                      <span className="text-gray-300 text-xs">{v.dest}</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="text-center mt-8">
            <p className="text-gray-600 text-sm">Video testimonials coming soon · <a href="#" className="text-red-400 hover:text-red-300 font-semibold transition-colors underline underline-offset-2">Subscribe to our channel</a></p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}