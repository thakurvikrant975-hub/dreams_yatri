"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/Card";
import {
  StarIcon,
  MapPinIcon,
  HeartIcon,
  ShareIcon,
  CheckCircleIcon,
  CheckIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  WifiIcon,
  TruckIcon,
  BuildingStorefrontIcon,
  BoltIcon,
  SparklesIcon,
  FireIcon,
  ClockIcon,
  ArrowRightIcon,
  HandThumbUpIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import type { Hotel, Room, RatePlan } from "./dummy";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const AMENITY_ICONS: Record<string, typeof WifiIcon> = {
  wifi: WifiIcon,
  parking: TruckIcon,
  restaurant: BuildingStorefrontIcon,
  ac: BoltIcon,
  pool: SparklesIcon,
  gym: FireIcon,
  spa: SparklesIcon,
  desk: ClockIcon,
};

// ── Small shared bits ─────────────────────────────────────────────────────────

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <StarSolid key={i} className="text-amber-400" style={{ width: size, height: size }} />
      ))}
    </span>
  );
}

function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-bold text-white bg-emerald-600",
        size === "md" ? "px-2 py-1 text-sm" : "px-1.5 py-0.5 text-xs"
      )}
    >
      {score.toFixed(1)}
    </span>
  );
}

// ── Sticky search context bar ─────────────────────────────────────────────────

function SearchBar({ hotel }: { hotel: Hotel }) {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-sm">
      <div className="screen-space py-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[160px] flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
          <MapPinIcon className="w-4 h-4 text-primary-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">City</p>
            <p className="text-sm font-semibold text-neutral-800 truncate">{hotel.city}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
          <CalendarDaysIcon className="w-4 h-4 text-primary-500 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">Check-in — Check-out</p>
            <p className="text-sm font-semibold text-neutral-800">Thu, 22 Feb — Fri, 23 Feb</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
          <UserGroupIcon className="w-4 h-4 text-primary-500 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">Guests</p>
            <p className="text-sm font-semibold text-neutral-800">1 Room, 2 Adults</p>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-5 py-2.5 transition-colors">
          <MagnifyingGlassIcon className="w-4 h-4" />
          Update Search
        </button>
      </div>
    </div>
  );
}

// ── Gallery ───────────────────────────────────────────────────────────────────

function Gallery({ images, onOpen }: { images: string[]; onOpen: (i: number) => void }) {
  return (
    <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[340px] sm:h-[420px] rounded-2xl overflow-hidden">
      <button
        onClick={() => onOpen(0)}
        className="relative col-span-2 row-span-2 group"
      >
        <Image src={images[0]} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="50vw" />
      </button>
      {images.slice(1, 5).map((src, i) => (
        <button key={i} onClick={() => onOpen(i + 1)} className="relative group">
          <Image src={src} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="25vw" />
          {i === 3 && images.length > 5 && (
            <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-sm font-semibold backdrop-blur-[1px]">
              +{images.length - 5} Photos
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Lightbox({ images, index, onClose, onNav }: { images: string[]; index: number; onClose: () => void; onNav: (d: number) => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav(1);
      if (e.key === "ArrowLeft") onNav(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, onNav]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={onClose}>
        <XMarkIcon className="w-8 h-8" />
      </button>
      <button
        className="absolute left-4 text-white/80 hover:text-white p-2"
        onClick={(e) => { e.stopPropagation(); onNav(-1); }}
      >
        <ChevronLeftIcon className="w-9 h-9" />
      </button>
      <div className="relative w-[90vw] h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <Image src={images[index]} alt="" fill className="object-contain" sizes="90vw" />
      </div>
      <button
        className="absolute right-4 text-white/80 hover:text-white p-2"
        onClick={(e) => { e.stopPropagation(); onNav(1); }}
      >
        <ChevronRightIcon className="w-9 h-9" />
      </button>
      <span className="absolute bottom-5 text-white/70 text-sm">{index + 1} / {images.length}</span>
    </div>
  );
}

// ── In-page nav ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "amenities", label: "Amenities" },
  { id: "rooms", label: "Rooms" },
  { id: "location", label: "Location" },
  { id: "reviews", label: "Reviews" },
];

function SubNav({ active, onJump }: { active: string; onJump: (id: string) => void }) {
  return (
    <div className="sticky top-[57px] z-20 bg-white/95 backdrop-blur border-b border-neutral-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      <div className="flex gap-1 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => onJump(s.id)}
            className={cn(
              "px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors",
              active === s.id
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Room card + rate rows ─────────────────────────────────────────────────────

function RoomImageCarousel({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="relative h-44 sm:h-full min-h-[176px] rounded-xl overflow-hidden group">
      <Image src={images[i]} alt={name} fill className="object-cover" sizes="(max-width:640px) 100vw, 33vw" />
      <button
        onClick={() => setI((v) => (v - 1 + images.length) % images.length)}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeftIcon className="w-4 h-4 text-neutral-700" />
      </button>
      <button
        onClick={() => setI((v) => (v + 1) % images.length)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRightIcon className="w-4 h-4 text-neutral-700" />
      </button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {images.map((_, k) => (
          <span key={k} className={cn("w-1.5 h-1.5 rounded-full transition-colors", k === i ? "bg-white" : "bg-white/50")} />
        ))}
      </div>
    </div>
  );
}

function RateRow({
  plan,
  selected,
  onSelect,
}: {
  plan: RatePlan;
  selected: boolean;
  onSelect: () => void;
}) {
  const off = Math.round(((plan.originalPrice - plan.price) / plan.originalPrice) * 100);
  return (
    <div className={cn(
      "grid sm:grid-cols-[1fr_auto] gap-3 p-4 transition-colors",
      selected && "bg-primary-50/50"
    )}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-neutral-800">{plan.mealPlan}</p>
          {plan.badge && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary-600 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5">
              {plan.badge}
            </span>
          )}
        </div>
        <ul className="space-y-1">
          {plan.inclusions.map((inc) => (
            <li key={inc} className="flex items-center gap-1.5 text-xs text-neutral-600">
              <CheckIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {inc}
            </li>
          ))}
          <li className={cn("flex items-center gap-1.5 text-xs font-medium", plan.refundable ? "text-emerald-700" : "text-neutral-500")}>
            <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0" />
            {plan.cancellation}
          </li>
        </ul>
      </div>

      <div className="sm:text-right flex sm:flex-col items-end justify-between gap-1">
        <div>
          <div className="flex items-center gap-1.5 sm:justify-end">
            <span className="text-xs text-neutral-400 line-through">{money(plan.originalPrice)}</span>
            <span className="text-[11px] font-semibold text-emerald-600">{off}% off</span>
          </div>
          <p className="text-xl font-bold text-neutral-900 leading-tight">{money(plan.price)}</p>
          <p className="text-[11px] text-neutral-400">+ {money(plan.taxes)} taxes & fees / night</p>
        </div>
        <button
          onClick={onSelect}
          className={cn(
            "shrink-0 rounded-lg text-xs font-bold px-4 py-2 transition-colors mt-1",
            selected
              ? "bg-primary-600 text-white hover:bg-primary-700"
              : "bg-white text-primary-600 ring-1 ring-inset ring-primary-300 hover:bg-primary-50"
          )}
        >
          {selected ? "SELECTED" : "SELECT ROOM"}
        </button>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  selectedRate,
  onSelectRate,
}: {
  room: Room;
  selectedRate: string | null;
  onSelectRate: (roomId: string, plan: RatePlan) => void;
}) {
  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <div className="grid md:grid-cols-[280px_1fr]">
        {/* Room info */}
        <div className="p-4 md:border-r border-neutral-100 bg-neutral-50/40">
          <RoomImageCarousel images={room.images} name={room.name} />
          <h3 className="text-sm font-bold text-neutral-800 mt-3 leading-snug">{room.name}</h3>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-neutral-600">
            <span>📐 {room.size}</span>
            <span>🛏 {room.bed}</span>
            <span>🌆 {room.view}</span>
            <span>👥 {room.occupancy}</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {room.amenities.slice(0, 4).map((a) => (
              <span key={a} className="text-[10px] text-neutral-500 bg-white border border-neutral-200 rounded-full px-2 py-0.5">
                {a}
              </span>
            ))}
            {room.amenities.length > 4 && (
              <span className="text-[10px] font-semibold text-primary-600">+{room.amenities.length - 4} more</span>
            )}
          </div>
        </div>

        {/* Rate plans */}
        <div className="divide-y divide-neutral-100">
          {room.ratePlans.map((plan) => (
            <RateRow
              key={plan.id}
              plan={plan}
              selected={selectedRate === plan.id}
              onSelect={() => onSelectRate(room.id, plan)}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────────

function Reviews({ hotel }: { hotel: Hotel }) {
  const r = hotel.reviews;
  return (
    <section id="reviews" className="scroll-mt-32">
      <h2 className="text-lg font-bold text-neutral-800 mb-4">Guest Ratings & Reviews</h2>
      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Summary */}
        <Card variant="elevated" radius="md" className="p-5 h-fit">
          <div className="flex items-center gap-3">
            <ScoreBadge score={r.overall} />
            <div>
              <p className="text-sm font-bold text-neutral-800">{r.label}</p>
              <p className="text-xs text-neutral-500">{r.count.toLocaleString("en-IN")} reviews</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {r.categories.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span className="text-xs text-neutral-600 w-28 shrink-0">{c.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(c.score / 5) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-neutral-700 w-7 text-right">{c.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Review list */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {["All Reviews", "Family", "Couple", "Business", "Solo"].map((f, i) => (
              <button
                key={f}
                className={cn(
                  "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                  i === 0 ? "bg-primary-600 text-white border-primary-600" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          {r.items.map((item) => (
            <Card key={item.id} variant="elevated" radius="md" className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {item.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{item.name}</p>
                      <p className="text-[11px] text-neutral-400">{item.date} · {item.roomType} · {item.tripType}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 rounded-lg px-1.5 py-0.5 shrink-0">
                      {item.rating.toFixed(1)} <StarSolid className="w-3 h-3" />
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700 mt-2">{item.label}</p>
                  <p className="text-sm text-neutral-500 leading-relaxed mt-1">{item.text}</p>
                  <button className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-primary-600 mt-2.5 transition-colors">
                    <HandThumbUpIcon className="w-3.5 h-3.5" /> Helpful
                  </button>
                </div>
              </div>
            </Card>
          ))}
          <button className="w-full py-2.5 rounded-xl border border-neutral-200 text-sm font-semibold text-primary-600 hover:bg-primary-50 transition-colors">
            View all {r.count.toLocaleString("en-IN")} reviews
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Booking summary (non-sticky) ──────────────────────────────────────────────

function BookingSummary({
  hotel,
  selected,
  current,
  onBook,
}: {
  hotel: Hotel;
  selected: boolean;
  current: RatePlan;
  onBook: () => void;
}) {
  return (
    <Card variant="elevated" radius="md" className="p-5 h-fit">
      <div className="flex items-center gap-2 mb-3">
        <ScoreBadge score={hotel.reviewScore} />
        <div>
          <p className="text-sm font-bold text-neutral-800">{hotel.reviewLabel}</p>
          <p className="text-xs text-neutral-500">{hotel.reviewCount.toLocaleString("en-IN")} reviews</p>
        </div>
      </div>
      <div className="border-t border-neutral-100 pt-3">
        <p className="text-xs text-neutral-400">{selected ? "Selected room from" : "Starting from"}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-neutral-400 line-through">{money(current.originalPrice)}</span>
          <span className="text-2xl font-bold text-neutral-900">{money(current.price)}</span>
        </div>
        <p className="text-[11px] text-neutral-400">+ {money(current.taxes)} taxes & fees · per night</p>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <CalendarDaysIcon className="w-4 h-4 text-primary-500" /> Thu, 22 Feb — Fri, 23 Feb
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <UserGroupIcon className="w-4 h-4 text-primary-500" /> 1 Room, 2 Adults
        </div>
      </div>
      <button
        onClick={onBook}
        className="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold py-3 transition-colors"
      >
        {selected ? "Book Now" : "Select Room"}
        <ArrowRightIcon className="w-4 h-4" />
      </button>
      {current.refundable && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 mt-2.5">
          <ShieldCheckIcon className="w-3.5 h-3.5" /> Free cancellation available
        </p>
      )}
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HotelDetailClient({ hotel }: { hotel: Hotel }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [active, setActive] = useState("overview");
  const [landmarkTab, setLandmarkTab] = useState(0);
  const [selected, setSelected] = useState<{ roomId: string; plan: RatePlan } | null>(null);

  const cheapest = hotel.rooms
    .flatMap((r) => r.ratePlans)
    .reduce((min, p) => (p.price < min.price ? p : min), hotel.rooms[0].ratePlans[0]);
  const current = selected?.plan ?? cheapest;

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) { sectionRefs.current[s.id] = el; obs.observe(el); }
    });
    return () => obs.disconnect();
  }, []);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectRate(roomId: string, plan: RatePlan) {
    setSelected({ roomId, plan });
  }

  return (
    <div className="bg-neutral-50 min-h-screen">
      <SearchBar hotel={hotel} />

      <main className="screen-space py-5">
        {/* Breadcrumb */}
        <nav className="text-xs text-neutral-400 mb-3">
          Home <span className="mx-1">›</span> Hotels <span className="mx-1">›</span> {hotel.city}
          <span className="mx-1">›</span> <span className="text-neutral-600">{hotel.name}</span>
        </nav>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-neutral-900">{hotel.name}</h1>
              <Stars n={hotel.starRating} />
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                {hotel.starRating}-Star Hotel
              </span>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-neutral-500 mt-1.5">
              <MapPinIcon className="w-4 h-4 text-primary-500" />
              {hotel.address}
              <button className="text-primary-600 font-semibold ml-1 hover:underline">View on Map</button>
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {hotel.tags.map((t) => (
                <span key={t} className="text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded-full px-2.5 py-1">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600 border border-neutral-200 rounded-lg px-3 py-2 hover:bg-neutral-50 transition-colors">
              <ShareIcon className="w-4 h-4" /> Share
            </button>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-neutral-600 border border-neutral-200 rounded-lg px-3 py-2 hover:bg-neutral-50 transition-colors">
              <HeartIcon className="w-4 h-4" /> Save
            </button>
          </div>
        </div>

        {/* Top: gallery + booking summary (non-sticky) */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-5">
          <Gallery images={hotel.images} onOpen={setLightbox} />
          <div className="hidden lg:block">
            <BookingSummary hotel={hotel} selected={!!selected} current={current} onBook={() => jump("rooms")} />
          </div>
        </div>

        {/* Content (full width) */}
        <div className="mt-2">
            <SubNav active={active} onJump={jump} />

            {/* Overview */}
            <section id="overview" className="scroll-mt-32 py-6">
              <h2 className="text-lg font-bold text-neutral-800 mb-2">About this property</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">{hotel.about}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {hotel.amenities.map((a) => {
                  const Icon = AMENITY_ICONS[a.icon] ?? SparklesIcon;
                  return (
                    <div key={a.label} className="flex items-center gap-2 text-sm text-neutral-700 bg-white border border-neutral-200 rounded-xl px-3 py-2.5">
                      <Icon className="w-5 h-5 text-primary-500 shrink-0" />
                      {a.label}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Amenities */}
            <section id="amenities" className="scroll-mt-32 py-6 border-t border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Amenities</h2>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                {hotel.allAmenities.map((grp) => (
                  <div key={grp.group}>
                    <p className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-2">{grp.group}</p>
                    <ul className="space-y-1.5">
                      {grp.items.map((it) => (
                        <li key={it} className="flex items-center gap-2 text-sm text-neutral-600">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" /> {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Rooms */}
            <section id="rooms" className="scroll-mt-32 py-6 border-t border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Choose your room</h2>
              <div className="space-y-4">
                {hotel.rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    selectedRate={selected?.roomId === room.id ? selected.plan.id : null}
                    onSelectRate={selectRate}
                  />
                ))}
              </div>
            </section>

            {/* Location */}
            <section id="location" className="scroll-mt-32 py-6 border-t border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Location & Surroundings</h2>
              <div className="grid sm:grid-cols-[1fr_260px] gap-4">
                <div className="relative h-64 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
                  <Image
                    src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&h=500&q=80"
                    alt="Map"
                    fill
                    className="object-cover opacity-90"
                    sizes="60vw"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex flex-col items-center gap-1 bg-white/90 rounded-xl px-4 py-3 shadow">
                      <MapPinIcon className="w-6 h-6 text-primary-600" />
                      <span className="text-xs font-semibold text-neutral-700">{hotel.area}, {hotel.city}</span>
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex gap-1 mb-3 border-b border-neutral-200">
                    {hotel.landmarks.map((l, i) => (
                      <button
                        key={l.category}
                        onClick={() => setLandmarkTab(i)}
                        className={cn(
                          "text-xs font-semibold px-2 py-2 border-b-2 -mb-px transition-colors",
                          landmarkTab === i ? "border-primary-600 text-primary-600" : "border-transparent text-neutral-500"
                        )}
                      >
                        {l.category}
                      </button>
                    ))}
                  </div>
                  <ul className="space-y-2.5">
                    {hotel.landmarks[landmarkTab].items.map((it) => (
                      <li key={it.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1.5 text-neutral-600">
                          <MapPinIcon className="w-3.5 h-3.5 text-neutral-300" /> {it.name}
                        </span>
                        <span className="text-xs font-semibold text-neutral-500 shrink-0">{it.distance}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Property rules */}
            <section className="py-6 border-t border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Property Rules</h2>
              <div className="flex flex-wrap gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-primary-500" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-semibold">Check-in</p>
                    <p className="text-sm font-semibold text-neutral-800">{hotel.rules.checkIn}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-5 h-5 text-primary-500" />
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-400 font-semibold">Check-out</p>
                    <p className="text-sm font-semibold text-neutral-800">{hotel.rules.checkOut}</p>
                  </div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-sm font-bold text-neutral-700 mb-2">Guest Profile</p>
                  <ul className="space-y-1.5">
                    {hotel.rules.guestProfile.map((g) => (
                      <li key={g} className="flex items-start gap-2 text-sm text-neutral-600">
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {g}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-sm font-bold text-neutral-700 mb-2">Must Read</p>
                  <ul className="space-y-1.5">
                    {hotel.rules.mustRead.map((m) => (
                      <li key={m} className="flex items-start gap-2 text-sm text-neutral-600">
                        <span className="text-neutral-300 mt-0.5">•</span> {m}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
        </div>

        {/* Reviews (full width) */}
        <div className="py-6 border-t border-neutral-200 mt-2">
          <Reviews hotel={hotel} />
        </div>

        {/* Similar properties */}
        <section className="py-6 border-t border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-800 mb-4">Similar properties nearby</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {hotel.similar.map((s) => (
              <Card key={s.id} variant="elevated" radius="md" className="overflow-hidden p-px group">
                <div className="relative h-36 overflow-hidden rounded-t-[inherit]">
                  <Image src={s.image} alt={s.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="25vw" />
                  <span className="absolute top-2 left-2"><ScoreBadge score={s.rating} size="sm" /></span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-neutral-800 truncate">{s.name}</p>
                  <p className="flex items-center gap-1 text-[11px] text-neutral-400 mt-0.5">
                    <MapPinIcon className="w-3 h-3" /> {s.location}
                  </p>
                  <div className="flex items-center justify-between mt-2.5">
                    <p className="text-sm font-bold text-neutral-900">{money(s.price)}<span className="text-[11px] font-normal text-neutral-400"> /night</span></p>
                    <span className="text-[11px] font-bold text-primary-600 flex items-center gap-0.5">
                      Book <ArrowRightIcon className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Mobile sticky book bar */}
      <div className="lg:hidden sticky bottom-0 z-30 bg-white border-t border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] text-neutral-400">{selected ? "Selected from" : "Starting from"}</p>
          <p className="text-lg font-bold text-neutral-900 leading-none">{money(current.price)}<span className="text-[11px] font-normal text-neutral-400"> +taxes</span></p>
        </div>
        <button
          onClick={() => jump("rooms")}
          className="flex-1 max-w-[200px] rounded-xl bg-primary-600 text-white text-sm font-bold py-3"
        >
          {selected ? "Book Now" : "Select Room"}
        </button>
      </div>

      {lightbox !== null && (
        <Lightbox
          images={hotel.images}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={(d) => setLightbox((i) => (i === null ? 0 : (i + d + hotel.images.length) % hotel.images.length))}
        />
      )}
    </div>
  );
}
