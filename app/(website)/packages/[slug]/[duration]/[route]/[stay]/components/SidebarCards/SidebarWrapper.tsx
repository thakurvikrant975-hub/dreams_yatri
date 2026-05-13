'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';

interface Props {
  pricing: ReactNode;
  coupon:  ReactNode;
  enquiry: ReactNode;
}

const STICKY_TOP = 'var(--header-height, 70px)';

interface FixedPos { top: number; left: number; width: number }

export default function SidebarWrapper({ pricing, coupon, enquiry }: Props) {
  const sidebarRef  = useRef<HTMLElement>(null);
  const pricingRef  = useRef<HTMLDivElement>(null);
  const originalRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const dupRef      = useRef<HTMLDivElement>(null);
const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [floated, setFloated] = useState(false);
  const [pos, setPos]         = useState<FixedPos | null>(null);

  const snapPos = () => {
    const pr = pricingRef.current?.getBoundingClientRect();
    const sr = sidebarRef.current?.getBoundingClientRect();
    const sn = sentinelRef.current?.getBoundingClientRect();
    const dh = dupRef.current?.offsetHeight ?? 0;

    if (!pr || !sr) return;

    const rawTop  = pr.bottom;
    const maxTop  = sn ? sn.top - dh : rawTop;
    const clipped = Math.min(rawTop, maxTop);

    setPos({ top: clipped, left: sr.left, width: sr.width });
  };

  useEffect(() => {
    const el = originalRef.current;
    if (!el) return;

    const ob = new IntersectionObserver(([entry]) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const isOut = !entry.isIntersecting;
        if (isOut) snapPos();
        setFloated(isOut);
      }, 60);
    }, {
      threshold: 0,
      rootMargin: '-20px 0px 0px 0px',
    });

    ob.observe(el);
    return () => { ob.disconnect(); clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep fixed pos accurate on scroll (clamp against sentinel) and resize
  useEffect(() => {
    if (!floated) return;
    window.addEventListener('scroll', snapPos, { passive: true });
    window.addEventListener('resize', snapPos);
    return () => {
      window.removeEventListener('scroll', snapPos);
      window.removeEventListener('resize', snapPos);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floated]);

  return (
    <aside ref={sidebarRef} className="w-[27%] flex flex-col gap-3">

      {/* Pricing — always sticky */}
      <div ref={pricingRef} className="sticky z-20 flex flex-col gap-3" style={{ top: STICKY_TOP }}>
        {pricing}
      </div>

      {/* Coupon — scrolls freely, sits behind via z-index */}
      <div className="relative z-10">
        {coupon}
      </div>

      {/* Original enquiry — scrolls; fades out as duplicate takes over */}
      <div
        ref={originalRef}
        className="transition-opacity duration-300"
        style={{ opacity: floated ? 0 : 1 }}
      >
        {enquiry}
      </div>

      {/* Sentinel at bottom of aside — used to clamp duplicate above footer */}
      <div ref={sentinelRef} />

      {/* Fixed duplicate — clamped top prevents overlapping footer */}
      {floated && pos && (
        <div
          ref={dupRef}
          className="fixed z-40"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {enquiry}
        </div>
      )}

    </aside>
  );
}
