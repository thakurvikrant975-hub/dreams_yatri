"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
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
  ShieldCheckIcon,
  SparklesIcon,
  ClockIcon,
  ArrowRightIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid, UserGroupIcon, } from "@heroicons/react/24/solid";
import { PencilRulerIcon, BedIcon, EyeIcon, BathtubIcon } from "@phosphor-icons/react";
import type { BedroomLayout } from "./dummy";

import type { Hotel, Room, RatePlan } from "./dummy";
import { toggleWishlist } from "./wishlist-actions";
import { useModal } from "@/app/hooks/useModals";
import Button from "@/app/components/ui/Button";
import DatePickerField from "@/app/components/ui/DatePickerField";
import TravellersField, { type TravellersValue } from "@/app/components/ui/TravellersField";
import LocationSearchSelect, { type LocationValue } from "@/app/components/ui/LocationSearchSelect";
import type { LocationType } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { AMENITY_ICONS } from "./amenity-icons";
import AmenitiesModal from "./AmenitiesModal";

const HotelLocationMap = dynamic(() => import("./HotelLocationMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-neutral-100" />,
});

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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

// ── Search filter bar (below header, styled like PackagesSearchBar) ──────────

function FieldLabel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span id={id} className="pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
      {children}
    </span>
  );
}

function toDate(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function SearchBar({ hotel, checkIn, checkOut }: { hotel: Hotel; checkIn: string; checkOut: string }) {
  const router = useRouter();
  const [ci, setCi] = useState<Date | null>(toDate(checkIn));
  const [co, setCo] = useState<Date | null>(toDate(checkOut));
  const [guests, setGuests] = useState<TravellersValue>({ adults: 2, childrenAges: [] });
  const [city, setCity] = useState<LocationValue | null>(
    hotel.city ? { id: hotel.city, name: hotel.city, type: "CITY" as LocationType, breadcrumb: hotel.city, slug: "" } : null,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function search() {
    const inD = ci ?? today;
    const outD = co && co > inD ? co : new Date(inD.getTime() + 86_400_000);
    const qs = `in=${toISO(inD)}&out=${toISO(outD)}`;

    // A different city than this hotel's own — jump to the listing page filtered
    // by that city instead of trying to show it on this hotel's URL.
    if (city && city.name && city.name !== hotel.city) {
      router.push(`/hotels?city=${encodeURIComponent(city.name)}&${qs}`);
      return;
    }
    router.push(`/hotels/${hotel.slug}?${qs}`);
  }

  return (
    <div className="bg-neutral-900">
      <div className="screen-space py-3">
        <form
          role="search"
          aria-label="Update stay search"
          onSubmit={(e) => { e.preventDefault(); search(); }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-2.5 items-end">
            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-city">
              <FieldLabel id="label-city">City</FieldLabel>
              <LocationSearchSelect value={city} onChange={setCity} placeholder="Where are you going?" showCurrentLocation />
            </div>

            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-in">
              <FieldLabel id="label-in">Check-in</FieldLabel>
              <DatePickerField value={ci} onChange={(d) => { setCi(d); if (d && co && co <= d) setCo(null); }} minDate={today} placeholder="Add date" />
            </div>

            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-out">
              <FieldLabel id="label-out">Check-out</FieldLabel>
              <DatePickerField value={co} onChange={setCo} minDate={ci ? new Date(ci.getTime() + 86_400_000) : today} placeholder="Add date" />
            </div>

            <div className="flex flex-col gap-1" role="group" aria-labelledby="label-guests">
              <FieldLabel id="label-guests">Guests</FieldLabel>
              <TravellersField value={guests} onChange={setGuests} />
            </div>

            <div className="flex flex-col gap-1">
              <span className="hidden lg:block text-[10px] leading-3.5" aria-hidden="true">&nbsp;</span>
              <Button
                type="submit"
                variant="premium"
                className="h-10.5 w-full lg:w-auto rounded-lg px-7 font-bold flex items-center justify-center gap-2"
              >
                <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
                Update Search
              </Button>
            </div>
          </div>
        </form>
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

// ── Homestay: property info strip + bedroom layout (MMT/Goibibo-style) ───────

function HomestayInfoStrip({ homestay }: { homestay: NonNullable<Hotel["homestay"]> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 mb-4">
      <div className="flex items-center gap-4 text-sm text-neutral-700">
        <span className="flex items-center gap-1.5">
          <BedIcon className="size-5 text-neutral-400" />
          {homestay.bedroomCount} Bedroom{homestay.bedroomCount === 1 ? "" : "s"}
        </span>
        {homestay.bathroomCount > 0 && (
          <span className="flex items-center gap-1.5">
            <BathtubIcon className="size-5 text-neutral-400" />
            {homestay.bathroomCount} Bathroom{homestay.bathroomCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-right">
        <UserCircleIcon className="w-5 h-5 text-neutral-400 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-neutral-800 leading-tight">{homestay.managedBy}</p>
          <p className="text-[11px] text-neutral-400 leading-tight">{homestay.managedByNote}</p>
        </div>
      </div>
    </div>
  );
}

function BedroomCard({ bedroom, fallbackImage }: { bedroom: BedroomLayout; fallbackImage: string }) {
  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <div className="relative h-32 overflow-hidden rounded-t-[inherit]">
        <Image src={fallbackImage} alt={bedroom.name} fill className="object-cover" sizes="(max-width:640px) 100vw, 25vw" />
      </div>
      <div className="p-3">
        <p className="text-sm font-bold text-neutral-800">{bedroom.name}</p>
        <div className="mt-1.5 space-y-1 text-xs text-neutral-600">
          <p className="flex items-center gap-1.5"><BedIcon className="size-4 text-neutral-400 shrink-0" /> {bedroom.bed}</p>
          {bedroom.view && <p className="flex items-center gap-1.5"><EyeIcon className="size-4 text-neutral-400 shrink-0" /> {bedroom.view} View</p>}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {bedroom.attachedBathroom && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <BathtubIcon className="size-3" /> Attached Bathroom
            </span>
          )}
          {bedroom.size && (
            <span className="text-[10px] font-medium text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-2 py-0.5">
              {bedroom.size}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function PropertyLayoutSection({ homestay, fallbackImage }: { homestay: NonNullable<Hotel["homestay"]>; fallbackImage: string }) {
  if (homestay.layout.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold text-neutral-800">Property Layout</h3>
      <p className="text-xs text-neutral-400 mb-3">Room Options ({homestay.layout.length})</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {homestay.layout.map((b, i) => (
          <BedroomCard key={`${b.name}-${i}`} bedroom={b} fallbackImage={fallbackImage} />
        ))}
      </div>
    </div>
  );
}

// ── Room card + rate rows ─────────────────────────────────────────────────────

function RoomImageCarousel({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  const multi = images.length > 1;
  return (
    <div className="relative h-44 rounded-xl overflow-hidden group">
      <Image src={images[i]} alt={name} fill className="object-cover" sizes="(max-width:640px) 100vw, 33vw" />
      {multi && (
        <>
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
        </>
      )}
      <span className="absolute top-2 left-2 text-[10px] font-semibold text-white bg-black/55 rounded-full px-2 py-0.5 backdrop-blur-[1px]">
        {images.length} Photo{images.length === 1 ? "" : "s"}
      </span>
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
          <h3 className="text-lg font-bold text-neutral-900 mt-3 leading-snug">{room.name}</h3>
          <span className="inline-flex items-center gap-1.5 mt-0.5 text-[11px] font-medium text-neutral-600/90">
             {room.occupancy}
          </span>
          {room.roomsLeft != null && room.roomsLeft <= 5 && (
            <p className="mt-1 text-xs font-bold text-red-600">
              Only {room.roomsLeft} room{room.roomsLeft === 1 ? "" : "s"} left at this price!
            </p>
          )}
          <div className="mt-2 space-y-1 text-sm text-neutral-600">
            {room.size && <p className="flex gap-3 items-center font-medium"><PencilRulerIcon className="size-5 text-neutral-400" /> {room.size}</p>}
            {room.bed && <p className="flex gap-3 items-center font-medium"><BedIcon className="size-5 text-neutral-400" /> {room.bed}</p>}
            {room.view && <p className="flex gap-3 items-center font-medium"><EyeIcon className="size-5 text-neutral-400" /> {room.view}</p>}
          </div>
          {room.amenities.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {room.amenities.slice(0, 6).map((a) => (
                <span key={a} className="text-[10px] text-neutral-600 bg-white border border-neutral-200 rounded-full px-2 py-0.5">
                  {a}
                </span>
              ))}
              {room.amenities.length > 6 && (
                <span className="text-[10px] font-semibold text-primary-600">+{room.amenities.length - 6} more</span>
              )}
            </div>
          )}
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

  if (r.count === 0) {
    return (
      <section id="reviews" className="scroll-mt-32">
        <h2 className="text-lg font-bold text-neutral-800 mb-4">Guest Ratings & Reviews</h2>
        <Card variant="elevated" radius="md" className="p-6 text-center">
          <p className="text-sm font-semibold text-neutral-700">No reviews yet</p>
          <p className="text-xs text-neutral-500 mt-1">Be the first to share how your stay was.</p>
        </Card>
      </section>
    );
  }

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
            {r.distribution.map((d) => (
              <div key={d.stars} className="flex items-center gap-2">
                <span className="text-xs text-neutral-600 w-12 shrink-0">{d.stars} star</span>
                <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-neutral-700 w-8 text-right">{d.pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Review list */}
        <div className="space-y-4">
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
                      <p className="text-[11px] text-neutral-400">{item.date}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white bg-emerald-600 rounded-lg px-1.5 py-0.5 shrink-0">
                      {item.rating.toFixed(1)} <StarSolid className="w-3 h-3" />
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500 leading-relaxed mt-2">{item.text}</p>
                </div>
              </div>
            </Card>
          ))}
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
          {current.originalPrice > current.price && (
            <span className="text-[11px] font-semibold text-emerald-600">
              {Math.round(((current.originalPrice - current.price) / current.originalPrice) * 100)}% off
            </span>
          )}
        </div>
        <span className="text-2xl font-bold text-neutral-900">{money(current.price)}</span>
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

export default function HotelDetailClient({ hotel, checkIn, checkOut, initialSaved = false }: { hotel: Hotel; checkIn: string; checkOut: string; initialSaved?: boolean }) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [active, setActive] = useState("overview");
  const [landmarkTab, setLandmarkTab] = useState(0);
  const [selected, setSelected] = useState<{ roomId: string; plan: RatePlan } | null>(null);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [savePending, setSavePending] = useState(false);
  const { openModal } = useModal();

  async function handleToggleSave() {
    if (savePending) return;
    setSavePending(true);
    const prev = saved;
    setSaved(!prev);
    const result = await toggleWishlist(hotel.id);
    if (!result.ok) {
      setSaved(prev);
      if (result.error) openModal("login-modal", { redirectTo: window.location.pathname + window.location.search });
    } else {
      setSaved(result.wishlisted);
    }
    setSavePending(false);
  }

  const allRates = hotel.rooms.flatMap((r) => r.ratePlans);
  const cheapest: RatePlan = allRates.length
    ? allRates.reduce((min, p) => (p.price < min.price ? p : min))
    : { id: "", mealPlan: "", inclusions: [], cancellation: "", refundable: false, price: 0, originalPrice: 0, taxes: 0 };
  const current = selected?.plan ?? cheapest;
  const totalAmenityCount = hotel.allAmenities.reduce((n, g) => n + g.items.length, 0);
  const hasCoords = hotel.latitude != null && hotel.longitude != null;
  const hasLandmarks = hotel.landmarks.some((l) => l.items.length > 0);

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
    const q = new URLSearchParams({ room: roomId, in: checkIn, out: checkOut, plan: plan.id });
    router.push(`/hotels/${hotel.slug}/book?${q.toString()}`);
  }

  return (
    <div className="bg-neutral-50 min-h-screen">
      <SearchBar hotel={hotel} checkIn={checkIn} checkOut={checkOut} />

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
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <ShareIcon className="w-4 h-4" /> Share
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={handleToggleSave} disabled={savePending}>
              <HeartIcon className={cn("w-4 h-4", saved && "fill-red-500 text-red-500")} /> {saved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>

        {hotel.homestay && <HomestayInfoStrip homestay={hotel.homestay} />}

        {/* Top: gallery + booking summary (non-sticky) */}
        <div >
          <Gallery images={hotel.images} onOpen={setLightbox} />
        </div>

        {/* Content (full width) */}
        <div className="mt-2">
          <SubNav active={active} onJump={jump} />

          {/* Overview */}
          <section id="overview" className="scroll-mt-32 py-6 grid lg:grid-cols-[1fr_320px] gap-5">
            <div>
              <h2 className="text-lg font-bold text-neutral-800 mb-2">About this property</h2>
              <p className="text-sm text-neutral-600 leading-relaxed">{hotel.about}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {hotel.amenities.map((a) => {
                  const Icon = AMENITY_ICONS[a.icon] ?? SparklesIcon;
                  return (
                    <div key={a.label} className="flex items-center gap-2 text-sm text-neutral-700 bg-white border border-neutral-200 rounded-xl px-3 py-2.5">
                      <Icon className="w-5 h-5 text-neutral-400 shrink-0" />
                      {a.label}
                    </div>
                  );
                })}
              </div>
              {hotel.homestay && (
                <PropertyLayoutSection homestay={hotel.homestay} fallbackImage={hotel.images[0]} />
              )}
            </div>
            <div className="hidden lg:block">
              <BookingSummary hotel={hotel} selected={!!selected} current={current} onBook={() => jump("rooms")} />
            </div>

          </section>

          {/* Amenities — compact preview only; the full list lives in the
              "View All" modal instead of being dumped inline, which used to
              leave a long, unbroken wall of checkmarks on every hotel page. */}
          <section id="amenities" className="scroll-mt-32 py-6 border-t border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-800 mb-4">Amenities</h2>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {hotel.amenities.slice(0, 5).map((a) => {
                const Icon = AMENITY_ICONS[a.icon] ?? SparklesIcon;
                return (
                  <span key={a.label} className="flex items-center gap-2 text-sm text-neutral-700">
                    <Icon className="w-5 h-5 text-neutral-400 shrink-0" />
                    {a.label}
                  </span>
                );
              })}
              {totalAmenityCount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmenitiesOpen(true)}
                  className="text-sm font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                >
                  View All Amenities ({totalAmenityCount})
                </button>
              )}
            </div>
          </section>

          <AmenitiesModal
            hotelName={hotel.name}
            groups={hotel.allAmenities}
            open={amenitiesOpen}
            onClose={() => setAmenitiesOpen(false)}
          />

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
            <div className={cn("grid gap-4", hasLandmarks ? "sm:grid-cols-[1fr_260px]" : "sm:grid-cols-1")}>
              <div className="relative isolate h-64 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200">
                {hasCoords ? (
                  <HotelLocationMap
                    latitude={hotel.latitude as number}
                    longitude={hotel.longitude as number}
                    name={hotel.name}
                    address={hotel.address}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex flex-col items-center gap-1 bg-white/90 rounded-xl px-4 py-3 shadow">
                      <MapPinIcon className="w-6 h-6 text-primary-600" />
                      <span className="text-xs font-semibold text-neutral-700">{hotel.area}, {hotel.city}</span>
                    </span>
                  </div>
                )}
                {hasCoords && (
                  <a
                    href={`https://www.google.com/maps?q=${hotel.latitude},${hotel.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 z-[400] flex items-center gap-1 text-xs font-semibold bg-white text-primary-600 rounded-lg px-2.5 py-1.5 shadow hover:bg-primary-50 transition-colors"
                  >
                    <MapPinIcon className="w-3.5 h-3.5" /> Get Directions
                  </a>
                )}
              </div>
              {hasLandmarks && (
                <div>
                  <div className="flex gap-1 mb-3 border-b border-neutral-200">
                    {hotel.landmarks.filter((l) => l.items.length > 0).map((l, i) => (
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
                    {hotel.landmarks.filter((l) => l.items.length > 0)[landmarkTab]?.items.map((it) => (
                      <li key={it.name} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1.5 text-neutral-600">
                          <MapPinIcon className="w-3.5 h-3.5 text-neutral-300" /> {it.name}
                        </span>
                        <span className="text-xs font-semibold text-neutral-500 shrink-0">{it.distance}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
