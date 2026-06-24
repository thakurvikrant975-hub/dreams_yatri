"use client";

import { useState, useTransition } from "react";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import Button from "@/app/components/ui/Button";
import { createDraftProperty } from "./actions";
import type { PropertyCategory, PropertySubType } from "@/app/generated/prisma";

// ── Data ──────────────────────────────────────────────────────────────────────

type CategoryConfig = {
  category: PropertyCategory;
  label: string;
  desc: string;
};

const CATEGORIES: CategoryConfig[] = [
  {
    category: "HOTEL",
    label: "Hotel",
    desc: "Accommodations with facilities like dining venues, meeting rooms & more",
  },
  {
    category: "HOMESTAY_VILLA",
    label: "Homestays & Villas",
    desc: "Large independent homes / bungalows for guests that can be rented entirely or by room",
  },
];

type SubTypeConfig = {
  subType: PropertySubType;
  category: PropertyCategory;
  label: string;
  desc: string;
  image: string;
};

const SUB_TYPES: SubTypeConfig[] = [
  // ── Hotel ────────────────────────────────────────────────────────────────
  {
    subType: "HOTEL",
    category: "HOTEL",
    label: "Hotel",
    desc: "A hotel is a commercial establishment providing lodging with various amenities like dining, room service, and sometimes conference facilities.",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "RESORT",
    category: "HOTEL",
    label: "Resort",
    desc: "A resort is a self-contained property offering luxurious lodging and extensive amenities, such as pools, spas, dining, and recreation.",
    image: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "LODGE",
    category: "HOTEL",
    label: "Lodge",
    desc: "A lodge is a type of accommodation typically located in natural or remote settings, offering rustic or comfortable lodging.",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "GUEST_HOUSE",
    category: "HOTEL",
    label: "Guest House",
    desc: "A guest house is a small, often privately-owned accommodation offering cozy, home-like lodging with personalized service.",
    image: "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "PALACE",
    category: "HOTEL",
    label: "Palace",
    desc: "A palace used as accommodation is a luxurious property, often a converted royal residence, offering opulent rooms and grand architecture.",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "HOUSEBOAT",
    category: "HOTEL",
    label: "Houseboat",
    desc: "Accommodation on a floating structure with bedrooms, a living room, a kitchen, and often a terrace or deck. Typically found in lakes or backwaters.",
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "MOTEL",
    category: "HOTEL",
    label: "Motel",
    desc: "A motel is a budget-friendly accommodation typically located along highways, offering easy access and parking near guest rooms.",
    image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=400&h=220&q=80",
  },

  // ── Homestays & Villas ───────────────────────────────────────────────────
  {
    subType: "VILLA",
    category: "HOMESTAY_VILLA",
    label: "Villa",
    desc: "A spacious, independent property or entire estate for private rental, ideal for families or groups.",
    image: "https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "HOMESTAY",
    category: "HOMESTAY_VILLA",
    label: "Homestay",
    desc: "A private residence offering rooms or the entire house for guests, where the host may or may not reside on-site.",
    image: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "COTTAGE",
    category: "HOMESTAY_VILLA",
    label: "Cottage",
    desc: "A charming, private standalone house, typically found in leisure destinations, offering a cozy and intimate stay.",
    image: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "APARTMENT",
    category: "HOMESTAY_VILLA",
    label: "Apartment",
    desc: "A private flat or group of connected rooms (e.g. 1BHK, 2BHK) within a building, usually with a kitchen or living area.",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "APART_HOTEL",
    category: "HOMESTAY_VILLA",
    label: "Apart-Hotel",
    desc: "Hotel-like accommodation offering apartment-style units (e.g. studio, 1 bedroom) with hotel services.",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "HOSTEL",
    category: "HOMESTAY_VILLA",
    label: "Hostel",
    desc: "Budget-friendly accommodation with shared dormitory beds or private rooms, featuring communal spaces like kitchens and lounges.",
    image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "BED_AND_BREAKFAST",
    category: "HOMESTAY_VILLA",
    label: "Bed & Breakfast",
    desc: "A private home offering overnight lodging in rooms and serving breakfast, often run by resident hosts.",
    image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "FARMHOUSE",
    category: "HOMESTAY_VILLA",
    label: "Farmhouse",
    desc: "A large, independent property located in a rural setting, offering expansive private outdoor spaces and scenic views.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "CAMP",
    category: "HOMESTAY_VILLA",
    label: "Camp",
    desc: "Outdoor or temporary accommodations (e.g. tents) in scenic natural locations like mountains, deserts, or beaches.",
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "BEACH_HUT",
    category: "HOMESTAY_VILLA",
    label: "Beach Hut",
    desc: "A rustic cabin or small structure, often made of wood, situated near a beach with ocean views.",
    image: "https://images.unsplash.com/photo-1439130490301-25e322d88054?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "TREEHOUSE",
    category: "HOMESTAY_VILLA",
    label: "Treehouse",
    desc: "Unique accommodation built among trees, with the living area elevated above ground level, typically made of natural materials.",
    image: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "DHARAMSHALA",
    category: "HOMESTAY_VILLA",
    label: "Dharamshala",
    desc: "A charitable rest house or lodging primarily for pilgrims, offering simple and affordable accommodation.",
    image: "https://images.unsplash.com/photo-1585468274952-66591eb14165?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "ASHRAM",
    category: "HOMESTAY_VILLA",
    label: "Ashram",
    desc: "A spiritual retreat or sanctuary offering simple lodging for individuals seeking meditation, yoga, or religious activities.",
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "HOLIDAY_HOME",
    category: "HOMESTAY_VILLA",
    label: "Holiday Home",
    desc: "An independent house or bungalow available for short-term rental by guests, perfect for leisure vacations.",
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "RV",
    category: "HOMESTAY_VILLA",
    label: "RV (Recreational Vehicle)",
    desc: "A recreational vehicle (e.g. caravan, campervan) available for stay, equipped with basic living amenities.",
    image: "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=400&h=220&q=80",
  },
  {
    subType: "LUXURY_CAMPS",
    category: "HOMESTAY_VILLA",
    label: "Luxury Camps",
    desc: "High-end outdoor accommodations featuring large, well-appointed tents with premium amenities, beds, and private facilities.",
    image: "https://images.unsplash.com/photo-1537225228614-56cc3556d7ed?auto=format&fit=crop&w=400&h=220&q=80",
  },
];

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({
  config,
  selected,
  onClick,
}: {
  config: CategoryConfig;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex-1 text-left rounded-xl border-2 px-5 py-4 transition-all",
        selected
          ? "border-primary-500 bg-primary-50/60 shadow-sm"
          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
      )}
    >
      <p className={cn("text-sm font-semibold mb-1", selected ? "text-primary-700" : "text-neutral-800")}>
        {config.label}
      </p>
      <p className="text-[11px] text-neutral-500 leading-snug">{config.desc}</p>
      <div className={cn(
        "absolute top-3 right-3 size-5 rounded-full border-2 flex items-center justify-center transition-colors",
        selected ? "border-primary-500" : "border-neutral-300"
      )}>
        {selected && <div className="size-2.5 rounded-full bg-primary-500" />}
      </div>
    </button>
  );
}

// ── Sub-type card (image style) ───────────────────────────────────────────────

function SubTypeCard({
  config,
  selected,
  disabled,
  onClick,
}: {
  config: SubTypeConfig;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative text-left rounded-xl border-2 overflow-hidden transition-all cursor-pointer select-none bg-white",
        selected
          ? "border-primary-500 shadow-md"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {/* Radio indicator */}
      <div className={cn(
        "absolute top-2.5 right-2.5 z-10 size-5 rounded-full border-2 bg-white flex items-center justify-center transition-colors",
        selected ? "border-primary-500" : "border-neutral-300"
      )}>
        {selected && <div className="size-2.5 rounded-full bg-primary-500" />}
      </div>

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.image}
        alt={config.label}
        className="w-full h-36 object-cover"
        loading="lazy"
      />

      {/* Content */}
      <div className="p-3">
        <p className={cn("text-sm font-semibold mb-1 leading-snug", selected ? "text-primary-700" : "text-neutral-800")}>
          {config.label}
        </p>
        <p className="text-[11px] text-neutral-500 leading-snug line-clamp-3">{config.desc}</p>
      </div>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PropertyTypeSelector() {
  const [category, setCategory] = useState<PropertyCategory>("HOTEL");
  const [selected, setSelected] = useState<PropertySubType | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleTypes = SUB_TYPES.filter((t) => t.category === category);

  function handleCategoryChange(cat: PropertyCategory) {
    setCategory(cat);
    setSelected(null);
  }

  function handleContinue() {
    if (!selected) return;
    startTransition(async () => {
      await createDraftProperty(selected);
    });
  }

  return (
    <div className="space-y-6">
      {/* Category selector */}
      <div className="flex gap-4">
        {CATEGORIES.map((cat) => (
          <CategoryCard
            key={cat.category}
            config={cat}
            selected={category === cat.category}
            onClick={() => handleCategoryChange(cat.category)}
          />
        ))}
      </div>

      {/* Sub-type grid */}
      <div>
        <p className="text-base font-bold text-neutral-800 mb-4">
          Type of {category === "HOTEL" ? "Hotel" : "Homestays & Villas"}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleTypes.map((config) => (
            <SubTypeCard
              key={config.subType}
              config={config}
              selected={selected === config.subType}
              disabled={isPending}
              onClick={() => setSelected(config.subType)}
            />
          ))}
        </div>
      </div>

      {/* Continue */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleContinue}
          disabled={!selected || isPending}
          className="h-11 px-8 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white gap-2"
        >
          {isPending ? (
            <>
              <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Creating your listing…
            </>
          ) : (
            <>
              Continue
              <ArrowRight size={15} weight="bold" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
