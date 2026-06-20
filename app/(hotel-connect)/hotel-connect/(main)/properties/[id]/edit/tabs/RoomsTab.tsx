"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BedIcon, PlusIcon, TrashIcon, CheckIcon, ArrowRightIcon, ArrowLeftIcon, WarningIcon, XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/app/lib/utils";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { Card } from "@/app/components/ui/Card";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { createRoom, deleteRoom } from "./room-actions";
import {
  ROOM_TYPES, ROOM_VIEWS, BED_TYPES, MULTI_ROOM_TYPES,
  BATHROOM_FEATURES, MEAL_PLANS, ROOM_AMENITY_GROUPS,
} from "./room-data";

const inputBase =
  "w-full border border-neutral-300 bg-white px-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoomSummary = {
  id: number;
  name: string;
  room_type: string | null;
  num_rooms: number;
  num_bedrooms: number | null;
  is_active: boolean;
};

type BedEntry = { type: string; count: number };
type BedroomGroup = { beds: BedEntry[] };

type RoomFormData = {
  room_type: string;      view_type: string;
  area: string;           area_unit: "sqft" | "sqm";
  name: string;           num_bedrooms: string;
  num_living_rooms: string; num_rooms: string;
  description: string;
  // Section 2
  bedroom_beds: BedroomGroup[];
  living_room_beds: BedroomGroup[];
  base_adults: number;
  max_adults: number;
  base_children: number;
  max_children: number;
  max_occupancy: number;
  extra_bed: boolean;
  extra_bed_capacity: number;
  child_cot_available: boolean;
  // Section 3
  bathroom_type: "private" | "shared" | "";
  bathroom_features: string[];
  // Section 4
  meal_plan: string;
  // Section 5
  room_amenities: string[];
};

type FieldErrors = Partial<Record<string, string>>;

const DEFAULT_FORM: RoomFormData = {
  room_type: "", view_type: "", area: "", area_unit: "sqft",
  name: "", num_bedrooms: "1", num_living_rooms: "", num_rooms: "1", description: "",
  bedroom_beds: [{ beds: [{ type: "King", count: 1 }] }],
  living_room_beds: [],
  base_adults: 2, max_adults: 2, base_children: 0, max_children: 1, max_occupancy: 3,
  extra_bed: false, extra_bed_capacity: 0, child_cot_available: false,
  bathroom_type: "", bathroom_features: [],
  meal_plan: "", room_amenities: [],
};

const SECTIONS = [
  { id: 1, title: "Room Details",                      sub: "Type, size, name and description" },
  { id: 2, title: "Sleeping Arrangement & Occupancy",  sub: "Select bed types and how many guests this room can host" },
  { id: 3, title: "Bathroom Details",                  sub: "Bathroom type and features" },
  { id: 4, title: "Meal Plan",                         sub: "Food and dining options" },
  { id: 5, title: "Amenity Details",                   sub: "In-room amenities" },
];

// ── Bed adult capacity mapping ─────────────────────────────────────────────────

const BED_ADULT_CAP: Record<string, number> = {
  King: 2, Queen: 2, Double: 2, Twin: 2,
  Single: 1, "Bunk Bed": 2, "Sofa Bed": 1,
  "Murphy Bed": 2, Futon: 1, "Water Bed": 2,
};

function calcBaseAdults(groups: BedroomGroup[]): number {
  return groups.reduce(
    (sum, g) => sum + g.beds.reduce((s, b) => s + (BED_ADULT_CAP[b.type] ?? 1) * b.count, 0),
    0,
  );
}

function syncOccupancy(
  bedroom_beds: BedroomGroup[],
  living_room_beds: BedroomGroup[],
  cur: RoomFormData,
): Pick<RoomFormData, "base_adults" | "max_adults" | "max_occupancy"> {
  const base_adults = calcBaseAdults([...bedroom_beds, ...living_room_beds]);
  const max_adults = Math.max(cur.max_adults, base_adults);
  return { base_adults, max_adults, max_occupancy: max_adults + cur.max_children };
}

// ── Section validators ────────────────────────────────────────────────────────

function validateS1(d: RoomFormData): FieldErrors {
  const e: FieldErrors = {};
  if (!d.room_type)  e.room_type = "Room type is required";
  if (!d.name.trim()) e.name     = "Room name is required";
  if (MULTI_ROOM_TYPES.has(d.room_type) && (!d.num_bedrooms || +d.num_bedrooms < 1))
    e.num_bedrooms = "At least 1 bedroom";
  if (!d.num_rooms || +d.num_rooms < 1) e.num_rooms = "At least 1 room";
  return e;
}
function validateS2(d: RoomFormData): FieldErrors {
  const e: FieldErrors = {};
  const hasAnyBed = d.bedroom_beds.some((br) => br.beds.some((b) => b.type));
  if (!hasAnyBed) e.bedroom_beds = "Add at least one bed type";
  if (d.max_adults < 1) e.max_adults = "At least 1 adult";
  return e;
}
function validateS3(d: RoomFormData): FieldErrors {
  const e: FieldErrors = {};
  if (!d.bathroom_type) e.bathroom_type = "Select bathroom type";
  return e;
}
function validateS4(d: RoomFormData): FieldErrors {
  const e: FieldErrors = {};
  if (!d.meal_plan) e.meal_plan = "Select a meal plan";
  return e;
}
const VALIDATORS = [validateS1, validateS2, validateS3, validateS4];

// ── Shared form helpers ───────────────────────────────────────────────────────

function FieldRow({
  label, error, required, hint, children,
}: {
  label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-xs text-neutral-500 -mt-0.5">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function FormRow({
  label, desc, required, error, children,
}: {
  label: string; desc?: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-6 px-5 py-4">
      <div className="w-48 shrink-0 pt-0.5">
        <p className="text-[13px] font-semibold text-neutral-800 leading-snug">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </p>
        {desc && <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{desc}</p>}
        {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function NumberStepper({ value, onChange, min = 0, max = 99 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="size-8 rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center transition-colors">
        <span className="text-base leading-none select-none">−</span>
      </button>
      <span className="w-6 text-center text-sm font-semibold text-neutral-800">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="size-8 rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center transition-colors">
        <span className="text-base leading-none select-none">+</span>
      </button>
    </div>
  );
}

function ChipToggle({ label, selected, onClick }: {
  label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
        selected
          ? "bg-primary-50 border-primary-300 text-primary-700"
          : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300",
      )}>
      {label}
    </button>
  );
}

// ── Step circle ───────────────────────────────────────────────────────────────

function StepCircle({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={cn(
      "size-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-colors",
      done   ? "bg-emerald-500 text-white" :
      active ? "bg-primary-500 text-white ring-4 ring-primary-100" :
               "bg-white border-2 border-neutral-200 text-neutral-400",
    )}>
      {done ? <CheckIcon size={14} weight="bold" /> : n}
    </div>
  );
}

// ── Section 1 — Room Details ──────────────────────────────────────────────────

function Section1({ data, onChange, errors }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; errors: FieldErrors;
}) {
  const isMultiRoom = MULTI_ROOM_TYPES.has(data.room_type);

  function onRoomTypeChange(v: string) {
    const nowMulti = MULTI_ROOM_TYPES.has(v);
    onChange({
      ...data,
      room_type:       v,
      num_bedrooms:    nowMulti ? data.num_bedrooms    : "1",
      num_living_rooms: nowMulti ? data.num_living_rooms : "",
      bedroom_beds:    data.bedroom_beds.length ? data.bedroom_beds : [{ beds: [{ type: "King", count: 1 }] }],
      living_room_beds: nowMulti ? data.living_room_beds : [],
    });
  }

  function setField<K extends keyof RoomFormData>(k: K, v: RoomFormData[K]) {
    if (k === "num_bedrooms") {
      const count = Math.max(1, parseInt(v as string) || 1);
      const curr = data.bedroom_beds;
      const bedroom_beds = count > curr.length
        ? [...curr, ...Array.from({ length: count - curr.length }, () => ({ beds: [{ type: "", count: 1 }] }))]
        : curr.slice(0, count);
      onChange({ ...data, [k]: v, bedroom_beds });
      return;
    }
    if (k === "num_living_rooms") {
      const count = Math.max(0, parseInt(v as string) || 0);
      const curr = data.living_room_beds;
      const living_room_beds = count > curr.length
        ? [...curr, ...Array.from({ length: count - curr.length }, () => ({ beds: [{ type: "", count: 1 }] }))]
        : curr.slice(0, count);
      onChange({ ...data, [k]: v, living_room_beds });
      return;
    }
    onChange({ ...data, [k]: v });
  }

  return (
    <div className="divide-y divide-neutral-100">
      <FormRow label="Room Type" required desc="Category of the room, e.g. Apartment, Suite, Villa" error={errors.room_type}>
        <SearchSelect
          options={ROOM_TYPES}
          value={data.room_type}
          onChange={onRoomTypeChange}
          placeholder="Select room type"
          error={!!errors.room_type}
        />
      </FormRow>

      <FormRow label="Room View" desc="Primary view visible from the room windows">
        <SearchSelect
          options={ROOM_VIEWS}
          value={data.view_type}
          onChange={(v) => setField("view_type", v)}
          placeholder="Select view"
        />
      </FormRow>

      <FormRow label="Room Size" desc="Total carpet area of the room">
        <div className="flex gap-2">
          <input
            type="number"
            value={data.area}
            onChange={(e) => setField("area", e.target.value)}
            placeholder="e.g. 350"
            className={cn(inputBase, "h-10 rounded-lg text-sm flex-1")}
          />
          <div className="flex rounded-lg border border-neutral-300 overflow-hidden shrink-0 h-10 bg-white">
            {(["sqft", "sqm"] as const).map((u) => (
              <button key={u} type="button" onClick={() => setField("area_unit", u)}
                className={cn(
                  "px-3 text-sm font-medium transition-colors",
                  data.area_unit === u ? "bg-primary-500 text-white" : "text-neutral-600 hover:bg-neutral-50",
                )}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </FormRow>

      <FormRow label="Room Name" required desc="Name displayed to travellers on booking platforms" error={errors.name}>
        <input
          value={data.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="e.g. Deluxe King Room"
          aria-invalid={!!errors.name}
          className={cn(inputBase, "h-10 rounded-lg text-sm", errors.name && "border-red-400")}
        />
      </FormRow>

      {isMultiRoom && (
        <>
          <FormRow label="No. of Bedrooms" required desc="Number of separate bedroom spaces in the unit" error={errors.num_bedrooms}>
            <input
              type="number"
              value={data.num_bedrooms}
              onChange={(e) => setField("num_bedrooms", e.target.value)}
              placeholder="1"
              aria-invalid={!!errors.num_bedrooms}
              className={cn(inputBase, "h-10 rounded-lg text-sm", errors.num_bedrooms && "border-red-400")}
            />
          </FormRow>
          <FormRow label="No. of Living Rooms" desc="Separate living or sitting areas, if any">
            <input
              type="number"
              value={data.num_living_rooms}
              onChange={(e) => setField("num_living_rooms", e.target.value)}
              placeholder="0"
              className={cn(inputBase, "h-10 rounded-lg text-sm")}
            />
          </FormRow>
        </>
      )}

      <FormRow label="No. of Rooms" required desc="Total inventory of this room type at the property" error={errors.num_rooms}>
        <input
          type="number"
          value={data.num_rooms}
          onChange={(e) => setField("num_rooms", e.target.value)}
          placeholder="1"
          aria-invalid={!!errors.num_rooms}
          className={cn(inputBase, "h-10 rounded-lg text-sm", errors.num_rooms && "border-red-400")}
        />
      </FormRow>

      <FormRow label="Description" desc="Additional highlights or features to show guests">
        <textarea
          value={data.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={3}
          placeholder="Briefly describe this room type..."
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 resize-none"
        />
      </FormRow>
    </div>
  );
}

// ── Section 2 — Sleeping Arrangement & Occupancy ──────────────────────────────

function BedroomCard({
  label, isOptional, beds, canDelete,
  onDelete, onUpdateBed, onAddBed, onRemoveBed, error,
}: {
  label?: string;
  isOptional?: boolean;
  beds: BedEntry[];
  canDelete: boolean;
  onDelete: () => void;
  onUpdateBed: (i: number, field: keyof BedEntry, value: string | number) => void;
  onAddBed: () => void;
  onRemoveBed: (i: number) => void;
  error?: string;
}) {
  return (
    <div className="px-5 py-4">
      {label && (
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className={cn("text-sm font-semibold", isOptional ? "text-neutral-600" : "text-neutral-800")}>
              {label}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Select the types of beds available in this room
            </p>
          </div>
          {canDelete && (
            <button type="button" onClick={onDelete}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 shrink-0 ml-4">
              Delete {isOptional ? "Living Room" : "Bedroom"}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {beds.map((bed, i) => (
          <div key={i}>
            <div className="flex items-end gap-2">
              {/* Bed type dropdown */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-neutral-500 mb-1.5">Bed Type {i + 1}</p>
                <SearchSelect
                  options={BED_TYPES}
                  value={bed.type}
                  onChange={(v) => onUpdateBed(i, "type", v)}
                  placeholder="Select bed"
                  showSearch={false}
                />
              </div>

              {/* Remove bed button */}
              {beds.length > 1 && (
                <button type="button" onClick={() => onRemoveBed(i)}
                  className="size-10 rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0 mb-0.5">
                  <XIcon size={14} />
                </button>
              )}

              {/* Number of beds */}
              <div className="shrink-0">
                <p className="text-xs font-medium text-neutral-500 mb-1.5">Number of beds</p>
                <NumberStepper
                  value={bed.count}
                  onChange={(v) => onUpdateBed(i, "count", v)}
                  min={0} max={10}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={onAddBed}
        className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
        <PlusIcon size={13} weight="bold" />
        Add Another Bed Type
      </button>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

function Section2({ data, onChange, errors }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; errors: FieldErrors;
}) {
  const isMultiRoom = MULTI_ROOM_TYPES.has(data.room_type);

  function updateBedroomBed(brIdx: number, bedIdx: number, field: keyof BedEntry, value: string | number) {
    const bedroom_beds = data.bedroom_beds.map((br, i) => i !== brIdx ? br : {
      beds: br.beds.map((b, j) => j !== bedIdx ? b : { ...b, [field]: field === "count" ? Number(value) : value }),
    });
    onChange({ ...data, bedroom_beds, ...syncOccupancy(bedroom_beds, data.living_room_beds, data) });
  }
  function addBedToBedroom(brIdx: number) {
    const bedroom_beds = data.bedroom_beds.map((br, i) =>
      i !== brIdx ? br : { beds: [...br.beds, { type: "", count: 1 }] }
    );
    onChange({ ...data, bedroom_beds });
  }
  function removeBedFromBedroom(brIdx: number, bedIdx: number) {
    const bedroom_beds = data.bedroom_beds.map((br, i) =>
      i !== brIdx ? br : { beds: br.beds.filter((_, j) => j !== bedIdx) }
    );
    onChange({ ...data, bedroom_beds, ...syncOccupancy(bedroom_beds, data.living_room_beds, data) });
  }
  function deleteBedroom(brIdx: number) {
    const bedroom_beds = data.bedroom_beds.filter((_, i) => i !== brIdx);
    onChange({ ...data, bedroom_beds, num_bedrooms: String(bedroom_beds.length), ...syncOccupancy(bedroom_beds, data.living_room_beds, data) });
  }

  function updateLivingRoomBed(lrIdx: number, bedIdx: number, field: keyof BedEntry, value: string | number) {
    const living_room_beds = data.living_room_beds.map((lr, i) => i !== lrIdx ? lr : {
      beds: lr.beds.map((b, j) => j !== bedIdx ? b : { ...b, [field]: field === "count" ? Number(value) : value }),
    });
    onChange({ ...data, living_room_beds, ...syncOccupancy(data.bedroom_beds, living_room_beds, data) });
  }
  function addBedToLivingRoom(lrIdx: number) {
    const living_room_beds = data.living_room_beds.map((lr, i) =>
      i !== lrIdx ? lr : { beds: [...lr.beds, { type: "", count: 1 }] }
    );
    onChange({ ...data, living_room_beds });
  }
  function removeBedFromLivingRoom(lrIdx: number, bedIdx: number) {
    const living_room_beds = data.living_room_beds.map((lr, i) =>
      i !== lrIdx ? lr : { beds: lr.beds.filter((_, j) => j !== bedIdx) }
    );
    onChange({ ...data, living_room_beds, ...syncOccupancy(data.bedroom_beds, living_room_beds, data) });
  }
  function deleteLivingRoom(lrIdx: number) {
    const living_room_beds = data.living_room_beds.filter((_, i) => i !== lrIdx);
    onChange({ ...data, living_room_beds, num_living_rooms: String(living_room_beds.length), ...syncOccupancy(data.bedroom_beds, living_room_beds, data) });
  }

  function setOcc(key: "base_adults" | "max_adults" | "base_children" | "max_children" | "max_occupancy", v: number) {
    const updated = { ...data, [key]: v };
    if (key === "max_adults" || key === "max_children") {
      updated.max_occupancy = updated.max_adults + updated.max_children;
    }
    onChange(updated);
  }

  return (
    <div className="divide-y divide-neutral-100">

      {/* Bed config sub-header */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-sm font-semibold text-neutral-800">
          Select the bed type for all the bedrooms below
        </p>
      </div>

      {/* Bedroom cards */}
      {data.bedroom_beds.map((br, brIdx) => (
        <BedroomCard
          key={brIdx}
          label={isMultiRoom ? `Bedroom ${brIdx + 1}` : undefined}
          isOptional={false}
          beds={br.beds}
          canDelete={isMultiRoom && data.bedroom_beds.length > 1}
          onDelete={() => deleteBedroom(brIdx)}
          onUpdateBed={(bi, f, v) => updateBedroomBed(brIdx, bi, f, v)}
          onAddBed={() => addBedToBedroom(brIdx)}
          onRemoveBed={(bi) => removeBedFromBedroom(brIdx, bi)}
          error={brIdx === 0 ? errors.bedroom_beds : undefined}
        />
      ))}

      {/* Living room cards */}
      {data.living_room_beds.map((lr, lrIdx) => (
        <BedroomCard
          key={`lr-${lrIdx}`}
          label={`Living Room ${lrIdx + 1} (Optional)`}
          isOptional={true}
          beds={lr.beds}
          canDelete={true}
          onDelete={() => deleteLivingRoom(lrIdx)}
          onUpdateBed={(bi, f, v) => updateLivingRoomBed(lrIdx, bi, f, v)}
          onAddBed={() => addBedToLivingRoom(lrIdx)}
          onRemoveBed={(bi) => removeBedFromLivingRoom(lrIdx, bi)}
        />
      ))}

      {/* Extra bed — radio */}
      <FormRow label="Can this room/unit accommodate extra bed(s)?">
        <div className="flex items-center gap-6">
          {[{ v: false, label: "No" }, { v: true, label: "Yes" }].map(({ v, label }) => (
            <label key={String(v)} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="extra_bed"
                checked={data.extra_bed === v}
                onChange={() => onChange({ ...data, extra_bed: v })}
                className="h-4 w-4 accent-primary-500 cursor-pointer"
              />
              <span className="text-sm text-neutral-700">{label}</span>
            </label>
          ))}
        </div>
        {data.extra_bed && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-neutral-600">Extra bed capacity</span>
            <NumberStepper
              value={data.extra_bed_capacity}
              onChange={(v) => onChange({ ...data, extra_bed_capacity: v })}
              min={0} max={5}
            />
          </div>
        )}
      </FormRow>

      {/* Child cot — radio */}
      <FormRow label="Child cot / crib available?" desc="Can a cot or crib be added on request?">
        <div className="flex items-center gap-6">
          {[{ v: false, label: "No" }, { v: true, label: "Yes" }].map(({ v, label }) => (
            <label key={String(v)} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="child_cot"
                checked={data.child_cot_available === v}
                onChange={() => onChange({ ...data, child_cot_available: v })}
                className="h-4 w-4 accent-primary-500 cursor-pointer"
              />
              <span className="text-sm text-neutral-700">{label}</span>
            </label>
          ))}
        </div>
      </FormRow>

      {/* Occupancy */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-sm font-semibold text-neutral-800 mb-0.5">Occupancy</p>
        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
          Occupancy details have been pre-filled based on the selected bed arrangement above
        </p>
        <div className="rounded-xl border border-neutral-200 divide-y divide-neutral-100 overflow-hidden bg-white">
          {([
            { key: "base_adults"   as const, label: "Base adults",       desc: "Ideal number of adults supported by the standard sleeping arrangement",      highlight: true  },
            { key: "max_adults"    as const, label: "Maximum adults",     desc: "Maximum number of adults that can be accommodated in this room",             highlight: false },
            { key: "base_children" as const, label: "Base children",      desc: "Maximum number of free children that can be accommodated in this room",      highlight: true  },
            { key: "max_children"  as const, label: "Maximum children",   desc: "Maximum number of children that can be accommodated in this room",           highlight: false },
            { key: "max_occupancy" as const, label: "Maximum occupancy",  desc: "Maximum number of guests that can be accommodated in this room",             highlight: false },
          ]).map(({ key, label, desc, highlight }) => (
            <div key={key} className={cn("flex items-start justify-between px-4 py-3.5", highlight && "bg-neutral-50/60")}>
              <div className="flex-1 mr-6 min-w-0">
                <p className="text-sm font-medium text-neutral-800">{label}</p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
              <NumberStepper
                value={data[key] as number}
                onChange={(v) => setOcc(key, v)}
                min={0} max={20}
              />
            </div>
          ))}
        </div>
        {errors.max_adults && (
          <p className="text-xs text-red-500 mt-2">{errors.max_adults}</p>
        )}
      </div>

    </div>
  );
}

// ── Section 3 — Bathroom Details ──────────────────────────────────────────────

function Section3({ data, onChange, errors }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; errors: FieldErrors;
}) {
  const set = <K extends keyof RoomFormData>(k: K, v: RoomFormData[K]) => onChange({ ...data, [k]: v });

  function toggleFeature(f: string) {
    const cur = data.bathroom_features;
    set("bathroom_features", cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]);
  }

  return (
    <div className="px-5 pt-5 pb-4 space-y-4">
      <FieldRow label="Bathroom Type" required error={errors.bathroom_type}>
        <div className="space-y-2">
          {[
            { value: "private", label: "Private",  desc: "Each room has its own dedicated bathroom" },
            { value: "shared",  label: "Shared",   desc: "Bathroom is shared between multiple rooms" },
          ].map((opt) => (
            <label key={opt.value}
              className={cn(
                "flex items-start gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
                data.bathroom_type === opt.value
                  ? "border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white hover:border-neutral-300",
              )}>
              <input
                type="radio"
                name="bathroom_type"
                value={opt.value}
                checked={data.bathroom_type === opt.value}
                onChange={() => set("bathroom_type", opt.value as "private" | "shared")}
                className="mt-0.5 h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-neutral-800">{opt.label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="Bathroom Features">
        <div className="flex flex-wrap gap-2">
          {BATHROOM_FEATURES.map((f) => (
            <ChipToggle key={f} label={f}
              selected={data.bathroom_features.includes(f)}
              onClick={() => toggleFeature(f)}
            />
          ))}
        </div>
      </FieldRow>
    </div>
  );
}

// ── Section 4 — Meal Plan ─────────────────────────────────────────────────────

function Section4({ data, onChange, errors }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; errors: FieldErrors;
}) {
  const set = <K extends keyof RoomFormData>(k: K, v: RoomFormData[K]) => onChange({ ...data, [k]: v });

  return (
    <div className="px-5 pt-5 pb-4">
      <FieldRow label="Meal Plan Offered" required error={errors.meal_plan}>
        <div className="space-y-2">
          {MEAL_PLANS.map((plan) => (
            <label key={plan.value}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all",
                data.meal_plan === plan.value
                  ? "border-primary-400 bg-primary-50"
                  : "border-neutral-200 bg-white hover:border-neutral-300",
              )}>
              <input
                type="radio"
                name="meal_plan"
                value={plan.value}
                checked={data.meal_plan === plan.value}
                onChange={() => set("meal_plan", plan.value)}
                className="h-4 w-4 accent-primary-500 cursor-pointer shrink-0"
              />
              <span className="text-sm font-medium text-neutral-800">{plan.label}</span>
            </label>
          ))}
        </div>
      </FieldRow>
    </div>
  );
}

// ── Section 5 — Amenity Details ───────────────────────────────────────────────

function Section5({ data, onChange }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void;
}) {
  function toggle(item: string) {
    const cur = data.room_amenities;
    onChange({ ...data, room_amenities: cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item] });
  }

  function toggleGroup(items: string[], selectAll: boolean) {
    const cur = data.room_amenities;
    onChange({
      ...data,
      room_amenities: selectAll
        ? [...new Set([...cur, ...items])]
        : cur.filter((x) => !items.includes(x)),
    });
  }

  return (
    <div className="px-5 pt-5 pb-4 space-y-5">
      {ROOM_AMENITY_GROUPS.map((group) => {
        const allSelected = group.items.every((i) => data.room_amenities.includes(i));
        return (
          <div key={group.label}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-neutral-700">{group.label}</label>
              <button type="button" onClick={() => toggleGroup(group.items, !allSelected)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                {allSelected ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.items.map((item) => (
                <ChipToggle key={item} label={item}
                  selected={data.room_amenities.includes(item)}
                  onClick={() => toggle(item)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {data.room_amenities.length > 0 && (
        <p className="text-xs text-neutral-400">
          {data.room_amenities.length} amenit{data.room_amenities.length === 1 ? "y" : "ies"} selected
        </p>
      )}
    </div>
  );
}

// ── Step summary ──────────────────────────────────────────────────────────────

function stepSummary(id: number, d: RoomFormData): string {
  switch (id) {
    case 1:
      return [d.name, d.room_type, d.num_bedrooms && MULTI_ROOM_TYPES.has(d.room_type) ? `${d.num_bedrooms} bedroom${+d.num_bedrooms !== 1 ? "s" : ""}` : null]
        .filter(Boolean).join(" · ");
    case 2: {
      const firstBed = d.bedroom_beds[0]?.beds[0];
      const bedSummary = firstBed?.type ? `${firstBed.count} ${firstBed.type}` : "";
      return [bedSummary, `${d.max_adults} adult${d.max_adults !== 1 ? "s" : ""}`, `${d.max_children} child${d.max_children !== 1 ? "ren" : ""}`]
        .filter(Boolean).join(" · ");
    }
    case 3:
      return [d.bathroom_type === "private" ? "Private bathroom" : "Shared bathroom", d.bathroom_features.length ? `${d.bathroom_features.length} features` : null]
        .filter(Boolean).join(" · ");
    case 4:
      return MEAL_PLANS.find((p) => p.value === d.meal_plan)?.label.split(" — ")[0] ?? d.meal_plan;
    case 5:
      return d.room_amenities.length ? `${d.room_amenities.length} amenities selected` : "No amenities selected";
    default: return "";
  }
}

// ── Create Room Form ──────────────────────────────────────────────────────────

function CreateRoomForm({ hotelId, onDone }: { hotelId: number; onDone: () => void }) {
  const router = useRouter();
  const [step, setStep]               = useState(1);
  const [data, setData]               = useState<RoomFormData>(DEFAULT_FORM);
  const [errors, setErrors]           = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [isPending, startTransition]  = useTransition();

  function advance() {
    if (step < 5) {
      const errs = VALIDATORS[step - 1]?.(data) ?? {};
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      setErrors({});
      setStep(step + 1);
    } else {
      handleSave();
    }
  }

  function handleSave() {
    for (const v of VALIDATORS) {
      const errs = v(data);
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    }
    startTransition(async () => {
      setGlobalError("");
      const result = await createRoom(hotelId, {
        ...data,
        area:             data.area !== "" ? Number(data.area) : undefined,
        num_bedrooms:     Number(data.num_bedrooms),
        num_living_rooms: data.num_living_rooms !== "" ? Number(data.num_living_rooms) : undefined,
        num_rooms:        Number(data.num_rooms),
        bathroom_type:    data.bathroom_type as "private" | "shared",
      });
      if (result.roomId) {
        router.refresh();
        onDone();
      } else if (result.error) {
        setGlobalError(result.error);
      } else if (result.errors) {
        const flat: FieldErrors = {};
        for (const [k, msgs] of Object.entries(result.errors)) flat[k] = (msgs as string[])[0];
        setErrors(flat);
      }
    });
  }

  function sectionContent(s: number) {
    switch (s) {
      case 1: return <Section1 data={data} onChange={setData} errors={errors} />;
      case 2: return <Section2 data={data} onChange={setData} errors={errors} />;
      case 3: return <Section3 data={data} onChange={setData} errors={errors} />;
      case 4: return <Section4 data={data} onChange={setData} errors={errors} />;
      case 5: return <Section5 data={data} onChange={setData} />;
      default: return null;
    }
  }

  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <div className="px-5 py-3.5 border-b border-neutral-200 bg-linear-to-b rounded-t-[inherit] bg-neutral-50">
        <h3 className="text-sm font-semibold text-neutral-800">Create Room</h3>
        <p className="text-xs text-neutral-600/90 mt-0.5">Complete all sections to add a room type</p>
      </div>

      <div className="divide-y divide-neutral-100 bg-white">
        {SECTIONS.map((sec) => {
          const isActive = sec.id === step;
          const isDone   = sec.id < step;
          const isLocked = sec.id > step;

          return (
            <div key={sec.id}>
              <div className="flex items-center gap-3 px-5 py-4">
                <StepCircle n={sec.id} active={isActive} done={isDone} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold leading-snug", isLocked ? "text-neutral-400" : "text-neutral-800")}>
                    {sec.title}
                  </p>
                  <p className={cn("text-xs mt-0.5 truncate", isDone ? "text-neutral-500" : isLocked ? "text-neutral-400" : "text-neutral-500")}>
                    {isDone ? stepSummary(sec.id, data) : sec.sub}
                  </p>
                </div>
                {isDone && (
                  <button type="button"
                    onClick={() => { setErrors({}); setStep(sec.id); }}
                    className="shrink-0 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                    Edit
                  </button>
                )}
              </div>

              {isActive && (
                <div className="border-t border-neutral-100">
                  {globalError && (
                    <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <WarningIcon size={15} className="shrink-0" />
                      {globalError}
                    </div>
                  )}
                  {sectionContent(sec.id)}
                  <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-100">
                    <button type="button" onClick={onDone}
                      className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
                      Cancel
                    </button>
                    <div className="flex items-center gap-3">
                      {step > 1 && (
                        <button type="button" onClick={() => { setErrors({}); setStep(step - 1); }}
                          className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 font-medium transition-colors">
                          <ArrowLeftIcon size={13} weight="bold" />
                          Back
                        </button>
                      )}
                      <button type="button" onClick={advance} disabled={isPending}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-60 transition-colors">
                        {isPending ? "Saving…" : step === 5 ? "Save Room" : "Next"}
                        {!isPending && step < 5 && <ArrowRightIcon size={13} weight="bold" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Rooms list ────────────────────────────────────────────────────────────────

function EmptyRooms({ onAdd }: { onAdd: () => void }) {
  return (
    <SectionCard title="Room Types" desc="Add and manage the room types available at your property">
      <div className="flex flex-col items-center py-10 text-center">
        <div className="size-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
          <BedIcon size={24} className="text-neutral-400" />
        </div>
        <p className="text-sm font-semibold text-neutral-700 mb-1">No rooms added yet</p>
        <p className="text-xs text-neutral-500 max-w-xs mb-5">
          Add your first room type to showcase what&apos;s available at your property.
        </p>
        <button type="button" onClick={onAdd}
          className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors">
          <PlusIcon size={14} weight="bold" />
          Create Room Type
        </button>
      </div>
    </SectionCard>
  );
}

function RoomsList({ hotelId, rooms, onAdd }: { hotelId: number; rooms: RoomSummary[]; onAdd: () => void }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function handleDelete(roomId: number) {
    setDeletingId(roomId);
    await deleteRoom(hotelId, roomId);
    router.refresh();
    setDeletingId(null);
  }

  return (
    <SectionCard title="Room Types" desc="Add and manage the room types available at your property">
      <div className="flex items-center justify-between -mt-1 mb-1">
        <p className="text-xs text-neutral-500">{rooms.length} room type{rooms.length !== 1 ? "s" : ""} added</p>
        <button type="button" onClick={onAdd}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-primary-300 bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 transition-colors">
          <PlusIcon size={11} weight="bold" />
          Add Room
        </button>
      </div>
      <div className="space-y-2">
        {rooms.map((room) => (
          <div key={room.id}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                <BedIcon size={16} className="text-neutral-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{room.name}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {[
                    room.room_type,
                    room.num_bedrooms != null ? `${room.num_bedrooms} bedroom${room.num_bedrooms !== 1 ? "s" : ""}` : null,
                    `${room.num_rooms} unit${room.num_rooms !== 1 ? "s" : ""}`,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckIcon size={11} weight="bold" />
                Added
              </span>
              <button type="button" onClick={() => handleDelete(room.id)} disabled={deletingId === room.id}
                className="size-8 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-40">
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RoomsTab({ hotelId, rooms }: { hotelId: number; rooms: RoomSummary[] }) {
  const [creating, setCreating] = useState(false);

  if (creating) {
    return <CreateRoomForm hotelId={hotelId} onDone={() => setCreating(false)} />;
  }

  return rooms.length === 0
    ? <EmptyRooms onAdd={() => setCreating(true)} />
    : <RoomsList hotelId={hotelId} rooms={rooms} onAdd={() => setCreating(true)} />;
}
