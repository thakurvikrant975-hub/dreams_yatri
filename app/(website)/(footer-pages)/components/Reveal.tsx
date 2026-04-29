"use client";
import { useRef, useEffect, useState } from "react";


function useInView(threshold = 0.1) {
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

export function Reveal({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const { ref, v } = useInView();
  return (
    <div ref={ref} className={className} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : "translateY(22px)",
      transition: `opacity 0.6s cubic-bezier(.4,0,.2,1) ${delay}ms, transform 0.6s cubic-bezier(.4,0,.2,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}