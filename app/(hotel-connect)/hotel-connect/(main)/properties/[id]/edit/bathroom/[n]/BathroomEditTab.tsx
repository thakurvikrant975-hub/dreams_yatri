"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon, CheckIcon, XIcon,
  CaretDownIcon, CaretUpIcon,
  ShowerIcon, MapPinIcon, InfoIcon,
  UsersThreeIcon, HouseIcon, CheckCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { saveHomestayBathroomDetail } from "../../tabs/homestay-rooms-crud-actions";
import type { BathroomDetail } from "../../tabs/homestay-rooms-types";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { Input } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/input";
import { Button } from "@/app/components/ui/Button";
import { cn } from "@/app/lib/utils";

// ── Amenity data ──────────────────────────────────────────────────────────────

const TOILETRIES_ITEMS = [
  { key: "Moisturiser",  label: "Moisturiser" },
  { key: "Shampoo",      label: "Shampoo" },
  { key: "Conditioner",  label: "Conditioner" },
  { key: "Shower Gel",   label: "Shower Gel" },
  { key: "Soap",         label: "Soap" },
  { key: "Comb",         label: "Comb" },
];
const TOWEL_ITEMS = [
  { key: "Bath Towel", label: "Bath Towel" },
  { key: "Pool Towel", label: "Pool Towel" },
];
const GENERAL_ITEMS = [
  { key: "Pool/ Beach Towels",     label: "Pool/ Beach Towels" },
  { key: "Bathroom Phone",         label: "Bathroom Phone" },
  { key: "Bubble Bath",            label: "Bubble Bath" },
  { key: "Dental Kit",             label: "Dental Kit" },
  { key: "Geyser/ Water Heater",   label: "Geyser/ Water Heater" },
  { key: "Slippers",               label: "Slippers" },
  { key: "Shower Cap",             label: "Shower Cap" },
  { key: "Hammam",                 label: "Hammam" },
  { key: "Bathrobes",              label: "Bathrobes" },
  { key: "Western Toilet Seat",    label: "Western Toilet Seat" },
  { key: "Shower Cubicle",         label: "Shower Cubicle" },
  { key: "Weighing Scale",         label: "Weighing Scale" },
  { key: "Shaving Mirror",         label: "Shaving Mirror" },
  { key: "Sewing Kit",             label: "Sewing Kit" },
  { key: "Bidet",                  label: "Bidet" },
  { key: "Toilet with Grab Rails", label: "Toilet with Grab Rails" },
];
const OTHER_ITEMS = [
  { key: "Open Air Bath",   label: "Open Air Bath" },
  { key: "Jacuzzi",         label: "Jacuzzi" },
  { key: "Washing Machine", label: "Washing Machine" },
];

function toDetailFields(amenities: string[]): Partial<BathroomDetail> {
  return {
    has_bathtub:   amenities.includes("Bathtub"),
    has_shower:    amenities.includes("Shower Cubicle"),
    has_hot_water: amenities.includes("Geyser/ Water Heater"),
  };
}

function seedAmenities(detail: BathroomDetail): string[] {
  const base = [...(detail.amenities ?? [])];
  if (detail.has_bathtub   && !base.includes("Bathtub"))              base.push("Bathtub");
  if (detail.has_shower    && !base.includes("Shower Cubicle"))       base.push("Shower Cubicle");
  if (detail.has_hot_water && !base.includes("Geyser/ Water Heater")) base.push("Geyser/ Water Heater");
  return base;
}

// ── Vertical StepSection ──────────────────────────────────────────────────────

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
                ? "bg-primary-500 text-white ring-2 ring-primary-200"
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

// ── Amenity chip ──────────────────────────────────────────────────────────────

function AmenityChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
        selected
          ? "bg-primary-500 text-white border-primary-500"
          : "bg-white text-neutral-600 border-neutral-300 hover:border-primary-300 hover:text-primary-600"
      )}>
      {selected && <CheckCircleIcon size={11} weight="fill" />}
      {label}
    </button>
  );
}

function CategorySection({
  title, badge, children, defaultOpen = true,
}: { title: string; badge?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-neutral-50 text-left">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-neutral-700 uppercase tracking-wide">{title}</p>
          {badge != null && badge > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-primary-100 text-primary-700 rounded-full font-semibold">
              {badge}
            </span>
          )}
        </div>
        {open ? <CaretUpIcon size={13} className="text-neutral-400" /> : <CaretDownIcon size={13} className="text-neutral-400" />}
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const STEPS = [
  { index: 1, label: "Access Info",        subtitle: "Specify if this bathroom is private or shared for guests" },
  { index: 2, label: "Amenities",          subtitle: "Select fixtures and amenities available in this bathroom" },
  { index: 3, label: "Additional Details", subtitle: "Give this bathroom a name guests can recognise" },
];

const ACCESS_OPTIONS = [
  { key: "Private", label: "Private Bathroom", icon: HouseIcon,      description: "Guests will have private access to the Bathroom space & amenities." },
  { key: "Shared",  label: "Shared Bathroom",  icon: UsersThreeIcon, description: "Guests will have to share the Bathroom & amenities with other guests." },
];

export default function BathroomEditTab({
  hotelId, n, total, detail, attachedBedroomName,
}: {
  hotelId: number; n: number; total: number;
  detail: BathroomDetail; attachedBedroomName: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [stepReached,  setStepReached]  = useState(detail.step_reached ?? 0);
  const [currentStep,  setCurrentStep]  = useState(
    detail.step_reached >= 3 ? 1 : Math.min((detail.step_reached ?? 0) + 1, 3)
  );

  // Step 1
  const accessKey = detail.type === "Shared Bathroom" ? "Shared" : detail.type === "Private Bathroom" ? "Private" : "";
  const [accessType, setAccessType] = useState(accessKey);

  // Step 2
  const [amenities, setAmenities] = useState<string[]>(() => seedAmenities(detail));

  // Step 3
  const [name,       setName]       = useState(detail.name || `Bathroom ${n}`);
  const [sizeValue,  setSizeValue]  = useState<string>(detail.size_value?.toString() ?? "");
  const [sizeUnit,   setSizeUnit]   = useState<"sqm" | "sqft">(detail.size_unit ?? "sqm");
  const [floorLevel, setFloorLevel] = useState(detail.floor_level ?? "");

  function toggleAmenity(key: string) {
    setAmenities(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  }

  function openStep(s: number) {
    if (stepReached >= s - 1 || s === 1) setCurrentStep(s);
  }

  function advance(from: number, patch: Partial<BathroomDetail>) {
    const newReached = Math.max(stepReached, from);
    startTransition(async () => {
      await saveHomestayBathroomDetail(hotelId, n, { ...patch, step_reached: newReached });
    });
    setStepReached(newReached);
    if (from < 3) setCurrentStep(from + 1);
  }

  function handleSave() {
    startTransition(async () => {
      await saveHomestayBathroomDetail(hotelId, n, {
        name: name.trim(),
        type: accessType === "Private" ? "Private Bathroom" : "Shared Bathroom",
        amenities,
        ...toDetailFields(amenities),
        size_value: sizeValue ? Number(sizeValue) : null,
        size_unit: sizeUnit,
        floor_level: floorLevel,
        step_reached: 3,
      });
      router.push(`/hotel-connect/properties/${hotelId}/edit?tab=4`);
    });
  }

  const has = (key: string) => amenities.includes(key);
  const toiletrySelected = TOILETRIES_ITEMS.filter(i => has(i.key)).length;
  const towelSelected    = TOWEL_ITEMS.filter(i => has(i.key)).length;
  const generalSelected  = GENERAL_ITEMS.filter(i => has(i.key)).length;
  const otherSelected    = OTHER_ITEMS.filter(i => has(i.key)).length;

  return (
    <div >
      <SectionCard
        title={`Bathroom ${n}`}
        desc={`${total} bathroom${total !== 1 ? "s" : ""} total — edit details for Bathroom ${n}`}
      >
        {/* Back link */}
        <Link
          href={`/hotel-connect/properties/${hotelId}/edit?tab=4`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          <ArrowLeftIcon size={13} weight="bold" />
          Back to Rooms &amp; Spaces
        </Link>

        {/* Vertical steps */}
        <div className="mt-2">

          {/* ── Step 1: Access Info ── */}
          <StepSection
            {...STEPS[0]}
            isActive={currentStep === 1} isCompleted={stepReached >= 1} canOpen={true}
            onOpen={() => openStep(1)}
          >
            {/* Access type cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACCESS_OPTIONS.map(opt => {
                const Icon     = opt.icon;
                const selected = accessType === opt.key;
                return (
                  <button key={opt.key} type="button" onClick={() => setAccessType(opt.key)}
                    className={cn(
                      "relative text-left rounded-xl border-2 p-4 transition-all",
                      selected
                        ? "border-primary-500 bg-primary-50"
                        : "border-neutral-200 bg-white hover:border-primary-200 hover:bg-neutral-50"
                    )}>
                    {selected && (
                      <span className="absolute top-3 right-3">
                        <CheckCircleIcon size={18} weight="fill" className="text-primary-500" />
                      </span>
                    )}
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center mb-3",
                      selected ? "bg-primary-100" : "bg-neutral-100"
                    )}>
                      <Icon size={18} className={selected ? "text-primary-600" : "text-neutral-500"} />
                    </div>
                    <p className={cn("text-sm font-semibold mb-1", selected ? "text-primary-700" : "text-neutral-800")}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-neutral-500 leading-relaxed">{opt.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Context card */}
            {attachedBedroomName && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-2.5">
                  <MapPinIcon size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">
                      Bathroom {n} is attached to {attachedBedroomName}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                      <InfoIcon size={11} className="shrink-0" />
                      This information was provided by you while adding room details.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Button
              variant="primary" size="sm"
              disabled={!accessType || isPending}
              loading={isPending}
              onClick={() => advance(1, {
                type: accessType === "Private" ? "Private Bathroom" : "Shared Bathroom",
              })}
            >
              {isPending ? "Saving…" : "Next"}
            </Button>
          </StepSection>

          {/* ── Step 2: Amenities ── */}
          <StepSection
            {...STEPS[1]}
            isActive={currentStep === 2} isCompleted={stepReached >= 2} canOpen={stepReached >= 1}
            onOpen={() => openStep(2)}
          >
            {/* Selected preview */}
            {amenities.length > 0 && (
              <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-3">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">
                  Selected ({amenities.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {amenities.map(a => (
                    <span key={a}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                      {a}
                      <button type="button" onClick={() => toggleAmenity(a)} className="hover:text-primary-900">
                        <XIcon size={10} weight="bold" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mandatory */}
            <CategorySection title="Mandatory" badge={[has("Bathtub"), has("Toiletries")].filter(Boolean).length}>
              <div className="space-y-3">
                <button type="button" onClick={() => toggleAmenity("Bathtub")}
                  className={cn(
                    "w-full text-left rounded-xl border-2 p-3 transition-all",
                    has("Bathtub") ? "border-primary-400 bg-primary-50" : "border-neutral-200 bg-white hover:border-primary-200"
                  )}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-neutral-800">Bathtub</p>
                    {has("Bathtub") && <CheckCircleIcon size={16} weight="fill" className="text-primary-500" />}
                  </div>
                </button>

                <div>
                  <button type="button" onClick={() => toggleAmenity("Toiletries")}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-3 transition-all",
                      has("Toiletries") ? "border-primary-400 bg-primary-50" : "border-neutral-200 bg-white hover:border-primary-200"
                    )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">Toiletries</p>
                        <p className="text-xs text-neutral-400 mt-0.5">Includes items like Shampoo, Moisturiser, etc.</p>
                      </div>
                      {has("Toiletries") && <CheckCircleIcon size={16} weight="fill" className="text-primary-500" />}
                    </div>
                  </button>
                  {has("Toiletries") && (
                    <div className="mt-2 ml-3 pl-3 border-l-2 border-primary-200">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-2">Premium Items</p>
                      <div className="flex flex-wrap gap-2">
                        {TOILETRIES_ITEMS.map(item => (
                          <AmenityChip key={item.key} label={item.label} selected={has(item.key)} onClick={() => toggleAmenity(item.key)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CategorySection>

            <CategorySection title="Towels" badge={towelSelected} defaultOpen={towelSelected > 0}>
              <div className="flex flex-wrap gap-2">
                {TOWEL_ITEMS.map(item => (
                  <AmenityChip key={item.key} label={item.label} selected={has(item.key)} onClick={() => toggleAmenity(item.key)} />
                ))}
              </div>
            </CategorySection>

            <CategorySection title="General Services & Fixtures" badge={generalSelected} defaultOpen={generalSelected > 0}>
              <div className="flex flex-wrap gap-2">
                {GENERAL_ITEMS.map(item => (
                  <AmenityChip key={item.key} label={item.label} selected={has(item.key)} onClick={() => toggleAmenity(item.key)} />
                ))}
              </div>
            </CategorySection>

            <CategorySection title="Room Features & Others" badge={otherSelected} defaultOpen={otherSelected > 0}>
              <div className="flex flex-wrap gap-2">
                {OTHER_ITEMS.map(item => (
                  <AmenityChip key={item.key} label={item.label} selected={has(item.key)} onClick={() => toggleAmenity(item.key)} />
                ))}
              </div>
            </CategorySection>

            <Button
              variant="primary" size="sm"
              disabled={isPending}
              loading={isPending}
              onClick={() => advance(2, { amenities, ...toDetailFields(amenities) })}
            >
              {isPending ? "Saving…" : "Next"}
            </Button>
          </StepSection>

          {/* ── Step 3: Additional Details ── */}
          <StepSection
            {...STEPS[2]}
            isActive={currentStep === 3} isCompleted={stepReached >= 3} canOpen={stepReached >= 2}
            onOpen={() => openStep(3)}
          >
            {/* Bathroom Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Bathroom Name</label>
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Master Bathroom"
                className="max-w-sm"
              />
              <p className="text-xs text-neutral-400 mt-1">Give it a descriptive name guests can recognise.</p>
            </div>

            {/* Room Size + Floor Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Room Size <span className="font-normal text-neutral-400">(Optional)</span>
                </label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    value={sizeValue}
                    onChange={e => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setSizeValue(e.target.value); }}
                    placeholder="00"
                    min={0}
                    className="w-20 rounded-r-none border-r-0"
                  />
                  {(["sqm", "sqft"] as const).map(u => (
                    <button
                      key={u} type="button"
                      onClick={() => setSizeUnit(u)}
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

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Floor Level <span className="font-normal text-neutral-400">(Optional)</span>
                </label>
                <SearchSelect
                  value={floorLevel}
                  onChange={setFloorLevel}
                  options={["Ground Floor","1st Floor","2nd Floor","3rd Floor","4th Floor","5th Floor","6th Floor+"]}
                  placeholder="Select"
                  showSearch={false}
                />
              </div>
            </div>

            <Button
              variant="primary" size="sm"
              disabled={isPending || !name.trim()}
              loading={isPending}
              onClick={handleSave}
            >
              {isPending ? "Saving…" : "Save & Continue"}
            </Button>
          </StepSection>

        </div>
      </SectionCard>
    </div>
  );
}
