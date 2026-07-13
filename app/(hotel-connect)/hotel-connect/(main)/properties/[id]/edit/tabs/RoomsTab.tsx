"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BedIcon, PlusIcon, TrashIcon, CheckIcon, ArrowRightIcon, ArrowLeftIcon, WarningIcon, XIcon,
  CaretDownIcon, CaretUpIcon, LockSimpleIcon, ImageIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/app/lib/utils";
import SectionCard from "@/app/(hotel-connect)/hotel-connect/(main)/components/SectionCard";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/input";
import { Textarea } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/textarea";
import { SearchSelect, MultiSearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import DateRangePickerField, { type DateRangeValue } from "@/app/components/ui/DateRangePickerField";
import { createRoom, updateRoom, deleteRoom, fetchRoomForEdit, type RoomEditPayload } from "./room-actions";
import { listRoomPhotos, uploadRoomPhotos, deleteRoomPhoto, type RoomPhoto } from "./room-photo-actions";

const MIN_ROOM_PHOTOS = 2;
import {
  ROOM_TYPES, GUEST_HOUSE_ROOM_TYPES, ROOM_VIEWS, BED_TYPES, MULTI_ROOM_TYPES,
  MEAL_PLANS, ROOM_AMENITY_GROUPS, ROOM_MANDATORY_CONFIG, ROOM_POPULAR_CONFIG, ROOM_FEATURES_CONFIG, ROOM_FOOD_DRINKS_CONFIG, ROOM_KITCHEN_CONFIG, ROOM_BEDS_BLANKET_CONFIG, ROOM_OTHER_FACILITIES_CONFIG, type RoomAmenityConfig,
} from "./room-data";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoomSummary = {
  id: number;
  name: string;
  room_type: string | null;
  num_rooms: number;
  num_bedrooms: number | null;
  is_active: boolean;
  photoCount: number;
};

type BedEntry = { type: string; count: number };
type BedroomGroup = { beds: BedEntry[] };
type BathroomEntry = { type: "bathroom" | "powder_room"; attached_to: string };

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
  bathrooms: BathroomEntry[];
  // Section 4
  meal_plan: string;
  base_rate: string;
  extra_adult_charge: string;
  paid_child_charge: string;
  rate_start_date: string;
  rate_end_date: string;
  // Section 5
  room_amenities: string[];
  room_amenity_details: Record<string, string | string[]>;
  room_mandatory_noes: string[]; // mandatory items explicitly set to No (UI tracking only)
};

type FieldErrors = Partial<Record<string, string>>;

const DEFAULT_FORM: RoomFormData = {
  room_type: "", view_type: "", area: "", area_unit: "sqft",
  name: "", num_bedrooms: "1", num_living_rooms: "", num_rooms: "1", description: "",
  bedroom_beds: [{ beds: [{ type: "King", count: 1 }] }],
  living_room_beds: [],
  base_adults: 2, max_adults: 2, base_children: 0, max_children: 1, max_occupancy: 3,
  extra_bed: false, extra_bed_capacity: 0, child_cot_available: false,
  bathrooms: [{ type: "bathroom", attached_to: "bedroom_1" }],
  meal_plan: "", base_rate: "", extra_adult_charge: "", paid_child_charge: "",
  rate_start_date: "", rate_end_date: "",
  room_amenities: [],
  room_amenity_details: {},
  room_mandatory_noes: [],
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
  if (d.bathrooms.length === 0) e.bathrooms = "Add at least one bathroom";
  d.bathrooms.forEach((b, i) => {
    if (!b.attached_to) e[`bathroom_attached_to_${i}`] = "Select which room";
  });
  return e;
}
function validateS4(d: RoomFormData): FieldErrors {
  const e: FieldErrors = {};
  if (!d.meal_plan) e.meal_plan = "Select a meal plan";
  if (!d.base_rate || Number(d.base_rate) <= 0) e.base_rate = "Enter a valid base rate";
  if (!d.rate_start_date) e.rate_start_date = "Select start date";
  if (!d.rate_end_date)   e.rate_end_date   = "Select end date";
  if (d.rate_start_date && d.rate_end_date && d.rate_end_date < d.rate_start_date)
    e.rate_end_date = "End date must be after start date";
  return e;
}
function validateS5(d: RoomFormData): FieldErrors {
  const e: FieldErrors = {};
  const unanswered = ROOM_MANDATORY_CONFIG.filter(
    (c) => !d.room_amenities.includes(c.name) && !d.room_mandatory_noes.includes(c.name)
  );
  if (unanswered.length > 0) {
    e._mandatory = `${unanswered.length} mandatory amenit${unanswered.length === 1 ? "y has" : "ies have"} no answer. Select Yes or No for every item in the Mandatory category.`;
    return e;
  }
  const yesCount = ROOM_MANDATORY_CONFIG.filter((c) => d.room_amenities.includes(c.name)).length;
  if (yesCount < 3) {
    e._mandatory = `At least 3 mandatory amenities must be marked "Yes". Currently only ${yesCount} ${yesCount === 1 ? "is" : "are"} selected.`;
  }
  return e;
}
const VALIDATORS = [validateS1, validateS2, validateS3, validateS4, validateS5];

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

function Section1({ data, onChange, errors, roomTypes }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; errors: FieldErrors; roomTypes: string[];
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
          options={roomTypes}
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
          <Input
            type="number"
            value={data.area}
            onChange={(e) => setField("area", e.target.value)}
            placeholder="e.g. 350"
            className="flex-1"
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
        <Input
          value={data.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="e.g. Deluxe King Room"
          aria-invalid={!!errors.name}
        />
      </FormRow>

      {isMultiRoom && (
        <>
          <FormRow label="No. of Bedrooms" required desc="Number of separate bedroom spaces in the unit" error={errors.num_bedrooms}>
            <Input
              type="number"
              value={data.num_bedrooms}
              onChange={(e) => setField("num_bedrooms", e.target.value)}
              placeholder="1"
              aria-invalid={!!errors.num_bedrooms}
            />
          </FormRow>
          <FormRow label="No. of Living Rooms" desc="Separate living or sitting areas, if any">
            <Input
              type="number"
              value={data.num_living_rooms}
              onChange={(e) => setField("num_living_rooms", e.target.value)}
              placeholder="0"
            />
          </FormRow>
        </>
      )}

      <FormRow label="No. of Rooms" required desc="Total inventory of this room type at the property" error={errors.num_rooms}>
        <Input
          type="number"
          value={data.num_rooms}
          onChange={(e) => setField("num_rooms", e.target.value)}
          placeholder="1"
          aria-invalid={!!errors.num_rooms}
        />
      </FormRow>

      <FormRow label="Description" desc="Additional highlights or features to show guests">
        <Textarea
          value={data.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={3}
          placeholder="Briefly describe this room type..."
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
                <button type="button" onClick={() => onRemoveBed(i)} aria-label={`Remove bed type ${i + 1}`}
                  className="size-10 rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0 mb-0.5">
                  <XIcon size={14} aria-hidden="true" />
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
    // Max can never be reduced below the bed-computed base — otherwise a
    // manual edit here can reach the DB inconsistent with room-schema's own
    // max_adults >= base_adults / max_children >= base_children rule.
    const clamped = key === "max_adults" ? Math.max(v, data.base_adults)
      : key === "max_children" ? Math.max(v, data.base_children)
      : v;
    const updated = { ...data, [key]: clamped };
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
        <Card variant="default" radius="sm" padding="none" className="divide-y divide-neutral-100 overflow-hidden">
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
        </Card>
        {errors.max_adults && (
          <p className="text-xs text-red-500 mt-2">{errors.max_adults}</p>
        )}
      </div>

    </div>
  );
}

// ── Section 3 — Bathroom Details ──────────────────────────────────────────────

const BATHROOM_TYPE_OPTIONS = [
  { value: "bathroom",    label: "Bathroom",    sub: "Toilet, Sink & Shower" },
  { value: "powder_room", label: "Powder room", sub: "Toilet & Sink Only"    },
] as const;

function BathroomTypeDropdown({ value, onChange }: {
  value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selected = BATHROOM_TYPE_OPTIONS.find((t) => t.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-white text-left transition-colors",
          open ? "border-primary-400 ring-2 ring-primary-100" : "border-neutral-300 hover:border-neutral-400",
        )}
      >
        <span className="flex flex-col min-w-0">
          {selected ? (
            <>
              <span className="text-sm font-medium text-neutral-800 leading-tight">{selected.label}</span>
              <span className="text-xs text-neutral-500 leading-tight">{selected.sub}</span>
            </>
          ) : (
            <span className="text-sm text-neutral-400">Select type</span>
          )}
        </span>
        <CaretDownIcon size={14} className={cn("text-neutral-400 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-neutral-200 rounded-xl shadow-lg overflow-hidden">
          {BATHROOM_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full text-left px-4 py-3 flex flex-col gap-0.5 transition-colors",
                value === opt.value ? "bg-primary-50" : "hover:bg-neutral-50",
              )}
            >
              <span className="text-sm font-medium text-neutral-800">{opt.label}</span>
              <span className="text-xs text-neutral-500">{opt.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getRoomOptions(data: RoomFormData): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const numBR = parseInt(data.num_bedrooms) || 1;
  const numLR = parseInt(data.num_living_rooms) || 0;
  for (let i = 1; i <= numBR; i++) opts.push({ value: `bedroom_${i}`, label: `Bedroom ${i}` });
  for (let i = 1; i <= numLR; i++) opts.push({ value: `living_room_${i}`, label: `Living Room ${i}` });
  return opts;
}

function Section3({ data, onChange, errors }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; errors: FieldErrors;
}) {
  const set = <K extends keyof RoomFormData>(k: K, v: RoomFormData[K]) => onChange({ ...data, [k]: v });
  const roomOptions = getRoomOptions(data);

  function addBathroom() {
    set("bathrooms", [
      ...data.bathrooms,
      { type: "bathroom", attached_to: roomOptions[0]?.value ?? "bedroom_1" },
    ]);
  }

  function removeBathroom(i: number) {
    set("bathrooms", data.bathrooms.filter((_, idx) => idx !== i));
  }

  function updateBathroom(i: number, key: keyof BathroomEntry, value: string) {
    set("bathrooms", data.bathrooms.map((b, idx) =>
      idx === i ? { ...b, [key]: value } : b,
    ));
  }

  return (
    <div className="px-5 pt-5 pb-4 space-y-3">
      {data.bathrooms.map((bathroom, i) => (
        <div key={i} className="border border-neutral-200 rounded-xl">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-100 rounded-t-xl">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Bathroom {i + 1}
            </span>
            {data.bathrooms.length > 1 && (
              <button
                type="button"
                onClick={() => removeBathroom(i)}
                className="text-xs text-red-500 hover:text-red-700 transition-colors font-medium"
              >
                Remove
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Bathroom Type <span className="text-red-400">*</span>
              </label>
              <BathroomTypeDropdown
                value={bathroom.type}
                onChange={(v) => updateBathroom(i, "type", v as BathroomEntry["type"])}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-600">
                Attached to which room? <span className="text-red-400">*</span>
              </label>
              <SearchSelect
                options={roomOptions}
                value={bathroom.attached_to}
                onChange={(v) => updateBathroom(i, "attached_to", v)}
                placeholder="Select room"
                showSearch={false}
              />
              {errors[`bathroom_attached_to_${i}`] && (
                <p className="text-xs text-red-500">{errors[`bathroom_attached_to_${i}`]}</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {errors.bathrooms && (
        <p className="text-xs text-red-500">{errors.bathrooms}</p>
      )}

      <button
        type="button"
        onClick={addBathroom}
        className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
      >
        <PlusIcon size={14} weight="bold" />
        Add Another Bathroom
      </button>
    </div>
  );
}

// ── Section 4 — Meal Plan ─────────────────────────────────────────────────────

function toDateObj(str: string): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function fromDateObj(d: Date | undefined): string {
  if (!d) return "";
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Section4({ data, onChange, errors }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; errors: FieldErrors;
}) {
  const set = <K extends keyof RoomFormData>(k: K, v: RoomFormData[K]) => onChange({ ...data, [k]: v });

  return (
    <div className="px-5 pt-5 pb-4 space-y-6">

      {/* ── Meal Plan ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-700">Meal Plan</p>
          <p className="text-xs text-neutral-400 mt-0.5">Select the meal option included with this room rate</p>
        </div>
        <FieldRow label="Meal Options" required error={errors.meal_plan}>
          <SearchSelect
            options={MEAL_PLANS.map((p) => ({ value: p.value, label: p.label }))}
            value={data.meal_plan}
            onChange={(v) => set("meal_plan", v)}
            placeholder="Select a meal plan"
            searchPlaceholder="Search meal plans..."
            showSearch
            dropdownMinWidth={360}
          />
        </FieldRow>
      </div>

      <div className="border-t border-neutral-100" />

      {/* ── Room Prices ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-700">Room Prices</p>
          <p className="text-xs text-neutral-400 mt-0.5">Set the nightly rate and surcharges for this room</p>
        </div>

        <FieldRow
          label={`Base Rate for ${data.base_adults} adult${data.base_adults !== 1 ? "s" : ""}`}
          required
          error={errors.base_rate}
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-500 pointer-events-none">₹</span>
            <Input
              type="number"
              min={0}
              placeholder="Enter base rate"
              value={data.base_rate}
              onChange={(e) => set("base_rate", e.target.value)}
              className="pl-7"
            />
          </div>
        </FieldRow>

        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Extra Adult Charge" hint="Per adult beyond base" error={errors.extra_adult_charge}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-500 pointer-events-none">₹</span>
              <Input
                type="number"
                min={0}
                placeholder="Enter extra adult charge"
                value={data.extra_adult_charge}
                onChange={(e) => set("extra_adult_charge", e.target.value)}
                className="pl-7"
              />
            </div>
          </FieldRow>
          <FieldRow label="Paid Child Charge" hint="Ages 7–17 years">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-500 pointer-events-none">₹</span>
              <Input
                type="number"
                min={0}
                placeholder="Enter charge for child"
                value={data.paid_child_charge}
                onChange={(e) => set("paid_child_charge", e.target.value)}
                className="pl-7"
              />
            </div>
          </FieldRow>
        </div>
      </div>

      <div className="border-t border-neutral-100" />

      {/* ── Inventory Calendar ── */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-700">Inventory Calendar</p>
          <p className="text-xs text-neutral-400 mt-0.5">Set the validity period for these rates</p>
        </div>
        <FieldRow
          label="Rate Validity Period"
          required
          error={errors.rate_start_date ?? errors.rate_end_date}
        >
          <DateRangePickerField
            value={{ from: toDateObj(data.rate_start_date), to: toDateObj(data.rate_end_date) } as DateRangeValue}
            onChange={(range) => onChange({
              ...data,
              rate_start_date: fromDateObj(range?.from),
              rate_end_date: fromDateObj(range?.to),
            })}
            placeholder="Select start & end date"
            error={!!(errors.rate_start_date || errors.rate_end_date)}
            triggerClassName="h-10 rounded-lg"
          />
        </FieldRow>
      </div>

    </div>
  );
}

// ── Section 5 — Amenity Details ───────────────────────────────────────────────

function RoomYesNo({ selected, onChange }: { selected: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div role="group" className="flex rounded-lg border border-neutral-200 overflow-hidden text-xs font-medium shrink-0">
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={selected === false}
        className={cn(
          "px-3.5 py-1.5 transition-colors",
          selected === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50",
        )}
      >
        No
      </button>
      <div className="w-px bg-neutral-200" />
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={selected === true}
        className={cn(
          "px-3.5 py-1.5 transition-colors",
          selected === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50",
        )}
      >
        Yes
      </button>
    </div>
  );
}

function Section5({ data, onChange, mandatoryError }: {
  data: RoomFormData; onChange: (d: RoomFormData) => void; mandatoryError?: string;
}) {
  const [activeCategory, setActiveCategory] = useState(ROOM_AMENITY_GROUPS[0].label);
  const [search, setSearch] = useState("");
  const amenityListRef = useRef<HTMLDivElement>(null);

  // Switching categories should always start the list from the top instead
  // of keeping whatever scroll position the previous category was at.
  function selectAmenityCategory(label: string) {
    setActiveCategory(label);
    if (amenityListRef.current) amenityListRef.current.scrollTop = 0;
  }

  const activeGroup = ROOM_AMENITY_GROUPS.find((g) => g.label === activeCategory) ?? ROOM_AMENITY_GROUPS[0];
  const configMap: Record<string, RoomAmenityConfig[] | undefined> = {
    "Mandatory":             ROOM_MANDATORY_CONFIG,
    "Popular with Guests":   ROOM_POPULAR_CONFIG,
    "Room Features":         ROOM_FEATURES_CONFIG,
    "Food & Drinks":         ROOM_FOOD_DRINKS_CONFIG,
    "Kitchen & Appliances":  ROOM_KITCHEN_CONFIG,
    "Beds & Blanket":        ROOM_BEDS_BLANKET_CONFIG,
    "Other Facilities":      ROOM_OTHER_FACILITIES_CONFIG,
  };
  const activeConfig = configMap[activeCategory];
  const sq = search.toLowerCase().trim();

  function setItem(item: string, val: boolean) {
    const isMandatory = ROOM_MANDATORY_CONFIG.some((c) => c.name === item);
    const newAmenities = val
      ? [...new Set([...data.room_amenities, item])]
      : data.room_amenities.filter((x) => x !== item);
    const newNoes = isMandatory
      ? val
        ? data.room_mandatory_noes.filter((x) => x !== item)
        : [...new Set([...data.room_mandatory_noes, item])]
      : data.room_mandatory_noes;
    onChange({ ...data, room_amenities: newAmenities, room_mandatory_noes: newNoes });
  }

  function setAll(items: string[], val: boolean) {
    const isMandatoryGroup = activeCategory === "Mandatory";
    const newAmenities = val
      ? [...new Set([...data.room_amenities, ...items])]
      : data.room_amenities.filter((x) => !items.includes(x));
    const newNoes = isMandatoryGroup
      ? val
        ? data.room_mandatory_noes.filter((x) => !items.includes(x))
        : [...new Set([...data.room_mandatory_noes, ...items])]
      : data.room_mandatory_noes;
    onChange({ ...data, room_amenities: newAmenities, room_mandatory_noes: newNoes });
  }

  function updateDetail(name: string, val: string | string[]) {
    onChange({
      ...data,
      room_amenity_details: { ...data.room_amenity_details, [name]: val },
    });
  }

  const allActiveSelected = activeGroup.items.every((i) => data.room_amenities.includes(i));

  // Global search: flatten all groups
  const searchResults = sq
    ? ROOM_AMENITY_GROUPS.flatMap((group) => {
        const cfg = configMap[group.label];
        const items: RoomAmenityConfig[] = cfg ?? group.items.map((name) => ({ name }));
        return items
          .filter((c) => c.name.toLowerCase().includes(sq))
          .map((c) => ({ config: c, category: group.label }));
      })
    : [];

  function renderRow(config: RoomAmenityConfig, key: string, isMandatory = false) {
    const inAmenities = data.room_amenities.includes(config.name);
    const inNoes = data.room_mandatory_noes.includes(config.name);
    const selected: boolean | undefined = isMandatory
      ? (inAmenities ? true : inNoes ? false : undefined)
      : inAmenities;
    const isUnanswered = isMandatory && selected === undefined;
    const showRowError = !!mandatoryError && isUnanswered;
    const detailVal = data.room_amenity_details[config.name];
    return (
      <div key={key} className={cn("border-b border-neutral-100 last:border-0", selected === true ? "bg-emerald-50/40" : showRowError ? "bg-red-50/40" : "")}>
        <div className="flex items-center justify-between px-5 py-3">
          <span className={cn("text-sm flex-1 pr-4", showRowError ? "text-red-700 font-medium" : "text-neutral-700")}>
            {config.name}
            {showRowError && <span className="ml-2 text-[10px] font-semibold text-red-500 uppercase tracking-wide">Required</span>}
          </span>
          <RoomYesNo selected={selected} onChange={(v) => setItem(config.name, v)} />
        </div>
        {selected && config.field && (
          <div className="px-5 pb-3">
            <div className="max-w-xs">
              {config.field.type === "select" ? (
                <SearchSelect
                  options={config.field.options}
                  value={(detailVal as string) ?? ""}
                  onChange={(v) => updateDetail(config.name, v)}
                  placeholder={config.field.label ?? "Select…"}
                  showSearch={false}
                />
              ) : (
                <MultiSearchSelect
                  options={config.field.options}
                  value={(detailVal as string[]) ?? []}
                  onChange={(v) => updateDetail(config.name, v)}
                  placeholder={config.field.label ?? "Select…"}
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {mandatoryError && (
        <div className="mx-4 mt-3 rounded-lg px-3 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200">
          <p>{mandatoryError}</p>
          {activeCategory !== "Mandatory" && (
            <button
              type="button"
              onClick={() => selectAmenityCategory("Mandatory")}
              className="mt-1 text-red-600 underline underline-offset-2 text-xs hover:text-red-800"
            >
              Jump to Mandatory →
            </button>
          )}
        </div>
      )}
      {/* Global search input */}
      <div className="px-4 py-3 border-b border-neutral-100">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all amenities…"
          className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        />
      </div>

      {sq ? (
        /* ── Global search results ── */
        <div className="overflow-y-auto" style={{ maxHeight: 500 }}>
          {searchResults.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-400">
              No amenities match &ldquo;{search}&rdquo;
            </p>
          ) : (
            searchResults.map(({ config, category }) => {
              const selected = data.room_amenities.includes(config.name);
              const detailVal = data.room_amenity_details[config.name];
              return (
                <div key={`${category}::${config.name}`} className={cn("border-b border-neutral-100 last:border-0", selected ? "bg-emerald-50/40" : "")}>
                  <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm text-neutral-700">{config.name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{category}</p>
                    </div>
                    <RoomYesNo selected={selected} onChange={(v) => setItem(config.name, v)} />
                  </div>
                  {selected && config.field && (
                    <div className="px-5 pb-3">
                      <div className="max-w-xs">
                        {config.field.type === "select" ? (
                          <SearchSelect
                            options={config.field.options}
                            value={(detailVal as string) ?? ""}
                            onChange={(v) => updateDetail(config.name, v)}
                            placeholder={config.field.label ?? "Select…"}
                            showSearch={false}
                          />
                        ) : (
                          <MultiSearchSelect
                            options={config.field.options}
                            value={(detailVal as string[]) ?? []}
                            onChange={(v) => updateDetail(config.name, v)}
                            placeholder={config.field.label ?? "Select…"}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── Normal sidebar + panel ──
           Fixed height so the sidebar's category list and the content panel
           always share one scroll viewport — otherwise whichever pane is
           naturally taller dictates the row's height and the shorter pane's
           own scroll never engages, silently clipping rows outside it. */
        <div className="flex h-105 divide-x divide-neutral-100">

          {/* Sidebar */}
          <div className="w-44 shrink-0 h-full overflow-y-auto scrollbar-slim border-r border-neutral-100">
            {ROOM_AMENITY_GROUPS.map((group) => {
              const selected = group.items.filter((i) => data.room_amenities.includes(i)).length;
              const isActive = activeCategory === group.label;
              return (
                <button
                  key={group.label}
                  type="button"
                  onClick={() => selectAmenityCategory(group.label)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-neutral-100 transition-colors relative",
                    isActive
                      ? "bg-primary-50 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary-500"
                      : "hover:bg-neutral-50",
                  )}
                >
                  <p className={cn("text-[13px] font-medium leading-snug", isActive ? "text-primary-600" : "text-neutral-700")}>
                    {group.label}
                  </p>
                  <p className={cn(
                    "text-[11px] mt-0.5 font-medium",
                    selected === group.items.length ? "text-emerald-600" : selected > 0 ? "text-amber-500" : "text-neutral-400",
                  )}>
                    {selected} of {group.items.length}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Content panel */}
          <div className="flex-1 h-full flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-100 bg-neutral-50/60 shrink-0">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                {activeCategory}
              </span>
              <button
                type="button"
                onClick={() => setAll(activeGroup.items, !allActiveSelected)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                {allActiveSelected ? "Deselect all" : "Select all"}
              </button>
            </div>

            <div ref={amenityListRef} className="overflow-y-auto scrollbar-slim flex-1">
              {activeConfig
                ? activeConfig.map((config) => renderRow(config, config.name, activeCategory === "Mandatory"))
                : activeGroup.items.map((item) => {
                    const selected = data.room_amenities.includes(item);
                    return (
                      <div
                        key={item}
                        className={cn(
                          "flex items-center justify-between px-5 py-3 border-b border-neutral-100 last:border-0",
                          selected ? "bg-emerald-50/40" : "",
                        )}
                      >
                        <span className="text-sm text-neutral-700 flex-1 pr-4">{item}</span>
                        <RoomYesNo selected={selected} onChange={(v) => setItem(item, v)} />
                      </div>
                    );
                  })
              }
            </div>

            {data.room_amenities.length > 0 && (
              <div className="px-5 py-2 border-t border-neutral-100 bg-neutral-50/60 shrink-0">
                <p className="text-xs text-neutral-400">
                  {data.room_amenities.length} amenit{data.room_amenities.length === 1 ? "y" : "ies"} selected across all categories
                </p>
              </div>
            )}
          </div>
        </div>
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
      return d.bathrooms.length
        ? `${d.bathrooms.length} bathroom${d.bathrooms.length !== 1 ? "s" : ""}`
        : "No bathrooms added";
    case 4: {
      const plan = MEAL_PLANS.find((p) => p.value === d.meal_plan)?.label ?? d.meal_plan;
      const rate = d.base_rate ? `₹${Number(d.base_rate).toLocaleString("en-IN")}` : "";
      return [plan, rate].filter(Boolean).join(" · ");
    }
    case 5:
      return d.room_amenities.length ? `${d.room_amenities.length} amenities selected` : "No amenities selected";
    default: return "";
  }
}

// ── Room Wizard Form (create + edit) ─────────────────────────────────────────

// A brand-new room doesn't exist in the DB until every section validates
// (createRoom writes the whole room + pricing row in one strict-schema
// transaction — there's no partial/draft row to incrementally patch without
// that draft leaking into the Rooms list, Calendar, and Rates queries, which
// all already filter `is_active: true`). So in-progress form state for a NEW
// room is persisted client-side instead — sessionStorage, scoped per hotel,
// cleared on successful save or explicit Cancel, and naturally discarded
// when the tab/browser closes.
function draftKey(hotelId: number, roomId?: number): string {
  return `hc-room-draft-${hotelId}-${roomId ?? "new"}`;
}

function RoomWizardForm({
  hotelId,
  roomId,
  initialData,
  onDone,
  roomTypes,
}: {
  hotelId: number;
  roomId?: number;
  initialData?: RoomEditPayload;
  onDone: () => void;
  roomTypes: string[];
}) {
  const router = useRouter();
  const isEditing = roomId !== undefined;

  const restored = (() => {
    if (isEditing || typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(draftKey(hotelId, roomId));
      return raw ? (JSON.parse(raw) as { data: RoomFormData; unlockedThrough: number }) : null;
    } catch {
      return null;
    }
  })();

  // Existing rooms were already fully validated on their last save — nothing
  // should be locked when reopening one to edit. New rooms start at section 1
  // (or wherever a restored draft left off).
  // 6 (one past the last real section) rather than 5 — so section 5 itself
  // also reads as "completed" (isCompleted checks sec.id < unlockedThrough),
  // not just unlocked-but-not-yet-done.
  const [unlockedThrough, setUnlockedThrough] = useState(isEditing ? 6 : restored?.unlockedThrough ?? 1);
  // Resuming a draft reopens at the frontier section (where they left off),
  // not back at section 1.
  const [openSection, setOpenSection] = useState<number | null>(restored?.unlockedThrough ?? 1);
  const [data, setData]               = useState<RoomFormData>(() => {
    if (restored) return restored.data;
    if (!initialData) return DEFAULT_FORM;
    const base = initialData as unknown as RoomFormData;
    // When editing an existing room, treat all mandatory items not in room_amenities as explicitly "No"
    const room_mandatory_noes = ROOM_MANDATORY_CONFIG
      .filter((c) => !base.room_amenities.includes(c.name))
      .map((c) => c.name);
    return { ...base, room_mandatory_noes };
  });
  const [errors, setErrors]           = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [isPending, startTransition]  = useTransition();

  // Persist create-mode progress so a reload/navigation-away doesn't lose it.
  useEffect(() => {
    if (isEditing) return;
    try {
      sessionStorage.setItem(draftKey(hotelId, roomId), JSON.stringify({ data, unlockedThrough }));
    } catch {
      // sessionStorage unavailable (private browsing, quota) — draft simply won't persist.
    }
  }, [isEditing, hotelId, roomId, data, unlockedThrough]);

  function clearDraft() {
    try {
      sessionStorage.removeItem(draftKey(hotelId, roomId));
    } catch {
      // ignore
    }
  }

  function toggleSection(id: number) {
    if (id > unlockedThrough) return; // locked — no-op
    setErrors({});
    setOpenSection((cur) => (cur === id ? null : id));
  }

  function advance() {
    if (!openSection) return;
    const sec = openSection;
    if (sec < 5) {
      const errs = VALIDATORS[sec - 1]?.(data) ?? {};
      if (Object.keys(errs).length > 0) { setErrors(errs); return; }
      setErrors({});
      setUnlockedThrough((u) => Math.max(u, sec + 1));
      setOpenSection(sec + 1);
    } else {
      handleSave();
    }
  }

  function buildPayload() {
    return {
      ...data,
      area:               data.area !== "" ? Number(data.area) : undefined,
      num_bedrooms:       Number(data.num_bedrooms),
      num_living_rooms:   data.num_living_rooms !== "" ? Number(data.num_living_rooms) : undefined,
      num_rooms:          Number(data.num_rooms),
      bathrooms:          data.bathrooms,
      extra_adult_charge: data.extra_adult_charge !== "" ? Number(data.extra_adult_charge) : undefined,
      paid_child_charge:  data.paid_child_charge  !== "" ? Number(data.paid_child_charge)  : undefined,
    };
  }

  function handleSave() {
    for (let i = 0; i < VALIDATORS.length; i++) {
      const errs = VALIDATORS[i](data);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        setUnlockedThrough((u) => Math.max(u, i + 1));
        setOpenSection(i + 1);
        return;
      }
    }
    startTransition(async () => {
      setGlobalError("");
      try {
        const result = isEditing
          ? await updateRoom(hotelId, roomId, buildPayload())
          : await createRoom(hotelId, buildPayload());
        if (result.roomId) {
          clearDraft();
          router.refresh();
          onDone();
        } else if (result.error) {
          setGlobalError(result.error);
        } else if (result.errors) {
          const flat: FieldErrors = {};
          for (const [k, msgs] of Object.entries(result.errors)) flat[k] = (msgs as string[])[0];
          setErrors(flat);
        }
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  function sectionContent(s: number) {
    switch (s) {
      case 1: return <Section1 data={data} onChange={setData} errors={errors} roomTypes={roomTypes} />;
      case 2: return <Section2 data={data} onChange={setData} errors={errors} />;
      case 3: return <Section3 data={data} onChange={setData} errors={errors} />;
      case 4: return <Section4 data={data} onChange={setData} errors={errors} />;
      case 5: return <Section5 data={data} onChange={setData} mandatoryError={errors._mandatory} />;
      default: return null;
    }
  }

  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <div className="px-5 py-3.5 border-b border-neutral-200 bg-linear-to-b rounded-t-[inherit] bg-neutral-50">
        <h3 className="text-sm font-semibold text-neutral-800">{isEditing ? "Edit Room" : "Create Room"}</h3>
        <p className="text-xs text-neutral-600/90 mt-0.5">{isEditing ? "Update the details for this room type" : "Complete all sections to add a room type"}</p>
      </div>

      <div className="divide-y divide-neutral-100 bg-white">
        {SECTIONS.map((sec) => {
          const isOpen      = sec.id === openSection;
          const isCompleted = sec.id < unlockedThrough;
          const isLocked    = sec.id > unlockedThrough;

          return (
            <div key={sec.id}>
              <button
                type="button"
                onClick={() => toggleSection(sec.id)}
                disabled={isLocked}
                aria-expanded={isOpen}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-4 text-left transition-colors",
                  isLocked ? "cursor-not-allowed" : "cursor-pointer hover:bg-neutral-50/70",
                )}
              >
                <StepCircle n={sec.id} active={isOpen} done={isCompleted} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold leading-snug", isLocked ? "text-neutral-400" : "text-neutral-800")}>
                    {sec.title}
                  </p>
                  <p className={cn("text-xs mt-0.5 truncate", isLocked ? "text-neutral-400" : "text-neutral-500")}>
                    {isCompleted && !isOpen ? stepSummary(sec.id, data) : sec.sub}
                  </p>
                </div>
                {isLocked ? (
                  <LockSimpleIcon size={16} className="text-neutral-300 shrink-0" aria-hidden="true" />
                ) : isOpen ? (
                  <CaretUpIcon size={16} className="text-neutral-400 shrink-0" aria-hidden="true" />
                ) : (
                  <CaretDownIcon size={16} className="text-neutral-400 shrink-0" aria-hidden="true" />
                )}
              </button>

              {isOpen && (
                <div className="border-t border-neutral-100">
                  {globalError && (
                    <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      <WarningIcon size={15} className="shrink-0" />
                      {globalError}
                    </div>
                  )}
                  {sectionContent(sec.id)}
                  <div className="flex items-center justify-between px-5 py-3.5 border-t border-neutral-100">
                    <button type="button" onClick={() => { clearDraft(); onDone(); }}
                      className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors">
                      Cancel
                    </button>
                    <div className="flex items-center gap-3">
                      {sec.id > 1 && (
                        <button type="button" onClick={() => { setErrors({}); setOpenSection(sec.id - 1); }}
                          className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 font-medium transition-colors">
                          <ArrowLeftIcon size={13} weight="bold" />
                          Back
                        </button>
                      )}
                      <Button variant="primary" size="sm" onClick={advance} loading={isPending} className="gap-1.5">
                        {isPending ? "Saving…" : sec.id === 5 ? (isEditing ? "Update Room" : "Save Room") : "Next"}
                        {!isPending && sec.id < 5 && <ArrowRightIcon size={13} weight="bold" />}
                      </Button>
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

// ── Room photo strip — per-room images, uploaded/assigned directly from the
// Rooms list rather than the hotel-wide Photos tab (hotel_room_images, not
// hotel_images) ─────────────────────────────────────────────────────────────

function RoomPhotoStrip({
  hotelId, roomId, initialCount,
}: {
  hotelId: number; roomId: number; initialCount: number;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<RoomPhoto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const result = await listRoomPhotos(hotelId, roomId);
    setLoading(false);
    if (result.photos) {
      setPhotos(result.photos);
    } else if (result.error) {
      setError(result.error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    for (const f of files) fd.append("photos", f);
    const result = await uploadRoomPhotos(hotelId, roomId, fd);
    setUploading(false);
    e.target.value = "";
    if (result.photos?.length) {
      setPhotos((prev) => [...(prev ?? []), ...result.photos!]);
      // Keeps the server-sourced room list (and its photoCount, used to gate
      // "Save & Continue") in sync with this client-only upload.
      router.refresh();
    }
    if (result.error) setError(result.error);
  }

  async function handleDelete(photoId: number) {
    setDeletingId(photoId);
    const result = await deleteRoomPhoto(hotelId, roomId, photoId);
    setDeletingId(null);
    if (result.error) { setError(result.error); return; }
    setPhotos((prev) => (prev ?? []).filter((p) => p.id !== photoId));
    router.refresh();
  }

  const count = photos?.length ?? initialCount;
  const met = count >= MIN_ROOM_PHOTOS;

  return (
    <div className="px-3 pb-3 pt-1 border-t border-neutral-100">
      <div className="flex items-center justify-between mb-2">
        <p className={cn("text-[11px] font-medium", met ? "text-emerald-600" : "text-amber-600")}>
          {met ? <CheckIcon size={11} weight="bold" className="inline mr-1 -mt-0.5" aria-hidden="true" />
                : <WarningIcon size={11} weight="bold" className="inline mr-1 -mt-0.5" aria-hidden="true" />}
          {count} of {MIN_ROOM_PHOTOS} required photos
        </p>
        {error && <p className="text-[11px] text-red-500 truncate max-w-[50%]">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {loading && photos === null ? (
          <div className="w-16 h-14 rounded-lg bg-neutral-100 animate-pulse" />
        ) : (
          (photos ?? []).map((photo) => (
            <div key={photo.id} className="relative group w-16 h-14 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
              <Image src={photo.url} alt="Room photo" fill sizes="64px" className="object-cover" />
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                disabled={deletingId === photo.id}
                aria-label="Remove photo"
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white disabled:opacity-60"
              >
                <TrashIcon size={14} aria-hidden="true" />
              </button>
            </div>
          ))
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 hover:border-primary-300 hover:text-primary-500 transition-colors disabled:opacity-60 shrink-0"
        >
          {uploading ? (
            <span className="text-[9px] font-medium">…</span>
          ) : (
            <>
              <PlusIcon size={14} weight="bold" aria-hidden="true" />
              <span className="text-[9px] font-semibold">Add</span>
            </>
          )}
        </button>
      </div>
    </div>
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
        <Button variant="primary" size="sm" onClick={onAdd} className="gap-2">
          <PlusIcon size={14} weight="bold" />
          Create Room Type
        </Button>
      </div>
    </SectionCard>
  );
}

function RoomsList({
  hotelId, rooms, onAdd, onEdit,
}: {
  hotelId: number; rooms: RoomSummary[]; onAdd: () => void; onEdit: (id: number) => void;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(roomId: number) {
    setDeletingId(roomId);
    setDeleteError(null);
    const result = await deleteRoom(hotelId, roomId);
    if (result.error) setDeleteError(result.error);
    router.refresh();
    setDeletingId(null);
  }

  return (
    <SectionCard title="Room Types" desc="Add and manage the room types available at your property">
      {deleteError && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">{deleteError}</p>
      )}
      <div className="flex items-center justify-between -mt-1 mb-1">
        <p className="text-xs text-neutral-500">{rooms.length} room type{rooms.length !== 1 ? "s" : ""} added</p>
        <Button variant="primary" size="xs" onClick={onAdd} className="gap-1.5">
          <PlusIcon size={11} weight="bold" />
          Add Room
        </Button>
      </div>
      <div className="space-y-2">
        {rooms.map((room) => (
          <Card key={room.id} variant="default" radius="sm" padding="none">
            <div className="flex items-center justify-between p-3">
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
                <Button variant="outline" size="xs" onClick={() => onEdit(room.id)}>
                  Edit
                </Button>
                <button type="button" onClick={() => handleDelete(room.id)} disabled={deletingId === room.id} aria-label={`Delete room type ${room.name}`}
                  className="size-8 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors disabled:opacity-40">
                  <TrashIcon size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
            <RoomPhotoStrip
              hotelId={hotelId}
              roomId={room.id}
              initialCount={room.photoCount}
            />
          </Card>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type TabMode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; roomId: number; payload: RoomEditPayload }
  | { kind: "loading" };

export default function RoomsTab({ hotelId, rooms, propertySubType }: { hotelId: number; rooms: RoomSummary[]; propertySubType: string | null }) {
  const roomTypes = propertySubType === "GUEST_HOUSE" ? GUEST_HOUSE_ROOM_TYPES : ROOM_TYPES;
  const [mode, setMode] = useState<TabMode>({ kind: "list" });
  const router = useRouter();
  const [continueError, setContinueError] = useState<string | null>(null);

  // Tab 4 has no server action of its own (rooms are saved individually via
  // createRoom/updateRoom) — this hidden form only exists so the WizardShell
  // footer's "Save & Continue" button (wired to id="wizard-form") has
  // something to validate against instead of navigating unconditionally.
  function handleContinueSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rooms.length === 0) {
      setContinueError("Add at least one room type before continuing.");
      return;
    }
    const short = rooms.filter((r) => r.photoCount < MIN_ROOM_PHOTOS);
    if (short.length > 0) {
      setContinueError(
        `Add at least ${MIN_ROOM_PHOTOS} photos to ${short.length === 1 ? short[0].name : `${short.length} room types`} before continuing.`
      );
      return;
    }
    setContinueError(null);
    router.push(`/hotel-connect/properties/${hotelId}/edit?tab=5`);
  }

  async function handleEdit(roomId: number) {
    setMode({ kind: "loading" });
    const result = await fetchRoomForEdit(hotelId, roomId);
    if (result.payload) {
      setMode({ kind: "edit", roomId, payload: result.payload });
    } else {
      setMode({ kind: "list" });
    }
  }

  if (mode.kind === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-neutral-400">
        Loading room…
      </div>
    );
  }

  if (mode.kind === "create") {
    return <RoomWizardForm hotelId={hotelId} roomTypes={roomTypes} onDone={() => setMode({ kind: "list" })} />;
  }

  if (mode.kind === "edit") {
    return (
      <RoomWizardForm
        hotelId={hotelId}
        roomId={mode.roomId}
        initialData={mode.payload}
        roomTypes={roomTypes}
        onDone={() => setMode({ kind: "list" })}
      />
    );
  }

  return (
    <div className="space-y-3">
      {continueError && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{continueError}</p>
      )}
      {rooms.length === 0
        ? <EmptyRooms onAdd={() => setMode({ kind: "create" })} />
        : <RoomsList hotelId={hotelId} rooms={rooms} onAdd={() => setMode({ kind: "create" })} onEdit={handleEdit} />}
      <form id="wizard-form" onSubmit={handleContinueSubmit} className="hidden" />
    </div>
  );
}
