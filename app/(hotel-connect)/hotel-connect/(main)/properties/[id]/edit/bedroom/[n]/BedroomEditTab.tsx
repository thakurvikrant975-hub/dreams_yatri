"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon, CheckIcon, PlusIcon, MinusIcon,
  CaretDownIcon, CaretUpIcon,
} from "@phosphor-icons/react/dist/ssr";
import { saveBedroomStep } from "./bedroom-actions";
import type { BedroomDetail } from "./bedroom-types";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { Input } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/input";
import { Textarea } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/textarea";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/app/lib/utils";
import { convertAreaUnit } from "@/app/lib/units";

// ── Constants ─────────────────────────────────────────────────────────────────

const BED_TYPES = [
  { key: "single_bed",     label: "Single Bed",    dims: "3 by 4 feet" },
  { key: "twin_bed",       label: "Twin Bed",      dims: "3 by 4 feet" },
  { key: "queen_bed",      label: "Queen Bed",     dims: "5 by 6 feet" },
  { key: "king_bed",       label: "King Bed",      dims: "6 by 6.30 feet" },
  { key: "double_bed",     label: "Double Bed",    dims: "6 by 6 feet" },
  { key: "bunk_bed",       label: "Bunk Bed",      dims: "Variable Size" },
];
const MORE_BED_TYPES = [
  { key: "sofa_bed",       label: "Sofa Bed",      dims: "Variable Size" },
  { key: "floor_mattress", label: "Floor Mattress",dims: "Variable Size" },
  { key: "water_bed",      label: "Water Bed",     dims: "Variable Size" },
  { key: "futon",          label: "Futon",         dims: "Variable Size" },
  { key: "hammock",        label: "Hammock",       dims: "Variable Size" },
];
const BATHROOM_TYPES = [
  "Private Bathroom",
  "Shared Bathroom",
  "En-suite Bathroom",
  "Jack-and-Jill Bathroom",
];
const BEDROOM_AMENITIES = [
  "Air Conditioning", "Heating", "Ceiling Fan", "Smart TV", "WiFi",
  "Mini Refrigerator", "Safe", "Wardrobe / Closet", "Work Desk",
  "Iron & Ironing Board", "Hair Dryer", "Blackout Curtains",
  "Electric Kettle", "Private Entrance", "Reading Lamp",
];
const VIEW_OPTIONS = [
  "Garden View", "Pool View", "City View", "Sea View",
  "Mountain View", "Courtyard View", "Lake View", "Street View",
];
const FLOOR_LEVELS = [
  "Ground Floor", "1st Floor", "2nd Floor", "3rd Floor",
  "4th Floor", "5th Floor", "6th Floor+",
];

// ── Shared Stepper ────────────────────────────────────────────────────────────

function Stepper({
  value, onChange, min = 0, max = 99, disabled,
}: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; disabled?: boolean;
}) {
  return (
    <div className="flex items-center self-start sm:self-auto shrink-0">
      <button type="button" disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-l border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed">
        <MinusIcon size={11} weight="bold" />
      </button>
      <div className="w-10 h-7 border-t border-b border-neutral-300 flex items-center justify-center text-sm font-semibold text-neutral-800 bg-white">
        {String(value).padStart(2, "0")}
      </div>
      <button type="button" disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded-r border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed">
        <PlusIcon size={11} weight="bold" />
      </button>
    </div>
  );
}

// ── Step indicator + accordion shell ─────────────────────────────────────────

function StepSection({
  index, label, subtitle, isActive, isCompleted, canOpen, onOpen, children, containerRef,
}: {
  index: number; label: string; subtitle: string;
  isActive: boolean; isCompleted: boolean; canOpen: boolean;
  onOpen: () => void; children: React.ReactNode;
  containerRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="flex gap-3.5" ref={containerRef}>
      {/* Left track */}
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
                ? "bg-primary-500 text-white ring-2 ring-primary-200"
                : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
          )}
        >
          {isCompleted && !isActive ? <CheckIcon size={12} weight="bold" /> : index}
        </button>
        <div className="flex-1 w-px bg-neutral-200 mt-1.5" />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 mb-3">
        <button
          type="button"
          disabled={!canOpen && !isActive}
          onClick={canOpen ? onOpen : undefined}
          className={cn(
            "w-full flex items-center justify-between gap-3 text-left",
            !isActive && "mb-0"
          )}
        >
          <div>
            <p className={cn("text-sm font-semibold", isActive ? "text-neutral-900" : isCompleted ? "text-neutral-700" : "text-neutral-400")}>{label}</p>
            {isActive && <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>}
          </div>
          {isCompleted && !isActive && (
            <span className="text-xs font-medium text-primary-600 shrink-0">Edit</span>
          )}
        </button>

        {isActive && (
          <div className="mt-4  rounded-xl overflow-hidden">
            <div className="px-5 space-y-5">
              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── YesNo radio ───────────────────────────────────────────────────────────────

function YesNoRadio({
  value, onChange, disabled,
}: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 self-start sm:self-auto shrink-0">
      {([false, true] as const).map((opt) => (
        <label key={String(opt)} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer select-none">
          <input
            type="radio"
            checked={value === opt}
            onChange={() => onChange(opt)}
            disabled={disabled}
            className="h-4 w-4 accent-primary-500 cursor-pointer"
          />
          {opt ? "Yes" : "No"}
        </label>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BedroomEditTab({
  hotelId, n, total, detail,
}: {
  hotelId: number; n: number; total: number; detail: BedroomDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Step tracking
  const [stepReached, setStepReached] = useState(detail.step_reached ?? 0);
  const [currentStep, setCurrentStep] = useState(
    detail.step_reached >= 4 ? 1 : Math.min((detail.step_reached ?? 0) + 1, 4)
  );

  // Step 1 — Access Info
  const [name, setName] = useState(detail.name || `Bedroom ${n}`);

  // Step 2 — Sleeping Arrangement
  const [beds, setBeds] = useState<Record<string, number>>(detail.beds ?? {});
  const [showMoreBeds, setShowMoreBeds] = useState(false);
  const [hasExtraBed, setHasExtraBed] = useState(detail.has_extra_bed ?? false);
  const [extraBedType, setExtraBedType] = useState(detail.extra_bed_type ?? "");
  const [baseAdults, setBaseAdults] = useState(detail.base_adults ?? 2);
  const [maxAdults, setMaxAdults] = useState(detail.max_adults ?? 2);

  // Step 3 — Facilities
  const [hasBathroom, setHasBathroom] = useState(detail.has_bathroom ?? false);
  const [bathroomType, setBathroomType] = useState(detail.bathroom_type ?? "");
  const [hasBalcony, setHasBalcony] = useState(detail.has_balcony ?? false);
  const [balconyFurniture, setBalconyFurniture] = useState(detail.balcony_furniture ?? false);
  const [amenities, setAmenities] = useState<string[]>(detail.amenities ?? []);
  const [showAmenities, setShowAmenities] = useState(false);

  // Step 4 — Additional Details
  const [description, setDescription] = useState(detail.description ?? "");
  const [view, setView] = useState(detail.view ?? "");
  const [sizeValue, setSizeValue] = useState<string>(detail.size_value?.toString() ?? "");
  const [sizeUnit, setSizeUnit] = useState<"sqm" | "sqft">(detail.size_unit ?? "sqm");
  const [floorLevel, setFloorLevel] = useState(detail.floor_level ?? "");

  function setBed(key: string, val: number) {
    setBeds(prev => ({ ...prev, [key]: val }));
  }
  function toggleAmenity(a: string) {
    setAmenities(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  function save(patch: Partial<BedroomDetail>, completingStep: number, nextStep: number | "back") {
    const newReached = Math.max(stepReached, completingStep);
    startTransition(async () => {
      await saveBedroomStep(hotelId, n, { ...patch, step_reached: newReached });
    });
    setStepReached(newReached);
    if (nextStep === "back") {
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=4`);
    } else {
      setCurrentStep(nextStep);
    }
  }

  function openStep(s: number) {
    if (stepReached >= s - 1 || s === 1) setCurrentStep(s);
  }

  // On a tall mobile viewport, the button that advances currentStep sits at
  // the bottom of the previous step — without this, the page keeps its
  // scroll position and the newly-opened step renders starting mid-screen
  // instead of from its own header. Skips the initial mount.
  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    stepRefs.current[currentStep]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentStep]);

  const STEPS = [
    { index: 1, label: "Access Info",           subtitle: "Add the room name and if the guests can access it" },
    { index: 2, label: "Sleeping Arrangement",   subtitle: "Add the type of beds available in the room and confirm guest occupancy" },
    { index: 3, label: "Facilities",             subtitle: `Add amenities for Bedroom ${n}` },
    { index: 4, label: "Additional Details",     subtitle: `Add more details about the Bedroom ${n}` },
  ];

  return (
    <div >
      <SectionCard title={`Bedroom ${n} of ${total}`}>
        <Link
          href={`/hotel-connect/properties/${hotelId}/edit?tab=4`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeftIcon size={13} weight="bold" />
          Back to Rooms &amp; Spaces
        </Link>
      {/* Steps */}
      <div>
        {/* ── Step 1: Access Info ─────────────────────────────────── */}
        <StepSection
          {...STEPS[0]}
          isActive={currentStep === 1} isCompleted={stepReached >= 1} canOpen={true}
          onOpen={() => openStep(1)}
          containerRef={(el) => { stepRefs.current[1] = el; }}
        >
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Room Name</label>
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isPending}
                className="max-w-xs"
              />
            </div>
            <Button variant="primary" size="sm" disabled={isPending || !name.trim()} onClick={() => save({ name: name.trim() }, 1, 2)}>
              Next
            </Button>
        </StepSection>

        {/* ── Step 2: Sleeping Arrangement ───────────────────────── */}
        <StepSection
          {...STEPS[1]}
          isActive={currentStep === 2} isCompleted={stepReached >= 2} canOpen={stepReached >= 1}
          onOpen={() => openStep(2)}
          containerRef={(el) => { stepRefs.current[2] = el; }}
        >
            {/* Bed Options */}
            <div>
              <p className="text-sm font-semibold text-neutral-800 mb-0.5">Bed Options</p>
              <p className="text-xs text-neutral-400 mb-3">Help your guests understand what beds are available in the Room</p>
              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden">
                {[...BED_TYPES, ...(showMoreBeds ? MORE_BED_TYPES : [])].map(bed => (
                  <div key={bed.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{bed.label}</p>
                      <p className="text-xs text-neutral-400">{bed.dims}</p>
                    </div>
                    <Stepper
                      value={beds[bed.key] ?? 0}
                      onChange={v => setBed(bed.key, v)}
                      min={0} disabled={isPending}
                    />
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setShowMoreBeds(v => !v)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
                {showMoreBeds ? <>View less <CaretUpIcon size={11} /></> : <>View more <CaretDownIcon size={11} /></>}
              </button>
            </div>

            {/* Extra bed or cot */}
            <details className="border border-neutral-200 rounded-lg overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">Extra bed or cot</p>
                  <p className="text-xs text-neutral-400">Help your guests understand if there are any Extra Bed or Cot available on request</p>
                </div>
                <CaretDownIcon size={14} className="text-neutral-400 shrink-0" />
              </summary>
              <div className="px-4 pb-4 border-t border-neutral-100 pt-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between">
                  <p className="text-sm text-neutral-700">Extra bed available?</p>
                  <YesNoRadio value={hasExtraBed} onChange={v => { setHasExtraBed(v); if (!v) setExtraBedType(""); }} />
                </div>
                {hasExtraBed && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">Extra bed type</label>
                    <SearchSelect
                      value={extraBedType}
                      onChange={setExtraBedType}
                      options={["Roll-away bed", "Cot / Baby crib", "Sofa bed", "Floor mattress"]}
                      placeholder="Select type"
                      showSearch={false}
                      className="max-w-xs"
                    />
                  </div>
                )}
              </div>
            </details>

            {/* Occupancy */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-neutral-800">Occupancy</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between border border-neutral-200 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-800">Base Adults</p>
                  <p className="text-xs text-neutral-400 leading-tight">Ideal number of adults that can be accommodated in this property</p>
                </div>
                <Stepper
                  value={baseAdults}
                  onChange={v => { setBaseAdults(v); if (maxAdults < v) setMaxAdults(v); }}
                  min={1} max={50} disabled={isPending}
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between border border-neutral-200 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-800">Maximum Adults</p>
                  <p className="text-xs text-neutral-400 leading-tight">Maximum number of adults that can be accommodated in this property</p>
                </div>
                <Stepper
                  value={maxAdults}
                  onChange={v => setMaxAdults(Math.max(baseAdults, v))}
                  min={1} max={50} disabled={isPending}
                />
              </div>
              <div className="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2.5">
                <span className="text-blue-500 text-xs mt-0.5">ℹ</span>
                <p className="text-xs text-blue-700">To increase the maximum occupancy, please add details in the Extra Beds section.</p>
              </div>
            </div>

            <Button
              variant="primary" size="sm"
              disabled={isPending || (hasExtraBed && !extraBedType)}
              onClick={() => save({
                beds, has_extra_bed: hasExtraBed, extra_bed_type: extraBedType,
                base_adults: baseAdults, max_adults: maxAdults,
              }, 2, 3)}
            >
              Next
            </Button>
        </StepSection>

        {/* ── Step 3: Facilities ──────────────────────────────────── */}
        <StepSection
          {...STEPS[2]}
          isActive={currentStep === 3} isCompleted={stepReached >= 3} canOpen={stepReached >= 2}
          onOpen={() => openStep(3)}
          containerRef={(el) => { stepRefs.current[3] = el; }}
        >
            {/* Bathroom */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-800">Does the room have an attached bathroom?</p>
                <p className="text-xs text-neutral-400">Attached or en suite bathrooms have a private entrance inside the bedroom</p>
              </div>
              <YesNoRadio value={hasBathroom} onChange={v => { setHasBathroom(v); if (!v) setBathroomType(""); }} />
            </div>
            {hasBathroom && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Select the attached bathroom</label>
                <SearchSelect
                  value={bathroomType}
                  onChange={setBathroomType}
                  options={BATHROOM_TYPES}
                  placeholder="Select"
                  showSearch={false}
                  className="max-w-xs"
                />
              </div>
            )}

            <div className="border-t border-neutral-100 pt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-800">Does the room come with an attached balcony?</p>
                <p className="text-xs text-neutral-400">Attached or en suite bathrooms have a private entrance inside the bedroom</p>
              </div>
              <YesNoRadio value={hasBalcony} onChange={v => { setHasBalcony(v); if (!v) setBalconyFurniture(false); }} />
            </div>
            {hasBalcony && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between">
                <p className="text-sm text-neutral-700">Do you have outdoor furniture on the balcony such as a table or chairs?</p>
                <YesNoRadio value={balconyFurniture} onChange={setBalconyFurniture} />
              </div>
            )}

            {/* Amenities */}
            <div className="border-t border-neutral-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">What kind of amenities are included in the bedroom?</p>
                  <p className="text-xs text-neutral-400">Add the amenities provided in the Bedroom {n}.</p>
                </div>
                <button type="button" onClick={() => setShowAmenities(v => !v)}
                  className="text-sm font-semibold text-primary-600 hover:text-primary-700 shrink-0">
                  {showAmenities ? "Done" : amenities.length > 0 ? `Edit (${amenities.length})` : "Add"}
                </button>
              </div>
              {showAmenities && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {BEDROOM_AMENITIES.map(a => (
                    <button
                      key={a} type="button"
                      onClick={() => toggleAmenity(a)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                        amenities.includes(a)
                          ? "bg-primary-500 text-white border-primary-500"
                          : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-400"
                      )}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}
              {!showAmenities && amenities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {amenities.map(a => (
                    <span key={a} className="px-2.5 py-1 text-xs bg-primary-50 text-primary-700 rounded-full border border-primary-200">{a}</span>
                  ))}
                </div>
              )}
              {!showAmenities && amenities.length === 0 && (
                <p className="mt-1 text-xs text-neutral-400">0 Amenities</p>
              )}
            </div>

            <Button
              variant="primary" size="sm"
              disabled={isPending || (hasBathroom && !bathroomType)}
              onClick={() => save({
                has_bathroom: hasBathroom, bathroom_type: bathroomType,
                has_balcony: hasBalcony, balcony_furniture: balconyFurniture,
                amenities,
              }, 3, 4)}
            >
              Next
            </Button>
        </StepSection>

        {/* ── Step 4: Additional Details ──────────────────────────── */}
        <StepSection
          {...STEPS[3]}
          isActive={currentStep === 4} isCompleted={stepReached >= 4} canOpen={stepReached >= 3}
          onOpen={() => openStep(4)}
          containerRef={(el) => { stepRefs.current[4] = el; }}
        >
            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-neutral-800 mb-1.5">
                Room Description <span className="font-normal text-neutral-400">(Optional)</span>
              </label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Please add details"
              />
              <p className="text-right text-xs text-neutral-400 mt-1">{description.length} of 500</p>
            </div>

            {/* View + Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Room View <span className="font-normal text-neutral-400">(Optional)</span>
                </label>
                <SearchSelect
                  value={view}
                  onChange={setView}
                  options={VIEW_OPTIONS}
                  placeholder="Select View"
                  showSearch={false}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Room Size (Area)
                  <span className="block font-normal text-neutral-400">Define room area, don&apos;t include any other property area</span>
                </label>
                <div className="flex items-center gap-0">
                  <Input
                    type="number"
                    value={sizeValue}
                    onChange={e => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setSizeValue(e.target.value); }}
                    placeholder="00"
                    min={0}
                    className="w-16 rounded-r-none border-r-0"
                  />
                  {(["sqm", "sqft"] as const).map(u => (
                    <button
                      key={u} type="button"
                      onClick={() => {
                        if (u === sizeUnit) return;
                        const n = parseFloat(sizeValue);
                        if (Number.isFinite(n)) setSizeValue(String(convertAreaUnit(n, sizeUnit, u)));
                        setSizeUnit(u);
                      }}
                      className={cn(
                        "px-2.5 py-2 text-xs font-medium border-t border-b border-neutral-300 last:rounded-r-lg last:border-r transition-colors",
                        sizeUnit === u ? "bg-primary-500 text-white border-primary-500" : "bg-white text-neutral-600 hover:bg-neutral-50"
                      )}
                    >
                      {u === "sqm" ? "sq.mtr." : "sq.ft."}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Floor Level */}
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                Floor Level <span className="font-normal text-neutral-400">(Optional)</span>
              </label>
              <SearchSelect
                value={floorLevel}
                onChange={setFloorLevel}
                options={FLOOR_LEVELS}
                placeholder="Select"
                showSearch={false}
              />
            </div>

            <Button
              variant="primary" size="sm"
              disabled={isPending}
              loading={isPending}
              onClick={() => save({
                description, view,
                size_value: sizeValue ? Number(sizeValue) : null,
                size_unit: sizeUnit, floor_level: floorLevel,
              }, 4, "back")}
            >
              {isPending ? "Saving…" : "Save & Continue"}
            </Button>
        </StepSection>
      </div>
      </SectionCard>
    </div>
  );
}
