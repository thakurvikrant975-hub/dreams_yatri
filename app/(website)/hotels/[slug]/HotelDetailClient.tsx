"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/Card";
import {
  HeartIcon,
  ShareIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ArrowRightIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarSolid, UserGroupIcon, } from "@heroicons/react/24/solid";
import { PencilRulerIcon, BedIcon, EyeIcon, BathtubIcon, ImagesIcon, StarIcon,
  MapPinIcon, PawPrintIcon, WheelchairIcon, BabyIcon,
  HeartIcon as HeartIconPh, ChatCircleDotsIcon, ForkKnifeIcon, } from "@phosphor-icons/react";
import type { BedroomLayout } from "./dummy";

import type { Hotel, Room, RatePlan } from "./dummy";
import { toggleWishlist } from "./wishlist-actions";
import HotelChatModal from "./HotelChatModal";
import { useModal } from "@/app/hooks/useModals";
import Button from "@/app/components/ui/Button";
import DatePickerField from "@/app/components/ui/DatePickerField";
import RoomsGuestsField from "@/app/components/ui/RoomsGuestsField";
import { writeRoomGuests, summarizeRoomGuests, type RoomGuests } from "@/app/lib/packages/roomGuests";
import LocationSearchSelect, { type LocationValue } from "@/app/components/ui/LocationSearchSelect";
import type { LocationType } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import { AMENITY_ICONS } from "./amenity-icons";
import AmenitiesModal from "./AmenitiesModal";
import RoomDetailsModal from "./RoomDetailsModal";
import ReviewsSection from "./ReviewsSection";
import LocationSurroundings from "./LocationSurroundings";


const FullGallery = dynamic(() => import("@/app/components/gallery/FullGallery"));

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** "Thu, 22 Feb — Fri, 23 Feb" from the stay's own ISO dates. */
function formatStay(checkIn: string, checkOut: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };
  const from = fmt(checkIn);
  const to = fmt(checkOut);
  return from && to ? `${from} — ${to}` : from || to;
}

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

// ── Property Rules trust badges ───────────────────────────────────────────────

const POLICY_BADGE_ICON: Record<string, typeof HeartIconPh> = {
  heart: HeartIconPh,
  paw: PawPrintIcon,
  wheelchair: WheelchairIcon,
  baby: BabyIcon,
};

function PolicyBadge({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  const Icon = POLICY_BADGE_ICON[icon] ?? HeartIconPh;
  return (
    <div className="flex flex-col items-center gap-1.5 w-20 text-center shrink-0">
      <div
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-md ring-4",
          active
            ? "bg-linear-to-br from-primary-400 to-primary-600 text-white ring-primary-50"
            : "bg-linear-to-br from-neutral-300 to-neutral-400 text-white ring-neutral-100"
        )}
      >
        <Icon weight="fill" className="w-6 h-6" />
      </div>
      <span className={cn("text-[11px] font-semibold leading-tight", active ? "text-neutral-700" : "text-neutral-400")}>
        {label}
      </span>
    </div>
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

function SearchBar({
  hotel, checkIn, checkOut, roomGuests: initialRoomGuests,
}: {
  hotel: Hotel;
  checkIn: string;
  checkOut: string;
  roomGuests: RoomGuests[];
}) {
  const router = useRouter();
  const [ci, setCi] = useState<Date | null>(toDate(checkIn));
  const [co, setCo] = useState<Date | null>(toDate(checkOut));
  const [roomGuests, setRoomGuests] = useState<RoomGuests[]>(initialRoomGuests);
  const [city, setCity] = useState<LocationValue | null>(
    hotel.city ? { id: hotel.city, name: hotel.city, type: "CITY" as LocationType, breadcrumb: hotel.city, slug: "" } : null,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function search() {
    const inD = ci ?? today;
    const outD = co && co > inD ? co : new Date(inD.getTime() + 86_400_000);

    // The guest selection used to be dropped here entirely — only the dates
    // made it into the URL, so changing the party size and pressing Search
    // silently discarded it.
    const params = new URLSearchParams({ in: toISO(inD), out: toISO(outD) });
    writeRoomGuests(params, roomGuests);

    // A different city than this hotel's own — jump to the listing page filtered
    // by that city instead of trying to show it on this hotel's URL.
    if (city && city.name && city.name !== hotel.city) {
      params.set("city", city.name);
      if (city.id) params.set("locId", city.id);
      if (city.type) params.set("locType", city.type);
      router.push(`/hotels?${params.toString()}`);
      return;
    }
    router.push(`/hotels/${hotel.slug}?${params.toString()}`);
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
              <FieldLabel id="label-guests">Rooms &amp; Guests</FieldLabel>
              <RoomsGuestsField value={roomGuests} onChange={setRoomGuests} />
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

function Gallery({ images, onOpen }: { images: string[]; onOpen: () => void }) {
  const gridImages = images.slice(1, 5);
  return (
    <>
      {/* Mobile: stacked hero + 2x2 square grid, each tile keeps its own aspect ratio */}
      <div className="md:hidden flex flex-col gap-2">
        <button onClick={onOpen} className="relative w-full aspect-4/3 rounded-2xl overflow-hidden group">
          <Image src={images[0]} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="100vw" priority />
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold">
            <ImagesIcon weight="duotone" className="size-5" /> View Gallery
          </span>
        </button>
        <div className="grid grid-cols-2 gap-2">
          {gridImages.map((src, i) => (
            <button key={i} onClick={onOpen} className="relative aspect-square rounded-xl overflow-hidden group">
              <Image src={src} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="50vw" />
              {i === 3 && images.length > 5 && (
                <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-sm font-semibold backdrop-blur-[1px]">
                  +{images.length - 5} Photos
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: fixed-height 4-col/2-row grid */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[420px] rounded-2xl overflow-hidden">
        <button
          onClick={onOpen}
          className="relative col-span-2 row-span-2 group overflow-hidden"
        >
          <Image src={images[0]} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="50vw" />
          <span className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            <ImagesIcon weight="duotone" className="size-5" /> View Gallery
          </span>
        </button>
        {gridImages.map((src, i) => (
          <button key={i} onClick={onOpen} className="relative group overflow-hidden">
            <Image src={src} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="25vw" />
            {i === 3 && images.length > 5 && (
              <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-sm font-semibold backdrop-blur-[1px]">
                +{images.length - 5} Photos
              </span>
            )}
          </button>
        ))}
      </div>
    </>
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
  // A discount is only shown when the property set a real pre-discount rate
  // that is genuinely higher than what we're charging.
  const hasDiscount = plan.originalPrice != null && plan.originalPrice > plan.price;
  const off = hasDiscount
    ? Math.round(((plan.originalPrice! - plan.price) / plan.originalPrice!) * 100)
    : 0;
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
          {hasDiscount && (
            <div className="flex items-center gap-1.5 sm:justify-end">
              <span className="text-xs text-neutral-400 line-through">{money(plan.originalPrice!)}</span>
              <span className="text-[11px] font-semibold text-emerald-600">{off}% off</span>
            </div>
          )}
          <p className="text-xl font-bold text-neutral-900 leading-tight">{money(plan.price)}</p>
          <p className="text-[11px] text-neutral-400">+ {money(plan.taxes)} taxes & fees / night</p>
        </div>
        <Button
          onClick={onSelect}
          variant={selected ? "primary" : "outline"}
        >
          {selected ? "SELECTED" : "SELECT ROOM"}
        </Button>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  selectedRate,
  onSelectRate,
  onViewDetails,
}: {
  room: Room;
  selectedRate: string | null;
  onSelectRate: (roomId: string, plan: RatePlan) => void;
  onViewDetails: () => void;
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
            <p className="mt-1 text-xs font-bold text-red-500">
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
          <button
            type="button"
            onClick={onViewDetails}
            className="mt-2.5 text-xs font-semibold text-primary-600 hover:underline"
          >
            More Details
          </button>
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

// ── Booking summary (non-sticky) ──────────────────────────────────────────────

function BookingSummary({
  hotel,
  selected,
  current,
  hasRates,
  room,
  checkIn,
  checkOut,
  guestsLabel,
  onBook,
  onSeeAllRooms,
}: {
  hotel: Hotel;
  selected: boolean;
  current: RatePlan;
  hasRates: boolean;
  /** The room being quoted — the guest's pick, else our recommendation. */
  room: Room | null;
  checkIn: string;
  checkOut: string;
  guestsLabel: string;
  /** Goes straight to checkout for `room` + `current`. */
  onBook: () => void;
  onSeeAllRooms: () => void;
}) {
  return (
    <Card variant="elevated" radius="md" className="p-5 h-fit">
      {/* An unreviewed property showed a green "0.0" badge, which reads as a
          terrible score rather than an absent one. Until it has ratings, lead
          with the star tier — a fact we do hold — and drop the numeric badge. */}
      <div className="flex items-center gap-2 mb-3">
        {hotel.reviewCount > 0 ? (
          <>
            <ScoreBadge score={hotel.reviewScore} />
            <div>
              <p className="text-sm font-bold text-neutral-800">{hotel.reviewLabel}</p>
              <p className="text-xs text-neutral-500">{hotel.reviewCount.toLocaleString("en-IN")} reviews</p>
            </div>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-0.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-sm font-bold text-amber-700">
              {hotel.starRating}
              <StarIcon size={13} weight="fill" className="text-amber-500" />
            </span>
            <div>
              <p className="text-sm font-bold text-neutral-800">{hotel.starRating}-star property</p>
              <p className="text-xs text-neutral-500">Be the first to review</p>
            </div>
          </>
        )}
      </div>
      {/* The room being quoted. The card used to show a price with no
          indication of what it bought, then disable its own button until the
          guest scrolled down and picked a room — so the primary action on the
          page was dead on arrival. It now stands behind a specific room and
          books it directly. */}
      {room && hasRates && (
        <div className="border-t border-neutral-100 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-600">
            {selected ? "Your selection" : "Recommended for you"}
          </p>
          <p className="text-sm font-bold text-neutral-800 mt-1">{room.name}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {[room.occupancy, room.bed, room.size].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-1 mt-2">
            {current.mealPlan && (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                {current.mealPlan}
              </span>
            )}
            {room.roomsLeft != null && room.roomsLeft > 0 && room.roomsLeft <= 3 && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                Only {room.roomsLeft} left
              </span>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-neutral-100 pt-3 mt-3">
        {hasRates ? (
          <>
            <p className="text-xs text-neutral-400">{selected ? "Selected room from" : "Starting from"}</p>
            {current.originalPrice != null && current.originalPrice > current.price && (
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-neutral-400 line-through">{money(current.originalPrice)}</span>
                <span className="text-[11px] font-semibold text-emerald-600">
                  {Math.round(((current.originalPrice - current.price) / current.originalPrice) * 100)}% off
                </span>
              </div>
            )}
            <span className="text-2xl font-bold text-neutral-900">{money(current.price)}</span>
            <p className="text-[11px] text-neutral-400">+ {money(current.taxes)} taxes & fees · per night</p>
          </>
        ) : (
          <p className="text-sm text-neutral-400 py-1">Price on request</p>
        )}
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <CalendarDaysIcon className="w-4 h-4 text-primary-500" /> {formatStay(checkIn, checkOut)}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-600">
          <UserGroupIcon className="w-4 h-4 text-primary-500" /> {guestsLabel}
        </div>
      </div>
      <Button
        onClick={onBook}
        variant="primary"
        className={cn("mt-4 w-full disabled:opacity-60 disabled:*:cursor-not-allowed disabled:pointer-events-none")}
        disabled={!hasRates || !room}
      >
        Book This Room
        <ArrowRightIcon className="w-4 h-4" />
      </Button>
      {hotel.rooms.length > 1 && (
        <button
          onClick={onSeeAllRooms}
          className="mt-2 w-full text-[11px] font-semibold text-primary-600 hover:underline"
        >
          See all {hotel.rooms.length} room types
        </button>
      )}
      {current.refundable && (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 mt-2.5">
          <ShieldCheckIcon className="w-3.5 h-3.5" /> Free cancellation available
        </p>
      )}
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function HotelDetailClient({ hotel, checkIn, checkOut, roomGuests, initialSaved = false, chatBookingId = null }: { hotel: Hotel; checkIn: string; checkOut: string; roomGuests: RoomGuests[]; initialSaved?: boolean; chatBookingId?: string | null }) {
  const router = useRouter();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [active, setActive] = useState("overview");
  const [selected, setSelected] = useState<{ roomId: string; plan: RatePlan } | null>(null);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);
  const [detailsRoom, setDetailsRoom] = useState<Room | null>(null);
  const [saved, setSaved] = useState(initialSaved);
  const [savePending, setSavePending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { openModal } = useModal();

  const ruleGroups = [...hotel.policies.sections, ...hotel.policies.importantInfo];

  async function handleToggleSave() {
    if (savePending) return;
    setSavePending(true);
    const prev = saved;
    setSaved(!prev);
    const result = await toggleWishlist(hotel.id);
    if (!result.ok) {
      setSaved(prev);
      if (result.error) {
        openModal("login-modal", {
          redirectTo: window.location.pathname + window.location.search,
          // Re-attempt the save once logged in — otherwise the heart just
          // reverts and the OTP step looks like it did nothing.
          onSuccess: () => { handleToggleSave(); },
        });
      }
    } else {
      setSaved(result.wishlisted);
    }
    setSavePending(false);
  }

  const allRates = hotel.rooms.flatMap((r) => r.ratePlans);
  const hasRates = allRates.length > 0;

  /**
   * The room the summary card recommends: the cheapest bookable rate plan,
   * paired with the room it belongs to. Tracking the pair rather than a bare
   * plan is what lets the card name the room and book it in one click — the
   * booking route needs a room id, which a lone RatePlan doesn't carry.
   * Availability wins over price: a sold-out room is not a recommendation.
   */
  const recommended = hotel.rooms
    .flatMap((room) => room.ratePlans.map((plan) => ({ room, plan })))
    .sort((a, b) => {
      const aOut = a.room.roomsLeft === 0 ? 1 : 0;
      const bOut = b.room.roomsLeft === 0 ? 1 : 0;
      if (aOut !== bOut) return aOut - bOut;
      return a.plan.price - b.plan.price;
    })[0] ?? null;

  const cheapest: RatePlan = recommended?.plan ?? {
    id: "", mealPlan: "", inclusions: [], cancellation: "", refundable: false,
    price: 0, originalPrice: null, taxes: 0,
  };
  const current = selected?.plan ?? cheapest;
  // Once a guest picks a room the card follows their choice; until then it
  // stands behind its own recommendation.
  const activeRoom = selected
    ? hotel.rooms.find((r) => r.id === selected.roomId) ?? recommended?.room ?? null
    : recommended?.room ?? null;
  const totalAmenityCount = hotel.allAmenities.reduce((n, g) => n + g.items.length, 0);

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
      <SearchBar hotel={hotel} checkIn={checkIn} checkOut={checkOut} roomGuests={roomGuests} />

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
            {chatBookingId && (
              <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => setChatOpen(true)}>
                <ChatCircleDotsIcon className="w-4 h-4" /> Message Host
              </Button>
            )}
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
          <Gallery images={hotel.images} onOpen={() => setGalleryOpen(true)} />
        </div>

        {/* Content (full width) */}
        <div className="mt-2">
          <SubNav active={active} onJump={jump} />

          {/* Overview */}
          <section id="overview" className="scroll-mt-32 py-6 grid lg:grid-cols-[1fr_380px] gap-5">
            <div>
              <div>
                <h2 className="text-lg font-bold text-neutral-800 mb-2">About this property</h2>
                <p className="text-sm text-neutral-600 leading-relaxed mb-2">{hotel.about}</p>
    
                {hotel.homestay && (
                  <PropertyLayoutSection homestay={hotel.homestay} fallbackImage={hotel.images[0]} />
                )}
              </div>
              <div id="amenities" className="scroll-mt-32 py-6 border-t border-neutral-200">
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
                      className="text-sm font-semibold text-primary-500 hover:text-primary-600 hover:underline"
                    >
                      View All Amenities ({totalAmenityCount})
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <BookingSummary
                hotel={hotel}
                selected={!!selected}
                current={current}
                hasRates={hasRates}
                room={activeRoom}
                checkIn={checkIn}
                checkOut={checkOut}
                // Now that the picker round-trips through the URL, echo the
                // guest's actual selection back instead of a fixed string.
                guestsLabel={summarizeRoomGuests(roomGuests)}
                onBook={() => activeRoom && selectRate(activeRoom.id, current)}
                onSeeAllRooms={() => jump("rooms")}
              />
            </div>

          </section>

          {/* Amenities — compact preview only; the full list lives in the
              "View All" modal instead of being dumped inline, which used to
              leave a long, unbroken wall of checkmarks on every hotel page. */}


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
                  onViewDetails={() => setDetailsRoom(room)}
                />
              ))}
            </div>
          </section>

          <RoomDetailsModal
            room={detailsRoom}
            open={!!detailsRoom}
            onClose={() => setDetailsRoom(null)}
          />

          {/* Location */}
          <section id="location" className="scroll-mt-32 py-6 border-t border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-800 mb-4">Location & Surroundings</h2>
            <LocationSurroundings
              name={hotel.name}
              address={hotel.address}
              city={hotel.city}
              latitude={hotel.latitude}
              longitude={hotel.longitude}
              approximate={hotel.approximateLocation}
              landmarks={hotel.landmarks}
            />
          </section>

          {/* Property Rules — MMT-style header, all rules shown inline (no popup) */}
          <section className="py-6 border-t border-neutral-200">
            <Card variant="elevated" radius="md" className="p-5">
              <h2 className="text-lg font-bold text-neutral-800">Property Rules</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-600 mt-1 mb-4">
                <span><span className="font-semibold text-neutral-800">Check-in:</span> {hotel.policies.checkIn}</span>
                <span><span className="font-semibold text-neutral-800">Check-out:</span> {hotel.policies.checkOut}</span>
              </div>

              {hotel.policies.badges && hotel.policies.badges.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-3 pt-4 border-t border-neutral-100">
                  {hotel.policies.badges.map((b) => (
                    <PolicyBadge key={b.label} icon={b.icon} label={b.label} active={b.active} />
                  ))}
                </div>
              )}

              {(hotel.policies.couplesRule || hotel.policies.minAgeRule) && (
                <div className="pt-4 border-t border-neutral-100">
                  {hotel.policies.couplesRule && (
                    <p className="text-sm text-neutral-600 border border-neutral-200 rounded-xl px-3 py-2 max-w-md mb-3">{hotel.policies.couplesRule}</p>
                  )}
                  {hotel.policies.minAgeRule && (
                    <p className="flex items-start gap-2 text-sm text-neutral-600">
                      <span className="w-1.5 h-1.5 rounded-full border border-neutral-400 shrink-0 mt-1.5" /> {hotel.policies.minAgeRule}
                    </p>
                  )}
                </div>
              )}

              {ruleGroups.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mt-5 pt-4 border-t border-neutral-100">
                  {ruleGroups.map((g) => (
                    <div key={g.title}>
                      <p className="text-sm font-bold text-neutral-700 mb-2">{g.title}</p>
                      <ul className="space-y-1.5">
                        {g.items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-neutral-600">
                            <span className="w-1.5 h-1.5 rounded-full border border-neutral-400 shrink-0 mt-1.5" /> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>

        {/* Reviews (full width) */}
        <div className="py-6 border-t border-neutral-200 mt-2">
          <ReviewsSection hotel={hotel} />
        </div>

        {/* Similar properties — omitted entirely when there are no real
            alternatives, rather than leaving a heading over an empty grid. */}
        {hotel.similar.length > 0 && (
          <section className="py-6 border-t border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-800 mb-4">Similar properties nearby</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {hotel.similar.map((s) => (
                <Link key={s.id} href={`/hotels/${s.slug}`} className="group block">
                  <Card variant="elevated" radius="md" className="overflow-hidden p-px h-full flex flex-col">
                    <div className="relative h-36 overflow-hidden rounded-t-[inherit]">
                      <Image src={s.image} alt={s.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="25vw" />
                      {s.starRating != null && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 text-[11px] font-bold text-white bg-black/55 rounded-full px-2 py-0.5 backdrop-blur-[1px]">
                          {s.starRating} <StarIcon size={10} weight="fill" className="text-amber-400" />
                        </span>
                      )}
                      {s.photoCount > 1 && (
                        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-black/55 rounded-full px-2 py-0.5 backdrop-blur-[1px]">
                          <ImagesIcon size={10} weight="fill" /> {s.photoCount}
                        </span>
                      )}
                    </div>

                    <div className="p-3 flex flex-1 flex-col">
                      <p className="text-sm font-semibold text-neutral-800 truncate">{s.name}</p>
                      <p className="flex items-center gap-1 text-[11px] text-neutral-400 mt-0.5 truncate">
                        <MapPinIcon className="w-3 h-3 shrink-0" />
                        {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                      </p>

                      {(s.starRating != null || s.propertyType) && (
                        <p className="mt-1.5 text-[11px] font-semibold text-neutral-600">
                          {[s.starRating ? `${s.starRating} Star` : null, s.propertyType].filter(Boolean).join(" ")}
                        </p>
                      )}

                      {s.roomName && (
                        <p className="mt-1 text-[11px] text-neutral-500 truncate">
                          {[s.roomName, s.maxOccupancy ? `Sleeps ${s.maxOccupancy}` : null].filter(Boolean).join(" · ")}
                        </p>
                      )}

                      {s.mealPlan && (
                        <span className="mt-1.5 self-start inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                          <ForkKnifeIcon size={9} weight="fill" /> {s.mealPlan}
                        </span>
                      )}

                      {s.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {s.amenities.slice(0, 3).map((a) => (
                            <span key={a} className="text-[9px] text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-1.5 py-0.5">
                              {a}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Pinned to the bottom so prices line up across the row
                          however much detail each property carries above. */}
                      <div className="flex items-end justify-between mt-auto pt-2.5">
                        <div>
                          {s.priceFrom != null ? (
                            <>
                              <p className="text-sm font-bold text-neutral-900 leading-tight">
                                {money(s.priceFrom)}<span className="text-[10px] font-normal text-neutral-400"> /night</span>
                              </p>
                              {s.taxesFrom != null && (
                                <p className="text-[10px] text-neutral-400">+ {money(s.taxesFrom)} taxes</p>
                              )}
                            </>
                          ) : (
                            <p className="text-[11px] text-neutral-400">Price on request</p>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-primary-600 flex items-center gap-0.5 whitespace-nowrap">
                          View <ArrowRightIcon className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Mobile sticky book bar */}
      <div className="lg:hidden sticky bottom-0 z-30 bg-white border-t border-neutral-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {hasRates ? (
            <>
              <p className="text-[11px] text-neutral-400 truncate">
                {activeRoom ? activeRoom.name : selected ? "Selected from" : "Starting from"}
              </p>
              <p className="text-lg font-bold text-neutral-900 leading-none">{money(current.price)}<span className="text-[11px] font-normal text-neutral-400"> +taxes</span></p>
            </>
          ) : (
            <p className="text-sm font-semibold text-neutral-400">Price on request</p>
          )}
        </div>
        <button
          onClick={() => (activeRoom ? selectRate(activeRoom.id, current) : jump("rooms"))}
          disabled={!hasRates}
          className="flex-1 max-w-50 rounded-xl bg-primary-600 text-white text-sm font-bold py-3 disabled:opacity-60"
        >
          {activeRoom ? "Book This Room" : "See Rooms"}
        </button>
      </div>

      {galleryOpen && (
        <FullGallery
          categories={hotel.galleryCategories}
          title={hotel.name}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {chatBookingId && (
        <HotelChatModal open={chatOpen} onClose={() => setChatOpen(false)} bookingId={chatBookingId} />
      )}
    </div>
  );
}
