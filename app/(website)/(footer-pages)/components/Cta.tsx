"use client"

import React from 'react'
import { useEffect, useRef, useState } from 'react';
import { Phone } from 'lucide-react';

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

export const Cta = () => {
  return (
    <div>
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
  )
}

export default Cta
