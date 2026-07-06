"use client";

import { useActionState, useState } from "react";
import { saveMealsPricing, type MealsPricingState } from "./meals-pricing-actions";
import { WarningIcon, MinusIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import DatePickerField from "@/app/components/ui/DatePickerField";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/components/ui/Card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MealsPricingHotelData = {
  id: number;
  prop_num_units:      number | null;
  prop_meal_option:    string | null;
  prop_base_occupancy: number | null;
  prop_max_adults:     number | null;
  prop_max_children:   number | null;
  prop_max_occupancy:  number | null;
  prop_avail_from:     Date | null;
  prop_avail_to:       Date | null;
  prop_base_rate:      string | null;
  prop_extra_adult:    string | null;
  prop_child_rate:     string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MEAL_OPTIONS = [
  { value: "ACCOMMODATION_ONLY", label: "Accommodation only" },
  { value: "BREAKFAST",          label: "Breakfast included" },
  { value: "HALF_BOARD",         label: "Half Board (Breakfast + Dinner)" },
  { value: "FULL_BOARD",         label: "Full Board (All Meals)" },
  { value: "ALL_INCLUSIVE",      label: "All Inclusive" },
];

// ── UI helpers ────────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <div className="px-5 py-3.5 border-b border-neutral-200 bg-linear-to-b bg-neutral-50 rounded-t-[inherit]">
        <p className="text-sm font-semibold text-neutral-800">{title}</p>
        {description && <p className="text-xs text-neutral-600/90 mt-0.5">{description}</p>}
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </Card>
  );
}

function FieldLabel({
  label,
  hint,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className="mb-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional && <span className="ml-1 normal-case tracking-normal font-normal text-neutral-400">(Optional)</span>}
      </Label>
      {hint && <span className="block text-xs text-neutral-500 mt-1 normal-case tracking-normal font-normal">{hint}</span>}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-0 rounded-lg border border-neutral-200 overflow-hidden w-fit shadow-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(
          "flex size-9 items-center justify-center transition-colors",
          value <= min
            ? "text-neutral-300 cursor-not-allowed bg-neutral-50"
            : "text-neutral-600 hover:bg-neutral-100 cursor-pointer",
        )}
      >
        <MinusIcon size={14} weight="bold" />
      </button>
      <span className="w-12 text-center text-sm font-semibold text-neutral-800 bg-white select-none">
        {String(value).padStart(2, "0")}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(
          "flex size-9 items-center justify-center transition-colors",
          value >= max
            ? "text-neutral-300 cursor-not-allowed bg-neutral-50"
            : "text-neutral-600 hover:bg-neutral-100 cursor-pointer",
        )}
      >
        <PlusIcon size={14} weight="bold" />
      </button>
    </div>
  );
}

function OccupancyRow({
  label,
  description,
  value,
  onChange,
  min,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        <p className="text-xs text-neutral-400 mt-0.5 leading-snug">{description}</p>
      </div>
      <Stepper value={value} onChange={onChange} min={min ?? 0} />
    </div>
  );
}

function CurrencyInput({
  id,
  name,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center h-10 rounded-lg border border-neutral-300 bg-white shadow-sm overflow-hidden transition-colors focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20">
      <span className="pl-3 pr-1.5 text-sm text-neutral-400 font-medium select-none">₹</span>
      <input
        id={id}
        name={name}
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Add Rate"}
        className="flex-1 h-full pr-3 text-sm text-neutral-900 outline-none bg-transparent placeholder:text-neutral-400"
      />
    </div>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5">
      <WarningIcon size={15} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 leading-relaxed">{children}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MealsPricingTab({ hotel }: { hotel: MealsPricingHotelData }) {
  const boundAction = saveMealsPricing.bind(null, hotel.id);
  const [state, formAction] = useActionState<MealsPricingState, FormData>(boundAction, {});

  // Units & Meal
  const [numUnits,    setNumUnits]    = useState(hotel.prop_num_units    ?? 1);
  const [mealOption,  setMealOption]  = useState(hotel.prop_meal_option  ?? "ACCOMMODATION_ONLY");

  // Occupancy
  const [baseOcc,  setBaseOcc]  = useState(hotel.prop_base_occupancy ?? 2);
  const [maxAdult, setMaxAdult] = useState(hotel.prop_max_adults     ?? 2);
  const [maxChild, setMaxChild] = useState(hotel.prop_max_children   ?? 0);
  const [maxOcc,   setMaxOcc]   = useState(hotel.prop_max_occupancy  ?? 2);

  // Availability
  const [availFrom, setAvailFrom] = useState<Date | null>(
    hotel.prop_avail_from ? new Date(hotel.prop_avail_from) : null,
  );
  const [availTo, setAvailTo] = useState<Date | null>(
    hotel.prop_avail_to ? new Date(hotel.prop_avail_to) : null,
  );

  // Rates
  const [baseRate,    setBaseRate]    = useState(hotel.prop_base_rate   ?? "");
  const [extraAdult,  setExtraAdult]  = useState(hotel.prop_extra_adult ?? "");
  const [childRate,   setChildRate]   = useState(hotel.prop_child_rate  ?? "");

  return (
    <>
      <form id="wizard-form" action={formAction} className="space-y-5 py-5">
        {/* Hidden controlled fields */}
        <input type="hidden" name="prop_num_units"      value={numUnits} />
        <input type="hidden" name="prop_meal_option"    value={mealOption} />
        <input type="hidden" name="prop_base_occupancy" value={baseOcc} />
        <input type="hidden" name="prop_max_adults"     value={maxAdult} />
        <input type="hidden" name="prop_max_children"   value={maxChild} />
        <input type="hidden" name="prop_max_occupancy"  value={maxOcc} />
        <input type="hidden" name="prop_avail_from"     value={availFrom ? availFrom.toISOString() : ""} />
        <input type="hidden" name="prop_avail_to"       value={availTo   ? availTo.toISOString()   : ""} />

        {state.error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            {state.error}
          </div>
        )}

        {/* ── Units & Meal Plan ──────────────────────────────────────────────── */}
        <SectionCard title="Units & Meal Plan">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel
                label="Number of units (of this type)"
                htmlFor="prop_num_units_input"
                hint="How many identical units are available"
              />
              <Input
                id="prop_num_units_input"
                type="number"
                min="1"
                value={numUnits}
                onChange={(e) => setNumUnits(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <FieldLabel
                label="Meal Option (applies to all units)"
                htmlFor="meal_option_select"
              />
              <SearchSelect
                options={MEAL_OPTIONS}
                value={mealOption}
                onChange={setMealOption}
                placeholder="Select meal option"
                searchPlaceholder="Search meal option…"
              />
            </div>
          </div>
          <p className="text-xs text-neutral-400">
            This can be edited for units once property is live
          </p>
        </SectionCard>

        {/* ── Property Occupancy ─────────────────────────────────────────────── */}
        <SectionCard title="Property Occupancy">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 divide-y sm:divide-y-0">
            <OccupancyRow
              label="Base Occupancy"
              description="Ideal number of adults that can be accommodated in this property"
              value={baseOcc}
              onChange={(v) => { setBaseOcc(v); if (maxAdult < v) setMaxAdult(v); if (maxOcc < v) setMaxOcc(v); }}
              min={1}
            />
            <OccupancyRow
              label="Adult Occupancy"
              description="Total number of adults that can be accommodated in this property"
              value={maxAdult}
              onChange={(v) => { setMaxAdult(v); if (baseOcc > v) setBaseOcc(v); if (maxOcc < v) setMaxOcc(v); }}
              min={1}
            />
            <OccupancyRow
              label="Maximum Children"
              description="Maximum number of children that can be accommodated in this property"
              value={maxChild}
              onChange={setMaxChild}
            />
            <OccupancyRow
              label="Maximum Occupancy"
              description="Total number of adults &amp; children that can be accommodated in this property"
              value={maxOcc}
              onChange={(v) => setMaxOcc(Math.max(v, maxAdult))}
              min={1}
            />
          </div>
        </SectionCard>

        {/* ── Availability ───────────────────────────────────────────────────── */}
        <SectionCard title="Availability">
          <p className="text-sm text-neutral-500 -mt-1">
            Please select the start &amp; end dates on which your property can be booked by guests.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel label="Start Date" />
              <DatePickerField
                value={availFrom}
                onChange={(d) => {
                  setAvailFrom(d);
                  // Clear end date if it's no longer after the new start date
                  if (d && availTo && d >= availTo) setAvailTo(null);
                }}
                placeholder="Select start date"
                minDate={new Date()}
              />
            </div>
            <div>
              <FieldLabel label="End Date" />
              <DatePickerField
                value={availTo}
                onChange={setAvailTo}
                placeholder="Select end date"
                minDate={availFrom ?? new Date()}
              />
            </div>
          </div>
        </SectionCard>

        {/* ── Base Rate ─────────────────────────────────────────────────────── */}
        <SectionCard title="Base Rate">
          <InfoBanner>
            Base occupancy allowed in this property is {baseOcc} and maximum occupancy is {maxOcc}.
          </InfoBanner>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel label={`Base Rate (${baseOcc} pax)`} htmlFor="base_rate_input" />
              <CurrencyInput
                id="base_rate_input"
                name="prop_base_rate"
                value={String(baseRate)}
                onChange={setBaseRate}
              />
            </div>
            <div>
              <FieldLabel
                label="Extra Adult Charge (18 yrs. &amp; above)"
                htmlFor="extra_adult_input"
                optional
              />
              <CurrencyInput
                id="extra_adult_input"
                name="prop_extra_adult"
                value={String(extraAdult)}
                onChange={setExtraAdult}
              />
            </div>
          </div>

          <div className="max-w-sm">
            <FieldLabel
              label="Charges for Child (7-17 yrs.)"
              htmlFor="child_rate_input"
              optional
            />
            <CurrencyInput
              id="child_rate_input"
              name="prop_child_rate"
              value={String(childRate)}
              onChange={setChildRate}
            />
          </div>

          <InfoBanner>
            Child age range for a free stay is set at 0-6 yrs. You can edit the child age range after your listing is complete.
          </InfoBanner>
        </SectionCard>
      </form>
    </>
  );
}
