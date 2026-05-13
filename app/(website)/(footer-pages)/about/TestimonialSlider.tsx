"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, MapPin, Quote, Star } from "lucide-react";
import Image from "next/image";
import Card from "@/app/components/ui/Card";

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
// Google icon SVG — inline, no external dep
// ─────────────────────────────────────────────────────────────────────────────
function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Responsive perView hook
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
// Touch / mouse drag hook
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
      if (Math.abs(dx) > 44) {
        onSwipe(dx < 0 ? 1 : -1);
        moved.current = true;
      }
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
      if (Math.abs(dx) > 44) {
        onSwipe(dx < 0 ? 1 : -1);
        moved.current = true;
      }
      dragging.current = false;
    },
    wasMoved: () => moved.current,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar palette & component
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_PALETTES: [string, string][] = [
  ["bg-red-100", "text-red-600"],
  ["bg-amber-100", "text-amber-600"],
  ["bg-sky-100", "text-sky-600"],
  ["bg-emerald-100", "text-emerald-600"],
  ["bg-violet-100", "text-violet-600"],
  ["bg-pink-100", "text-pink-600"],
];

function Avatar({
  photo,
  initials,
  name,
  index,
}: {
  photo?: string;
  initials: string;
  name: string;
  index: number;
}) {
  const [err, setErr] = useState(false);
  const [bg, text] = AVATAR_PALETTES[index % AVATAR_PALETTES.length];

  if (photo && !err) {
    return (
      <div className="relative size-11 shrink-0 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
        <Image
          src={photo}
          alt={`${name} — Dreams Yatri verified traveller`}
          fill
          sizes="44px"
          className="object-cover"
          onError={() => setErr(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`size-11 shrink-0 rounded-full flex items-center justify-center font-extrabold text-sm ring-2 ring-white shadow-sm ${bg} ${text}`}
      aria-label={`${name} initials`}
    >
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Star row
// ─────────────────────────────────────────────────────────────────────────────
function Stars({ count = 5 }: { count?: number }) {
  return (
    <div
      className="flex gap-0.5"
      aria-label={`${count} out of 5 stars`}
      role="img"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={13}
          fill={i < count ? "#FBBF24" : "none"}
          stroke={i < count ? "#FBBF24" : "#D1D5DB"}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonial Card — uses your Card component system
// ─────────────────────────────────────────────────────────────────────────────
function TestimonialCard({
  item,
  index,
  onGoogleClick,
}: {
  item: TestimonialItem;
  index: number;
  onGoogleClick: (e: React.MouseEvent, url: string) => void;
}) {
  return (
    /**
     * Card variant: elevated — uses shadow-xl + ring-1 from your CVA system.
     * We add group for Tailwind group-hover utilities on children.
     * hover:-translate-y-2 + shadow upgrade on hover for the "lift" effect.
     * The extra shadow-red-100/50 gives the brand-tinted depth.
     */
    <Card
      asArticle
      variant="flat"
      radius="xl"
      padding="none"
      hoverable
      className={[
        "group flex flex-col h-full overflow-hidden",
        "hover:border-red-200",
        "transition-all duration-300 ease-out",
        "border border-neutral-200 shadow-lg",
      ].join(" ")}
      itemScope
      itemType="https://schema.org/Review"
    >
      <div className="flex flex-col flex-1 p-6 gap-4">
        {/* ── Top row: stars + Google badge ── */}
        <div className="flex items-center justify-between">
          <Stars count={item.rating ?? 5} />

          {item.googleUrl && (
            <button
              onClick={(e) => onGoogleClick(e, item.googleUrl!)}
              title={`Read ${item.name}'s full review on Google`}
              aria-label={`View ${item.name}'s review on Google`}
              className={[
                "flex items-center gap-1.5 px-2.5 py-1",
                "rounded-full border border-neutral-200 bg-transparent",
                "text-[10px] font-bold tracking-wide text-neutral-400",
                "hover:border-red-200 hover:bg-red-50 hover:text-red-600",
                "transition-all duration-150 cursor-pointer z-30",
              ].join(" ")}
            >
              <GoogleIcon size={12} />
              Review
            </button>
          )}
        </div>

        {/* ── Trip tag ── */}
        {item.tripTag && (
          <span
            className="self-start inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase text-red-600 bg-red-50 border border-red-100"
            itemProp="about"
          >
            {item.tripTag}
          </span>
        )}

        {/* ── Quote icon ── */}
        <Quote
          size={15}
          aria-hidden="true"
          className="text-red-200 shrink-0 -mb-2"
        />

        {/* ── Review text ── */}
        <p
          className="flex-1 text-[13.5px] leading-[1.8] text-neutral-600 font-normal"
          itemProp="reviewBody"
        >
          {item.text}
        </p>

        {/* ── Divider ── */}
        <hr className="border-neutral-100" />

        {/* ── Reviewer row ── */}
        <div
          className="flex items-center gap-3"
          itemProp="author"
          itemScope
          itemType="https://schema.org/Person"
        >
          <Avatar
            photo={item.photo}
            initials={item.initials}
            name={item.name}
            index={index}
          />

          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-bold text-neutral-900 truncate"
              itemProp="name"
            >
              {item.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={10} aria-hidden="true" className="text-red-400 shrink-0" />
              <p className="text-[11px] text-neutral-400 truncate">{item.route}</p>
            </div>
          </div>

          {/* Google G mark */}
          {item.googleUrl && (
            <div
              className="size-7 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <GoogleIcon size={13} />
            </div>
          )}
        </div>
      </div>

      {/* Schema.org rating meta */}
      <meta itemProp="ratingValue" content={String(item.rating ?? 5)} />
      <meta itemProp="bestRating" content="5" />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main slider
// ─────────────────────────────────────────────────────────────────────────────
export function TestimonialSlider({
  items,
  perView = 3,
  autoplay = 5000,
  label = "What Travellers Say",
  heading = "Real trips.",
  headingHighlight = "Real stories.",
  subheading = "Every review below is from a verified traveller — unedited, unfiltered, and linked directly to Google.",
}: TestimonialSliderProps) {
  const pv = usePerView(perView);
  const max = Math.max(0, items.length - pv);
  const [idx, setIdx] = useState(0);
  const [locked, setLocked] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const clamp = (n: number) => Math.max(0, Math.min(max, n));

  const slide = useCallback(
    (next: number) => {
      if (locked) return;
      const c = clamp(next);
      if (c === idx) return;
      setLocked(true);
      setIdx(c);
      setTimeout(() => setLocked(false), 500);
    },
    [locked, idx, max]
  );

  const prev = () => slide(idx - 1);
  const next = () => slide(idx + 1);

  // Autoplay
  const startAutoplay = useCallback(() => {
    if (!autoplay) return;
    autoRef.current = setInterval(() => {
      setIdx((i) => (i + 1 > max ? 0 : i + 1));
    }, autoplay);
  }, [autoplay, max]);

  useEffect(() => {
    startAutoplay();
    return () => clearInterval(autoRef.current);
  }, [startAutoplay]);

  // Keyboard nav
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [idx]);

  // Reset on responsive breakpoint change
  useEffect(() => {
    setIdx(0);
  }, [pv]);

  const drag = useDrag((dir) => (dir === 1 ? next() : prev()));

  const GAP = 16; // px — matches gap-4
  const translatePct = -(idx * (100 / pv));

  const handleGoogleClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section
      aria-label={label}
      itemScope
      itemType="https://schema.org/ItemList"
      onMouseEnter={() => clearInterval(autoRef.current)}
      onMouseLeave={startAutoplay}
    >
      <meta itemProp="name" content={label} />

      {/* ── Slider track ── */}
      <div className="relative">
        {/* Overflow container */}
        <div
          className="overflow-x-hidden rounded-2xl py-4"
          onTouchStart={drag.onTouchStart}
          onTouchEnd={drag.onTouchEnd}
          onMouseDown={drag.onMouseDown}
          onMouseUp={drag.onMouseUp}
          onMouseLeave={drag.onMouseUp}
        >
          {/* Moving track */}
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] will-change-transform cursor-grab items-stretch"
            style={{
              gap: `${GAP}px`,
              transform: `translateX(calc(${translatePct}% - ${(idx * GAP) / pv}px))`,
            }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                className="shrink-0 flex flex-col"
                style={{ width: `calc((100% - ${(pv - 1) * GAP}px) / ${pv})` }}
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                <meta itemProp="position" content={String(i + 1)} />
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
        <div className="flex items-center justify-between mt-6">
          {/* Dot indicators */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Testimonial slides">
            {Array.from({ length: max + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => slide(i)}
                role="tab"
                aria-selected={i === idx}
                aria-label={`Go to slide ${i + 1}`}
                className={[
                  "h-1.5 rounded-full border-none p-0 cursor-pointer",
                  "transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
                  i === idx ? "w-7 bg-red-500" : "w-1.5 bg-neutral-200 hover:bg-neutral-300",
                ].join(" ")}
              />
            ))}
          </div>

          {/* Prev / count / Next */}
          <div className="flex items-center gap-2">
            {/* Prev */}
            <button
              onClick={prev}
              disabled={idx === 0}
              aria-label="Previous testimonials"
              className={[
                "size-10 rounded-full flex items-center justify-center",
                "border-[1.5px] border-neutral-200 bg-white",
                "transition-all duration-150",
                idx === 0
                  ? "text-neutral-300 cursor-not-allowed opacity-45"
                  : "text-neutral-800 hover:border-red-400 hover:text-red-500 cursor-pointer",
              ].join(" ")}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>

            {/* Counter */}
            <span
              className="text-xs font-semibold text-neutral-400 w-11 text-center select-none tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {idx + 1} / {max + 1}
            </span>

            {/* Next */}
            <button
              onClick={next}
              disabled={idx === max}
              aria-label="Next testimonials"
              className={[
                "size-10 rounded-full flex items-center justify-center",
                "border-none text-white",
                "transition-all duration-150",
                idx === max
                  ? "bg-neutral-200 cursor-not-allowed opacity-45 shadow-none"
                  : "bg-red-500 hover:bg-red-600 cursor-pointer shadow-[0_3px_12px_rgba(239,68,68,0.40)] hover:shadow-[0_4px_16px_rgba(239,68,68,0.50)]",
              ].join(" ")}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo — remove before production
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_ITEMS: TestimonialItem[] = [
  {
    name: "Priya & Rohit Sharma",
    initials: "PR",
    route: "Mumbai · Kashmir Grand Tour",
    tripTag: "Kashmir",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&auto=format",
    googleUrl: "https://maps.google.com",
    text: "We'd been planning Kashmir for three years. Every time, logistics killed it. Dreams Yatri handed us an itinerary so airtight that the only thing we had to think about was which lens to use.",
  },
  {
    name: "Amit Verma",
    initials: "AV",
    route: "Delhi · Manali Family Package",
    tripTag: "Himachal Pradesh",
    rating: 5,
    googleUrl: "https://maps.google.com",
    text: "Booked a family trip to Manali with my parents who are 65+. The team customised the entire itinerary around their pace — no rushing, no panic. My father said it was the best holiday of his life.",
  },
  {
    name: "Sneha Kulkarni",
    initials: "SK",
    route: "Pune · Goa Girls Trip",
    tripTag: "Goa",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&auto=format",
    googleUrl: "https://maps.google.com",
    text: "Planned a bachelorette for 8 girls and I was terrified something would go wrong. Nothing did. Villas, transfers, beach shacks — all sorted. Dreams Yatri turned a logistical nightmare into the most fun week of our lives.",
  },
  {
    name: "Karan & Deepika Mehta",
    initials: "KD",
    route: "Bangalore · Dubai Honeymoon",
    tripTag: "Dubai",
    rating: 5,
    googleUrl: "https://maps.google.com",
    text: "First international trip together. The visa guidance alone was worth it — zero stress. Desert safari, Burj Khalifa, the souks — perfectly paced. We never once felt like tourists on a schedule.",
  },
  {
    name: "Meera Iyer",
    initials: "MI",
    route: "Hyderabad · Thailand Solo",
    tripTag: "Thailand",
    rating: 5,
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop&auto=format",
    googleUrl: "https://maps.google.com",
    text: "Solo female traveller going to Bangkok and Phuket for the first time. The team checked in every day. I never once felt alone or unsafe. Ended up extending by 2 days because I didn't want to leave.",
  },
  {
    name: "Rajesh Nair",
    initials: "RN",
    route: "Chennai · Rajasthan Royal Circuit",
    tripTag: "Rajasthan",
    rating: 5,
    googleUrl: "https://maps.google.com",
    text: "I'm the kind of traveller who reads every review obsessively before booking. I spent exactly 20 minutes with Dreams Yatri, shared my wish list, and got back an itinerary I couldn't have built myself in a week.",
  },
];

export default function TestimonialSliderDemo() {
  return (
    <div className="max-w-7xl mx-auto px-4">
      <TestimonialSlider items={DEMO_ITEMS} perView={3} autoplay={5000} />
    </div>
  );
}