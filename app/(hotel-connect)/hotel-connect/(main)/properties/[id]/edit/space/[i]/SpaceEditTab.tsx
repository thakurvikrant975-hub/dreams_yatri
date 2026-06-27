"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon, CheckIcon, MinusIcon, PlusIcon, TrashIcon,
  CaretDownIcon, CaretUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import { saveHomestaySpaceDetail, deleteHomestaySpace } from "../../tabs/homestay-rooms-crud-actions";
import { BED_TYPES } from "../../tabs/homestay-rooms-types";
import type { SpaceItem } from "../../tabs/homestay-rooms-types";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { cn } from "@/app/lib/utils";

// ── Space types that include a Sleeping Arrangement step ──────────────────────

const SLEEPING_SPACE_TYPES = new Set(["living_room", "helpers_room", "drivers_room"]);

// Staff-room types use "Accessible to Guests" framing instead of Private/Shared
const STAFF_ROOM_TYPES = new Set(["helpers_room", "drivers_room"]);

// First 6 bed types shown by default; the rest shown via "View more"
const BED_TYPES_DEFAULT_COUNT = 6;

// ── Amenity structure ─────────────────────────────────────────────────────────

type AmenityDetail =
  | { type: "radio";      label: string; options: string[] }
  | { type: "checkboxes"; label: string; options: string[] };

type Amenity = { key: string; label: string; detail?: AmenityDetail };

// Room-level amenities — used for sleeping spaces (helpers_room, drivers_room, living_room)
const ROOM_AMENITY_CATEGORIES: { label: string; items: Amenity[] }[] = [
  {
    label: "Cooling & Heating",
    items: [
      { key: "ac",           label: "Air Conditioning" },
      { key: "fan",          label: "Fan" },
      { key: "ceiling_fan",  label: "Ceiling Fan" },
      { key: "heater",       label: "Heater" },
    ],
  },
  {
    label: "Furniture",
    items: [
      { key: "wardrobe",     label: "Wardrobe" },
      { key: "desk",         label: "Desk" },
      { key: "chair",        label: "Chair" },
      { key: "table",        label: "Table" },
      { key: "shelves",      label: "Shelves / Storage" },
    ],
  },
  {
    label: "Entertainment",
    items: [
      {
        key: "tv", label: "TV",
        detail: {
          type: "checkboxes", label: "Type / Channels",
          options: ["LED", "LCD", "Smart TV", "Cable", "Satellite Channels", "Netflix", "Other OTT"],
        },
      },
    ],
  },
  {
    label: "Other",
    items: [
      { key: "wifi",          label: "WiFi" },
      { key: "power_outlets", label: "Power Outlets / Extension Board" },
      { key: "window",        label: "Window" },
      { key: "curtains",      label: "Curtains / Blinds" },
      { key: "mirror",        label: "Mirror" },
      { key: "lock",          label: "Door Lock" },
    ],
  },
];

// Generic amenities — for non-sleeping space types
const SPACE_AMENITY_CATEGORIES: { label: string; items: Amenity[] }[] = [
  {
    label: "Common Area",
    items: [
      { key: "sun_deck",        label: "Sun Deck" },
      { key: "seating_area",    label: "Seating Area" },
    ],
  },
  {
    label: "Entertainment",
    items: [
      {
        key: "events", label: "Events",
        detail: {
          type: "checkboxes", label: "Event Types",
          options: [
            "Live Band", "Live Singer", "Live Ghazal", "Live Music",
            "Puppet Show", "Magic", "Fire Show", "Karaoke",
            "Movies", "DJ", "Stand-up Comedy", "Folk Dance",
          ],
        },
      },
      {
        key: "tv", label: "TV",
        detail: {
          type: "checkboxes", label: "Type / Channels",
          options: ["LED", "LCD", "Smart TV", "Cable", "Satellite Channels", "Netflix", "Other OTT"],
        },
      },
    ],
  },
  {
    label: "Spa & Wellness",
    items: [
      { key: "massage",        label: "Massage",       detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] } },
      { key: "salon",          label: "Salon",         detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] } },
      { key: "steam_and_sauna", label: "Steam & Sauna", detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] } },
    ],
  },
  {
    label: "Other",
    items: [
      { key: "wifi",          label: "WiFi" },
      { key: "kids_play_area", label: "Kids' Play Area", detail: { type: "radio", label: "Pricing", options: ["Free", "Paid"] } },
    ],
  },
];

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ value, onChange, min = 0, max = 20 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center shrink-0">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-l border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <MinusIcon size={11} weight="bold" />
      </button>
      <div className="w-10 h-7 border-t border-b border-neutral-300 flex items-center justify-center text-sm font-semibold text-neutral-800 bg-white">
        {String(value).padStart(2, "0")}
      </div>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-r border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <PlusIcon size={11} weight="bold" />
      </button>
    </div>
  );
}

// ── Step accordion ────────────────────────────────────────────────────────────

function StepSection({
  index, label, subtitle, isActive, isCompleted, canOpen, onOpen, children,
}: {
  index: number; label: string; subtitle: string;
  isActive: boolean; isCompleted: boolean; canOpen: boolean;
  onOpen: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center shrink-0">
        <button
          type="button"
          disabled={!canOpen && !isActive}
          onClick={canOpen ? onOpen : undefined}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0",
            isCompleted && !isActive
              ? "bg-emerald-500 text-white cursor-pointer"
              : isActive
                ? "bg-primary-600 text-white ring-2 ring-primary-200"
                : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
          )}
        >
          {isCompleted && !isActive ? <CheckIcon size={12} weight="bold" /> : index}
        </button>
        <div className="flex-1 w-px bg-neutral-200 mt-1.5" />
      </div>

      <div className="flex-1 min-w-0 mb-3">
        <button
          type="button"
          disabled={!canOpen && !isActive}
          onClick={canOpen ? onOpen : undefined}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div>
            <p className={cn(
              "text-sm font-semibold",
              isActive ? "text-neutral-900" : isCompleted ? "text-neutral-700" : "text-neutral-400"
            )}>
              {label}
            </p>
            {isActive && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {isCompleted && !isActive && (
            <span className="text-xs font-medium text-primary-600 shrink-0">Edit</span>
          )}
        </button>

        {isActive && (
          <div className="mt-4 bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="p-5 space-y-5">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SWIMMING POOL FORM
// ══════════════════════════════════════════════════════════════════════════════

const POOL_TYPES = [
  { key: "outdoor",  label: "Outdoor" },
  { key: "indoor",   label: "Indoor" },
  { key: "rooftop",  label: "Rooftop" },
  { key: "infinity", label: "Infinity / Overflow" },
  { key: "plunge",   label: "Plunge Pool" },
  { key: "natural",  label: "Natural / Spring" },
];

const WATER_TYPES = [
  { key: "fresh",      label: "Fresh Water" },
  { key: "salt",       label: "Salt Water" },
  { key: "heated",     label: "Heated" },
  { key: "temp_ctrl",  label: "Temperature Controlled" },
];

const DEPTH_PROFILES = [
  { key: "shallow_only",  label: "Shallow Only", desc: "Up to 4 ft throughout" },
  { key: "shallow_deep",  label: "Shallow + Deep End", desc: "Varies from 3 ft to 6+ ft" },
  { key: "variable",      label: "Variable / Custom", desc: "Non-standard depth profile" },
];

const POOL_SIZE_OPTIONS = [
  { key: "small",    label: "Small",     desc: "Up to 5 m × 3 m" },
  { key: "medium",   label: "Medium",    desc: "Up to 10 m × 5 m" },
  { key: "large",    label: "Large",     desc: "10 m × 5 m or bigger" },
  { key: "not_sure", label: "Not Sure",  desc: "I'll add dimensions later" },
];

const POOL_FEATURE_CATEGORIES: { label: string; items: { key: string; label: string }[] }[] = [
  {
    label: "Safety",
    items: [
      { key: "lifeguard",     label: "Lifeguard on Duty" },
      { key: "safety_rail",   label: "Safety Rail / Steps" },
      { key: "night_lighting", label: "Night Lighting" },
      { key: "cctv",          label: "CCTV" },
      { key: "life_rings",    label: "Life Rings / Safety Equipment" },
    ],
  },
  {
    label: "Poolside Facilities",
    items: [
      { key: "sun_loungers",      label: "Sun Loungers / Deck Chairs" },
      { key: "umbrellas",         label: "Umbrellas / Shade" },
      { key: "poolside_shower",   label: "Poolside Shower" },
      { key: "changing_room",     label: "Changing Room" },
      { key: "towels",            label: "Towels Provided" },
      { key: "locker",            label: "Locker / Storage" },
    ],
  },
  {
    label: "Extras",
    items: [
      { key: "pool_bar",      label: "Pool Bar" },
      { key: "jacuzzi",       label: "Jacuzzi / Hot Tub" },
      { key: "kids_section",  label: "Kids' Section / Wading Pool" },
      { key: "waterslide",    label: "Waterslide" },
      { key: "diving_board",  label: "Diving Board" },
      { key: "pool_heating",  label: "Pool Heating" },
    ],
  },
];

const POOL_RULES = [
  { key: "swimwear_required",    label: "Swimwear Required" },
  { key: "no_diving",            label: "No Diving" },
  { key: "no_running",           label: "No Running / Rough Play" },
  { key: "supervised_children",  label: "Children Must Be Supervised" },
  { key: "adults_only_night",    label: "Adults Only After Sunset" },
  { key: "booking_required",     label: "Prior Booking / Slot Required" },
];

// ── Pool-specific radio picker ─────────────────────────────────────────────────

function RadioCard({
  selected, onSelect, label, desc,
}: {
  selected: boolean; onSelect: () => void; label: string; desc?: string;
}) {
  return (
    <label className={cn(
      "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
      selected ? "border-primary-400 bg-primary-50" : "border-neutral-200 hover:border-neutral-300 bg-white",
    )}>
      <input
        type="radio"
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
      />
      <div>
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        {desc && <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>}
      </div>
    </label>
  );
}

// ── Pool form ─────────────────────────────────────────────────────────────────

function PoolSpaceForm({
  hotelId, idx, item, isPending,
}: {
  hotelId: number; idx: number; item: SpaceItem; isPending: boolean;
}) {
  const router = useRouter();
  const [poolPending, startTransition] = useTransition();

  const details = item.amenity_details ?? {};

  const [stepReached, setStepReached] = useState(item.step_reached ?? 0);
  const [currentStep, setCurrentStep] = useState(
    item.step_reached >= 3 ? 1 : Math.min((item.step_reached ?? 0) + 1, 3)
  );

  // Step 1
  const [poolName,     setPoolName]     = useState(item.name || `Swimming Pool ${item.instance}`);
  const [poolType,     setPoolType]     = useState((details.pool_type as string) || "");
  const [isAccessible, setIsAccessible] = useState<boolean | null>(
    item.is_accessible !== undefined ? item.is_accessible : null,
  );

  // Step 2
  const [poolSize,     setPoolSize]     = useState((details.pool_size as string)    || "");
  const [waterType,    setWaterType]    = useState((details.water_type as string)   || "");
  const [depthProfile, setDepthProfile] = useState((details.depth_profile as string) || "");

  // Step 3
  const [features,   setFeatures]   = useState<string[]>(item.amenities ?? []);
  const [hoursType,  setHoursType]  = useState<"all_day" | "specific">(
    (details.hours_type as "all_day" | "specific") || "all_day",
  );
  const [hoursOpen,  setHoursOpen]  = useState((details.hours_open as string)  || "06:00");
  const [hoursClose, setHoursClose] = useState((details.hours_close as string) || "22:00");
  const [rules,      setRules]      = useState<string[]>(
    Array.isArray(details.rules) ? (details.rules as string[]) : [],
  );
  const [description, setDescription] = useState(item.description || "");

  function toggleFeature(key: string) {
    setFeatures(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }
  function toggleRule(key: string) {
    setRules(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  function openStep(s: number) {
    if (stepReached >= s - 1 || s === 1) setCurrentStep(s);
  }

  function save(patch: Partial<SpaceItem>, completingStep: number, nextStep: number | "back") {
    const newReached = Math.max(stepReached, completingStep);
    startTransition(async () => {
      await saveHomestaySpaceDetail(hotelId, idx, { ...patch, step_reached: newReached });
    });
    setStepReached(newReached);
    if (nextStep === "back") {
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
    } else {
      setCurrentStep(nextStep as number);
    }
  }

  const step1Valid = !!poolName.trim() && !!poolType && isAccessible !== null;
  const step2Valid = !!poolSize && !!waterType && !!depthProfile;

  return (
    <div>
      {/* ── Step 1: Pool Info ─────────────────────────────────────── */}
      <StepSection
        index={1}
        label="Pool Info"
        subtitle="Name the pool, select its type, and set guest accessibility"
        isActive={currentStep === 1} isCompleted={stepReached >= 1} canOpen={true}
        onOpen={() => openStep(1)}
      >
        {/* Pool Name */}
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-neutral-800">Pool Name</p>
          <p className="text-xs text-neutral-400">Give this pool a name to identify it on the property</p>
          <input
            type="text"
            value={poolName}
            onChange={e => setPoolName(e.target.value)}
            placeholder={`e.g. Swimming Pool ${item.instance}`}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-neutral-400"
          />
        </div>

        {/* Pool Type */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-800">Pool Type <span className="text-red-400">*</span></p>
          <p className="text-xs text-neutral-400">Select the type that best describes this pool</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {POOL_TYPES.map(pt => (
              <button
                key={pt.key}
                type="button"
                onClick={() => setPoolType(pt.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl border transition-colors",
                  poolType === pt.key
                    ? "bg-primary-500 text-white border-primary-500"
                    : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400",
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Access Status */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-800">Access Status <span className="text-red-400">*</span></p>
          <p className="text-xs text-neutral-400">
            Specify whether guests can use this pool during their stay
          </p>
          <div className="space-y-2 pt-1">
            <RadioCard
              selected={isAccessible === true}
              onSelect={() => setIsAccessible(true)}
              label="Accessible to Guests"
              desc="Guests can use the swimming pool during their stay"
            />
            <RadioCard
              selected={isAccessible === false}
              onSelect={() => setIsAccessible(false)}
              label="Not Accessible to Guests"
              desc="Pool is for property use only — not available to guests"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={poolPending || isPending || !step1Valid}
          onClick={() => save(
            {
              name: poolName.trim(),
              is_accessible: isAccessible ?? false,
              access_type: isAccessible ? "Accessible to Guests" : "Not Accessible to Guests",
              amenity_details: { ...details, pool_type: poolType },
            },
            1, 2,
          )}
          className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </StepSection>

      {/* ── Step 2: Pool Details ──────────────────────────────────── */}
      <StepSection
        index={2}
        label="Pool Details"
        subtitle="Specify size, water type, and depth profile"
        isActive={currentStep === 2} isCompleted={stepReached >= 2} canOpen={stepReached >= 1}
        onOpen={() => openStep(2)}
      >
        {/* Pool Size */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-800">Pool Size <span className="text-red-400">*</span></p>
          <div className="space-y-2 pt-1">
            {POOL_SIZE_OPTIONS.map(opt => (
              <RadioCard
                key={opt.key}
                selected={poolSize === opt.key}
                onSelect={() => setPoolSize(opt.key)}
                label={opt.label}
                desc={opt.desc}
              />
            ))}
          </div>
        </div>

        {/* Water Type */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-800">Water Type <span className="text-red-400">*</span></p>
          <div className="flex flex-wrap gap-2 pt-1">
            {WATER_TYPES.map(wt => (
              <button
                key={wt.key}
                type="button"
                onClick={() => setWaterType(wt.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl border transition-colors",
                  waterType === wt.key
                    ? "bg-primary-500 text-white border-primary-500"
                    : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400",
                )}
              >
                {wt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Depth Profile */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-800">Depth Profile <span className="text-red-400">*</span></p>
          <div className="space-y-2 pt-1">
            {DEPTH_PROFILES.map(dp => (
              <RadioCard
                key={dp.key}
                selected={depthProfile === dp.key}
                onSelect={() => setDepthProfile(dp.key)}
                label={dp.label}
                desc={dp.desc}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={poolPending || isPending || !step2Valid}
          onClick={() => save(
            {
              amenity_details: {
                ...details,
                pool_type:     poolType,
                pool_size:     poolSize,
                water_type:    waterType,
                depth_profile: depthProfile,
              },
            },
            2, 3,
          )}
          className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </StepSection>

      {/* ── Step 3: Facilities & Rules ────────────────────────────── */}
      <StepSection
        index={3}
        label="Facilities & Rules"
        subtitle="Add poolside features, operating hours, and house rules"
        isActive={currentStep === 3} isCompleted={stepReached >= 3} canOpen={stepReached >= 2}
        onOpen={() => openStep(3)}
      >
        {/* Poolside features */}
        <div className="space-y-5">
          {POOL_FEATURE_CATEGORIES.map(cat => (
            <div key={cat.label}>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                {cat.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => toggleFeature(f.key)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                      features.includes(f.key)
                        ? "bg-primary-500 text-white border-primary-500"
                        : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Operating Hours */}
        <div className="space-y-2 pt-1 border-t border-neutral-100">
          <p className="text-sm font-semibold text-neutral-800">Operating Hours</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all_day" as const, label: "Open All Day" },
              { key: "specific" as const, label: "Specific Hours" },
            ].map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setHoursType(opt.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-xl border transition-colors",
                  hoursType === opt.key
                    ? "bg-primary-500 text-white border-primary-500"
                    : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {hoursType === "specific" && (
            <div className="flex items-center gap-3 pt-1">
              <div className="space-y-1">
                <p className="text-xs text-neutral-500">Opens at</p>
                <input
                  type="time"
                  value={hoursOpen}
                  onChange={e => setHoursOpen(e.target.value)}
                  className="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                />
              </div>
              <div className="pt-5 text-neutral-400 text-sm">to</div>
              <div className="space-y-1">
                <p className="text-xs text-neutral-500">Closes at</p>
                <input
                  type="time"
                  value={hoursClose}
                  onChange={e => setHoursClose(e.target.value)}
                  className="px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* House Rules */}
        <div className="space-y-2 pt-1 border-t border-neutral-100">
          <p className="text-sm font-semibold text-neutral-800">House Rules</p>
          <p className="text-xs text-neutral-400">Select all rules that apply to this pool</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {POOL_RULES.map(r => (
              <button
                key={r.key}
                type="button"
                onClick={() => toggleRule(r.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                  rules.includes(r.key)
                    ? "bg-primary-500 text-white border-primary-500"
                    : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Notes */}
        <div className="space-y-1.5 pt-1 border-t border-neutral-100">
          <p className="text-sm font-semibold text-neutral-800">
            Additional Notes{" "}
            <span className="text-xs font-normal text-neutral-400">— optional</span>
          </p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. Pool is heated in winter. Guests should inform the host before use."
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-neutral-400"
          />
        </div>

        <button
          type="button"
          disabled={poolPending || isPending}
          onClick={() => save(
            {
              amenities: features,
              description,
              details_added: true,
              amenity_details: {
                ...details,
                pool_type:     poolType,
                pool_size:     poolSize,
                water_type:    waterType,
                depth_profile: depthProfile,
                hours_type:    hoursType,
                hours_open:    hoursType === "specific" ? hoursOpen  : "",
                hours_close:   hoursType === "specific" ? hoursClose : "",
                rules,
              },
            },
            3, "back",
          )}
          className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {poolPending || isPending ? "Saving…" : "Save & Continue"}
        </button>
      </StepSection>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SpaceEditTab({
  hotelId, idx, item,
}: {
  hotelId: number; idx: number; item: SpaceItem;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const hasSleepingStep = SLEEPING_SPACE_TYPES.has(item.space_type);
  const isStaffRoom     = STAFF_ROOM_TYPES.has(item.space_type);
  const S_SLEEPING      = hasSleepingStep ? 2 : -1;
  const S_FACILITIES    = hasSleepingStep ? 3 : 2;

  const [stepReached, setStepReached] = useState(item.step_reached ?? 0);
  const [currentStep, setCurrentStep] = useState(
    item.step_reached >= S_FACILITIES ? 1 : Math.min((item.step_reached ?? 0) + 1, S_FACILITIES)
  );

  // Step 1 — Access Info
  const [spaceName, setSpaceName]       = useState(item.name || `${item.label} ${item.instance}`);
  const [isAccessible, setIsAccessible] = useState<boolean | null>(
    item.is_accessible !== undefined ? item.is_accessible : null
  );
  const [accessType, setAccessType]     = useState(item.access_type || "");

  // Step 2 — Sleeping Arrangement (sleeping spaces only)
  const [beds, setBeds]             = useState<Record<string, number>>(item.beds ?? {});
  const [baseAdults, setBaseAdults] = useState(item.base_adults ?? 1);
  const [maxAdults, setMaxAdults]   = useState(item.max_adults ?? 2);
  const [showMoreBeds, setShowMoreBeds] = useState(false);

  // Step S_FACILITIES — Facilities
  const [hasBathroom, setHasBathroom]       = useState<boolean | null>(item.has_attached_bathroom ?? null);
  const [amenities, setAmenities]           = useState<string[]>(item.amenities ?? []);
  const [amenityDetails, setAmenityDetails] = useState<Record<string, string | string[]>>(
    item.amenity_details ?? {}
  );

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function setBedCount(key: string, count: number) {
    setBeds(prev => {
      const next = { ...prev };
      if (count <= 0) delete next[key];
      else next[key] = count;
      return next;
    });
  }

  function toggleAmenity(key: string) {
    setAmenities(prev => {
      if (prev.includes(key)) {
        setAmenityDetails(d => { const n = { ...d }; delete n[key]; return n; });
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  }

  function setRadioDetail(key: string, value: string) {
    setAmenityDetails(prev => ({ ...prev, [key]: value }));
  }

  function toggleCheckboxDetail(key: string, opt: string) {
    setAmenityDetails(prev => {
      const current = (prev[key] as string[] | undefined) ?? [];
      const next = current.includes(opt) ? current.filter(o => o !== opt) : [...current, opt];
      return { ...prev, [key]: next };
    });
  }

  function save(patch: Partial<SpaceItem>, completingStep: number, nextStep: number | "back") {
    const newReached = Math.max(stepReached, completingStep);
    startTransition(async () => {
      await saveHomestaySpaceDetail(hotelId, idx, { ...patch, step_reached: newReached });
    });
    setStepReached(newReached);
    if (nextStep === "back") {
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
    } else {
      setCurrentStep(nextStep);
    }
  }

  function handleDeactivate() {
    startTransition(async () => {
      await deleteHomestaySpace(hotelId, idx);
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=3`);
    });
  }

  function openStep(s: number) {
    if (stepReached >= s - 1 || s === 1) setCurrentStep(s);
  }

  // Step 1 validity
  const step1Valid = isStaffRoom
    ? !!spaceName.trim() && isAccessible !== null
    : !!spaceName.trim() && !!accessType;

  // Amenity categories based on space type
  const amenityCategories = hasSleepingStep ? ROOM_AMENITY_CATEGORIES : SPACE_AMENITY_CATEGORIES;

  // Bed types: first N shown, rest behind "View more"
  const visibleBeds = showMoreBeds ? BED_TYPES : BED_TYPES.slice(0, BED_TYPES_DEFAULT_COUNT);
  const hiddenCount = BED_TYPES.length - BED_TYPES_DEFAULT_COUNT;

  return (
    <div>
      <SectionCard
        title={`${item.label} ${item.instance}`}
        headerAction={
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            <TrashIcon size={14} weight="fill" />
            Deactivate Space
          </button>
        }
      >
        <Link
          href={`/hotel-connect/properties/${hotelId}/edit?tab=3`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeftIcon size={13} weight="bold" />
          Back to Rooms &amp; Spaces
        </Link>

        {item.space_type === "swimming_pool" ? (
          <PoolSpaceForm hotelId={hotelId} idx={idx} item={item} isPending={isPending} />
        ) : (
        <div>
          {/* ── Step 1: Access Info ────────────────────────────────── */}
          <StepSection
            index={1}
            label="Access Info"
            subtitle={`Name this space and specify its accessibility for guests`}
            isActive={currentStep === 1} isCompleted={stepReached >= 1} canOpen={true}
            onOpen={() => openStep(1)}
          >
            {/* Space Name */}
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-neutral-800">Space Name</p>
              <p className="text-xs text-neutral-400">Give this space a name to identify it on the property</p>
              <input
                type="text"
                value={spaceName}
                onChange={e => setSpaceName(e.target.value)}
                placeholder={`e.g. ${item.label} ${item.instance}`}
                className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-neutral-400"
              />
            </div>

            {/* Access Status */}
            {isStaffRoom ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-neutral-800">Access Status</p>
                <p className="text-xs text-neutral-400">
                  Specify whether guests can access and use this space during their stay
                </p>
                <div className="space-y-2 pt-1">
                  {[
                    {
                      val: true,
                      label: "Accessible to Guests",
                      desc: `Guests can access and use the ${item.label} during their stay`,
                    },
                    {
                      val: false,
                      label: "Not Accessible to Guests",
                      desc: `This space is for staff / internal use only and is not available to guests`,
                    },
                  ].map(opt => (
                    <label
                      key={String(opt.val)}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                        isAccessible === opt.val
                          ? "border-primary-400 bg-primary-50"
                          : "border-neutral-200 hover:border-neutral-300 bg-white"
                      )}
                    >
                      <input
                        type="radio"
                        name="space-access-status"
                        checked={isAccessible === opt.val}
                        onChange={() => setIsAccessible(opt.val)}
                        className="mt-0.5 h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{opt.label}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-neutral-800">Type of Access</p>
                <p className="text-xs text-neutral-400">
                  Specify if access to the {item.label} is private or shared for guests
                </p>
                <div className="space-y-2 pt-1">
                  {[
                    {
                      key: `Private ${item.label}`,
                      desc: `Guests will have private access to the ${item.label} space & amenities`,
                    },
                    {
                      key: `Shared ${item.label}`,
                      desc: `Guests will have to share the ${item.label} & amenities with other guests`,
                    },
                  ].map(opt => (
                    <label
                      key={opt.key}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors",
                        accessType === opt.key
                          ? "border-primary-400 bg-primary-50"
                          : "border-neutral-200 hover:border-neutral-300 bg-white"
                      )}
                    >
                      <input
                        type="radio"
                        name="space-access-type"
                        checked={accessType === opt.key}
                        onChange={() => setAccessType(opt.key)}
                        className="mt-0.5 h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
                      />
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{opt.key}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isPending || !step1Valid}
              onClick={() => save(
                {
                  name: spaceName.trim(),
                  is_accessible: isStaffRoom ? (isAccessible ?? true) : true,
                  access_type: isStaffRoom
                    ? (isAccessible ? "Accessible to Guests" : "Not Accessible to Guests")
                    : accessType,
                },
                1,
                hasSleepingStep ? 2 : S_FACILITIES,
              )}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </StepSection>

          {/* ── Step 2: Sleeping Arrangement (sleeping spaces only) ── */}
          {hasSleepingStep && (
            <StepSection
              index={2}
              label="Sleeping Arrangement"
              subtitle={`Specify the bed types and occupancy for ${item.label} ${item.instance}`}
              isActive={currentStep === S_SLEEPING} isCompleted={stepReached >= S_SLEEPING} canOpen={stepReached >= 1}
              onOpen={() => openStep(S_SLEEPING)}
            >
              <div>
                <p className="text-sm font-semibold text-neutral-800 mb-0.5">Bed Options</p>
                <p className="text-xs text-neutral-400 mb-3">
                  Specify the number of each bed type available in this space
                </p>
                <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
                  {visibleBeds.map(bed => (
                    <div key={bed.key} className="flex items-center justify-between gap-3 px-4 py-3 bg-white">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-800">{bed.label}</p>
                        <p className="text-xs text-neutral-400">{bed.size}</p>
                      </div>
                      <Stepper
                        value={beds[bed.key] ?? 0}
                        onChange={v => setBedCount(bed.key, v)}
                        min={0}
                        max={10}
                      />
                    </div>
                  ))}
                </div>

                {/* View more / View less */}
                <button
                  type="button"
                  onClick={() => setShowMoreBeds(p => !p)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {showMoreBeds ? (
                    <><CaretUpIcon size={12} weight="bold" /> View less</>
                  ) : (
                    <><CaretDownIcon size={12} weight="bold" /> View {hiddenCount} more bed types</>
                  )}
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-100">
                <p className="text-sm font-semibold text-neutral-800 mb-3">Occupancy</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4 border border-neutral-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Base Adults</p>
                      <p className="text-xs text-neutral-400">Ideal number of adults that can be accommodated</p>
                    </div>
                    <Stepper
                      value={baseAdults}
                      onChange={v => { setBaseAdults(v); if (maxAdults < v) setMaxAdults(v); }}
                      min={1}
                      max={20}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 border border-neutral-200 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">Maximum Adults</p>
                      <p className="text-xs text-neutral-400">Maximum number of adults that can be accommodated</p>
                    </div>
                    <Stepper
                      value={maxAdults}
                      onChange={v => setMaxAdults(Math.max(baseAdults, v))}
                      min={1}
                      max={20}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={() => save({ beds, base_adults: baseAdults, max_adults: maxAdults }, S_SLEEPING, S_FACILITIES)}
                className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </StepSection>
          )}

          {/* ── Step S_FACILITIES: Facilities (final step) ─────────── */}
          <StepSection
            index={S_FACILITIES}
            label="Facilities"
            subtitle={`Add the facilities and amenities available in ${item.label} ${item.instance}`}
            isActive={currentStep === S_FACILITIES}
            isCompleted={stepReached >= S_FACILITIES}
            canOpen={stepReached >= S_FACILITIES - 1}
            onOpen={() => openStep(S_FACILITIES)}
          >
            {/* Ensuite Bathroom — only for sleeping spaces */}
            {hasSleepingStep && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-neutral-800">Ensuite Bathroom</p>
                <p className="text-xs text-neutral-400">
                  Does this space have a private attached bathroom?
                </p>
                <div className="flex gap-3">
                  {[
                    { val: true,  label: "Yes" },
                    { val: false, label: "No"  },
                  ].map(opt => (
                    <label
                      key={String(opt.val)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors text-sm font-medium",
                        hasBathroom === opt.val
                          ? "border-primary-400 bg-primary-50 text-primary-700"
                          : "border-neutral-200 hover:border-neutral-300 bg-white text-neutral-700"
                      )}
                    >
                      <input
                        type="radio"
                        name="space-has-bathroom"
                        checked={hasBathroom === opt.val}
                        onChange={() => setHasBathroom(opt.val)}
                        className="h-3.5 w-3.5 accent-primary-500 cursor-pointer"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Amenities / Facilities list */}
            <div className="space-y-6">
              {amenityCategories.map(cat => {
                const selectedWithDetail = cat.items.filter(
                  a => a.detail && amenities.includes(a.key)
                );
                return (
                  <div key={cat.label}>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                      {cat.label}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {cat.items.map(a => (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() => toggleAmenity(a.key)}
                          className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                            amenities.includes(a.key)
                              ? "bg-primary-500 text-white border-primary-500"
                              : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                          )}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>

                    {selectedWithDetail.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedWithDetail.map(a => {
                          const def = a.detail!;
                          const currentVal = amenityDetails[a.key];
                          return (
                            <div key={a.key} className="border border-neutral-200 rounded-lg p-3 bg-neutral-50">
                              <p className="text-xs font-semibold text-neutral-700 mb-2">
                                {a.label} — {def.label}
                              </p>
                              {def.type === "radio" ? (
                                <div className="flex flex-wrap gap-2">
                                  {def.options.map(opt => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setRadioDetail(a.key, opt)}
                                      className={cn(
                                        "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                                        currentVal === opt
                                          ? "bg-primary-500 text-white border-primary-500"
                                          : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {def.options.map(opt => {
                                    const checked = Array.isArray(currentVal) && currentVal.includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => toggleCheckboxDetail(a.key, opt)}
                                        className={cn(
                                          "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                                          checked
                                            ? "bg-primary-500 text-white border-primary-500"
                                            : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                                        )}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={() => save(
                {
                  amenities,
                  amenity_details: amenityDetails,
                  has_attached_bathroom: hasSleepingStep ? (hasBathroom ?? false) : null,
                  details_added: true,
                },
                S_FACILITIES, "back"
              )}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save & Continue"}
            </button>
          </StepSection>
        </div>
        )}
      </SectionCard>
    </div>
  );
}
