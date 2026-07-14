"use client";

import { useActionState, useState } from "react";
import { savePolicies, type PolicyState } from "./policy-actions";
import { HotelCancellationPolicy } from "@/app/generated/prisma";
import { cn } from "@/app/lib/utils";
import { CheckIcon, CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import { SearchSelect, MultiSearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Card } from "@/app/components/ui/Card";

function PLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <Label className={cn("normal-case tracking-normal", className)} {...props} />;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "am" : "pm";
  const suffix = i === 0 ? " (midnight)" : i === 12 ? " (noon)" : "";
  return { value: `${String(i).padStart(2, "0")}:00`, label: `${h}:00 ${ampm}${suffix}` };
});

const CANCELLATION_OPTIONS: { value: HotelCancellationPolicy; label: string; recommended?: boolean }[] = [
  { value: HotelCancellationPolicy.FREE_TILL_CHECKIN, label: "Free Cancellation till check-in", recommended: true },
  { value: HotelCancellationPolicy.FREE_TILL_24H,    label: "Free Cancellation till 24 hours before check-in" },
  { value: HotelCancellationPolicy.FREE_TILL_48H,    label: "Free Cancellation till 48 hours before check-in" },
  { value: HotelCancellationPolicy.FREE_TILL_72H,    label: "Free Cancellation till 72 hours before check-in" },
  { value: HotelCancellationPolicy.NON_REFUNDABLE,   label: "Non-Refundable" },
];

const ID_PROOF_OPTIONS = ["Aadhaar Card", "Passport", "Driving License", "Voter ID", "PAN Card"];
const PET_TYPE_OPTIONS = ["Dogs", "Cats", "Birds", "Fish", "Rabbits", "Other"];

const EXTRA_BED_TYPES_ADULT = ["Cot", "Mattress", "Sofa cum bed", "Roll Away Bed"];
const EXTRA_BED_TYPES_CHILD = ["Cot", "Mattress", "Sofa cum bed", "Crib", "Roll Away Bed"];

// ── Types ─────────────────────────────────────────────────────────────────────

export type PoliciesHotelData = {
  id: number;
  check_in_time: string | null;
  check_out_time: string | null;
  cancellation_policy: HotelCancellationPolicy | null;
  allow_unmarried_couples: boolean | null;
  show_couple_tag: boolean | null;
  allow_guests_below_18: boolean | null;
  allow_male_only_groups: boolean | null;
  allow_same_city_id: boolean | null;
  smoking_allowed: boolean | null;
  parties_events_allowed: boolean | null;
  wheelchair_accessible: boolean | null;
  allow_outside_visitors: boolean | null;
  pets_on_property: boolean | null;
  pets_allowed: boolean | null;
  allowed_pet_types: string[];
  pet_extra_charges: boolean | null;
  pets_restricted_areas: string | null;
  pets_without_leash: boolean | null;
  pet_food_available: boolean | null;
  checkin_24_hours: boolean | null;
  acceptable_id_proofs: string[];
  infant_free_occupancy: boolean | null;
  infant_complimentary_food: boolean | null;
  extra_bed_included: boolean | null;
  provide_bed_extra_adults: boolean | null;
  provide_bed_extra_kids: boolean | null;
  extra_bed_adults_avail: string | null;
  extra_bed_adults_types: string[];
  extra_cot_charge_adult: string | null;
  extra_mattress_charge_adult: string | null;
  extra_sofa_charge_adult: string | null;
  extra_bed_kids_avail: string | null;
  extra_bed_kids_types: string[];
  extra_cot_charge_child: string | null;
  extra_mattress_charge_child: string | null;
  extra_sofa_charge_child: string | null;
  extra_crib_charge_child: string | null;
  meal_price_breakfast: string | null;
  meal_price_lunch: string | null;
  meal_price_dinner: string | null;
};

// ── UI primitives ─────────────────────────────────────────────────────────────

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
      <div className="divide-y divide-neutral-100">{children}</div>
    </Card>
  );
}

function YesNoButtons({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div role="group" className="flex rounded-lg border border-neutral-200 overflow-hidden shrink-0 text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={value === false}
        className={cn(
          "px-4 py-1.5 transition-colors",
          value === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50"
        )}
      >
        No
      </button>
      <div className="w-px bg-neutral-200" />
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value === true}
        className={cn(
          "px-4 py-1.5 transition-colors",
          value === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50"
        )}
      >
        Yes
      </button>
    </div>
  );
}

type BedAvail = "yes" | "no" | "subject_to_availability" | null;

function TriStateButtons({
  value,
  onChange,
}: {
  value: BedAvail;
  onChange: (v: BedAvail) => void;
}) {
  const btn = (v: Exclude<BedAvail, null>, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      className={cn(
        "flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-medium transition-colors",
        value === v
          ? v === "no"
            ? "bg-neutral-700 text-white"
            : "bg-primary-500 text-white"
          : "text-neutral-500 hover:bg-neutral-50"
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" className="flex w-full sm:w-auto sm:shrink-0 rounded-lg border border-neutral-200 overflow-hidden text-xs font-medium">
      {btn("no", "No")}
      <div className="w-px bg-neutral-200" />
      {btn("yes", "Yes")}
      <div className="w-px bg-neutral-200" />
      {btn("subject_to_availability", "Subject to availability")}
    </div>
  );
}

function ChargeInput({
  label,
  note,
  name,
  value,
  onChange,
}: {
  label: string;
  note?: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-3">
      <PLabel htmlFor={name} className="mb-0.5">{label}</PLabel>
      {note && <p className="text-[10px] text-neutral-400 leading-snug mb-2">{note}</p>}
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs text-neutral-400 font-medium">₹</span>
        <Input
          id={name}
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter amount"
          className="flex-1"
        />
      </div>
    </div>
  );
}

// Full-width policy row (label + yes/no + optional expanded children)
function PolicyRow({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 sm:justify-between px-5 py-3.5">
        <PLabel className="flex-1">{label}</PLabel>
        <YesNoButtons value={value} onChange={onChange} />
      </div>
      {value === true && children && (
        <div className="px-5 pb-4 pt-1 bg-primary-50/20 border-t border-neutral-100 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Inline yes/no row used inside expanded conditional sections
function SubRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 sm:justify-between py-1.5">
      <PLabel className="flex-1">{label}</PLabel>
      <YesNoButtons value={value} onChange={onChange} />
    </div>
  );
}

// Toggleable pill (checkbox replacement)
function Pill({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors",
        checked
          ? "bg-primary-500 text-white border-primary-500"
          : "border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50"
      )}
    >
      {checked && <CheckIcon size={10} weight="bold" aria-hidden="true" />}
      {label}
    </button>
  );
}

// ── Extra Bed Policies section ────────────────────────────────────────────────

type ExtraBedPoliciesProps = {
  bedAdultsAvail: BedAvail;   setBedAdultsAvail: (v: BedAvail) => void;
  bedAdultsTypes: string[];   setBedAdultsTypes: (v: string[]) => void;
  cotChargeAdult: string;     setCotChargeAdult: (v: string) => void;
  mattChargeAdult: string;    setMattChargeAdult: (v: string) => void;
  sofaChargeAdult: string;    setSofaChargeAdult: (v: string) => void;
  bedKidsAvail: BedAvail;     setBedKidsAvail: (v: BedAvail) => void;
  bedKidsTypes: string[];     setBedKidsTypes: (v: string[]) => void;
  cotChargeChild: string;     setCotChargeChild: (v: string) => void;
  mattChargeChild: string;    setMattChargeChild: (v: string) => void;
  sofaChargeChild: string;    setSofaChargeChild: (v: string) => void;
  cribChargeChild: string;    setCribChargeChild: (v: string) => void;
};

function ExtraBedPolicies(props: ExtraBedPoliciesProps) {
  const [open, setOpen] = useState(true);
  const rulesAdded = (props.bedAdultsAvail ? 1 : 0) + (props.bedKidsAvail ? 1 : 0);

  const adultNote = "Please add this only if these charges are not included as part of extra adult rates. These will be paid at the property";
  const childNote = "Please add this only if these charges are not included as part of extra child guest rates. These will be paid at the property";

  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-linear-to-b bg-neutral-50 rounded-t-[inherit] hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-semibold text-neutral-800">Extra Bed Policies</p>
          <span className="text-[10px] font-bold text-primary-600 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5">
            {rulesAdded}/2 RULES ADDED
          </span>
        </div>
        {open ? <CaretUpIcon size={16} className="text-neutral-400" /> : <CaretDownIcon size={16} className="text-neutral-400" />}
      </button>

      {open && (
        <div className="divide-y divide-neutral-100">
          {/* Adults */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between px-5 py-3.5">
              <PLabel className="flex-1">Do you provide bed to extra adults?</PLabel>
              <TriStateButtons value={props.bedAdultsAvail} onChange={props.setBedAdultsAvail} />
            </div>
            {props.bedAdultsAvail === "yes" && (
              <div className="px-5 pb-5 pt-1 bg-primary-50/20 border-t border-neutral-100 space-y-3">
                <div>
                  <PLabel htmlFor="pol-extra-bed-adult-types" className="mb-1.5">Please mention the type of extra bed provided to adults</PLabel>
                  <MultiSearchSelect
                    id="pol-extra-bed-adult-types"
                    options={EXTRA_BED_TYPES_ADULT}
                    value={props.bedAdultsTypes}
                    onChange={props.setBedAdultsTypes}
                    placeholder="Select types"
                    searchPlaceholder="Search bed types..."
                  />
                </div>
                {props.bedAdultsTypes.includes("Cot") && (
                  <ChargeInput label="Extra cot charges per adult?" note={adultNote} name="extra_cot_charge_adult" value={props.cotChargeAdult} onChange={props.setCotChargeAdult} />
                )}
                {props.bedAdultsTypes.includes("Mattress") && (
                  <ChargeInput label="Extra mattress charges per adult?" note={adultNote} name="extra_mattress_charge_adult" value={props.mattChargeAdult} onChange={props.setMattChargeAdult} />
                )}
                {props.bedAdultsTypes.includes("Sofa cum bed") && (
                  <ChargeInput label="Extra sofa cum bed charges per adult?" note={adultNote} name="extra_sofa_charge_adult" value={props.sofaChargeAdult} onChange={props.setSofaChargeAdult} />
                )}
              </div>
            )}
          </div>

          {/* Kids */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:justify-between px-5 py-3.5">
              <PLabel className="flex-1">Do you provide bed to extra kids?</PLabel>
              <TriStateButtons value={props.bedKidsAvail} onChange={props.setBedKidsAvail} />
            </div>
            {props.bedKidsAvail === "yes" && (
              <div className="px-5 pb-5 pt-1 bg-primary-50/20 border-t border-neutral-100 space-y-3">
                <div>
                  <PLabel htmlFor="pol-extra-bed-kids-types" className="mb-1.5">Please mention the type of extra bed provided to kids</PLabel>
                  <MultiSearchSelect
                    id="pol-extra-bed-kids-types"
                    options={EXTRA_BED_TYPES_CHILD}
                    value={props.bedKidsTypes}
                    onChange={props.setBedKidsTypes}
                    placeholder="Select types"
                    searchPlaceholder="Search bed types..."
                  />
                </div>
                {props.bedKidsTypes.includes("Cot") && (
                  <ChargeInput label="Extra cot charges per child?" note={childNote} name="extra_cot_charge_child" value={props.cotChargeChild} onChange={props.setCotChargeChild} />
                )}
                {props.bedKidsTypes.includes("Mattress") && (
                  <ChargeInput label="Extra mattress charges per child?" note={childNote} name="extra_mattress_charge_child" value={props.mattChargeChild} onChange={props.setMattChargeChild} />
                )}
                {props.bedKidsTypes.includes("Sofa cum bed") && (
                  <ChargeInput label="Extra sofa cum bed charges per child?" note={childNote} name="extra_sofa_charge_child" value={props.sofaChargeChild} onChange={props.setSofaChargeChild} />
                )}
                {props.bedKidsTypes.includes("Crib") && (
                  <ChargeInput label="Extra crib charges per child?" note={childNote} name="extra_crib_charge_child" value={props.cribChargeChild} onChange={props.setCribChargeChild} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Meal Rack Prices section ──────────────────────────────────────────────────

function MealRackPrices({
  breakfast, setBreakfast,
  lunch,     setLunch,
  dinner,    setDinner,
}: {
  breakfast: string; setBreakfast: (v: string) => void;
  lunch: string;     setLunch: (v: string) => void;
  dinner: string;    setDinner: (v: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const meals = [
    { label: "Breakfast", value: breakfast, onChange: setBreakfast, name: "meal_price_breakfast" },
    { label: "Lunch",     value: lunch,     onChange: setLunch,     name: "meal_price_lunch"     },
    { label: "Dinner",    value: dinner,    onChange: setDinner,    name: "meal_price_dinner"    },
  ];
  const rulesAdded = meals.filter((m) => m.value.trim() !== "").length;

  return (
    <Card variant="elevated" radius="md" className="overflow-hidden p-px">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-linear-to-b bg-neutral-50 rounded-t-[inherit] hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-semibold text-neutral-800">Meal rack prices</p>
          <span className="text-[10px] font-bold text-primary-600 bg-primary-50 border border-primary-200 rounded-full px-2 py-0.5">
            {rulesAdded}/{meals.length} RULES ADDED
          </span>
        </div>
        {open ? <CaretUpIcon size={16} className="text-neutral-400" /> : <CaretDownIcon size={16} className="text-neutral-400" />}
      </button>

      {open && (
        <div className="divide-y divide-neutral-100">
          {meals.map((meal) => (
            <div key={meal.label} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 sm:justify-between px-5 py-3.5">
              <PLabel htmlFor={meal.name} className="flex-1 min-w-0">{meal.label}</PLabel>
              <div className="flex items-center gap-1.5 w-full sm:w-48 sm:max-w-[40%] sm:shrink-0">
                <span className="text-xs text-neutral-400 font-medium shrink-0">₹</span>
                <Input
                  id={meal.name}
                  type="text"
                  name={meal.name}
                  value={meal.value}
                  onChange={(e) => meal.onChange(e.target.value)}
                  placeholder="Enter amount"
                  className="flex-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PoliciesTab({ hotel }: { hotel: PoliciesHotelData }) {
  const [state, formAction] = useActionState<PolicyState, FormData>(
    savePolicies.bind(null, hotel.id),
    {}
  );

  // Navigation is handled by server-side redirect in policy-actions.ts

  // Check-in / Check-out
  const [checkInTime,  setCheckInTime]  = useState(hotel.check_in_time  ?? "");
  const [checkOutTime, setCheckOutTime] = useState(hotel.check_out_time ?? "");

  // Cancellation
  const [cancellationPolicy, setCancellationPolicy] = useState<string>(hotel.cancellation_policy ?? "");

  // Guest profile
  const [allowUnmarriedCouples, setAllowUnmarriedCouples] = useState<boolean | null>(hotel.allow_unmarried_couples ?? null);
  const [showCoupleTag,         setShowCoupleTag]         = useState<boolean | null>(hotel.show_couple_tag         ?? null);
  const [allowGuestsBelow18,    setAllowGuestsBelow18]    = useState<boolean | null>(hotel.allow_guests_below_18   ?? null);
  const [allowMaleOnlyGroups,   setAllowMaleOnlyGroups]   = useState<boolean | null>(hotel.allow_male_only_groups  ?? null);
  const [allowSameCityId,       setAllowSameCityId]       = useState<boolean | null>(hotel.allow_same_city_id      ?? null);

  // Activity & accessibility
  const [smokingAllowed,        setSmokingAllowed]        = useState<boolean | null>(hotel.smoking_allowed        ?? null);
  const [partiesEventsAllowed,  setPartiesEventsAllowed]  = useState<boolean | null>(hotel.parties_events_allowed  ?? null);
  const [wheelchairAccessible,  setWheelchairAccessible]  = useState<boolean | null>(hotel.wheelchair_accessible  ?? null);
  const [allowOutsideVisitors,  setAllowOutsideVisitors]  = useState<boolean | null>(hotel.allow_outside_visitors  ?? null);

  // Pets
  const [petsOnProperty,       setPetsOnProperty]       = useState<boolean | null>(hotel.pets_on_property    ?? null);
  const [petsAllowed,          setPetsAllowed]          = useState<boolean | null>(hotel.pets_allowed         ?? null);
  const [allowedPetTypes,      setAllowedPetTypes]      = useState<string[]>(hotel.allowed_pet_types         ?? []);
  const [petExtraCharges,      setPetExtraCharges]      = useState<boolean | null>(hotel.pet_extra_charges    ?? null);
  const [petsRestrictedAreas,  setPetsRestrictedAreas]  = useState(hotel.pets_restricted_areas               ?? "");
  const [petsWithoutLeash,     setPetsWithoutLeash]     = useState<boolean | null>(hotel.pets_without_leash  ?? null);
  const [petFoodAvailable,     setPetFoodAvailable]     = useState<boolean | null>(hotel.pet_food_available   ?? null);

  // Additional
  const [checkin24Hours,       setCheckin24Hours]       = useState<boolean | null>(hotel.checkin_24_hours     ?? null);
  const [acceptableIdProofs,   setAcceptableIdProofs]   = useState<string[]>(hotel.acceptable_id_proofs       ?? []);

  // Child & extra bed
  const [infantFreeOccupancy,     setInfantFreeOccupancy]     = useState<boolean | null>(hotel.infant_free_occupancy     ?? null);
  const [infantComplimentaryFood, setInfantComplimentaryFood] = useState<boolean | null>(hotel.infant_complimentary_food ?? null);
  const [extraBedIncluded,        setExtraBedIncluded]        = useState<boolean | null>(hotel.extra_bed_included        ?? null);

  // Extra bed adults
  const [bedAdultsAvail,  setBedAdultsAvail]  = useState<BedAvail>((hotel.extra_bed_adults_avail as BedAvail) ?? null);
  const [bedAdultsTypes,  setBedAdultsTypes]  = useState<string[]>(hotel.extra_bed_adults_types  ?? []);
  const [cotChargeAdult,  setCotChargeAdult]  = useState(hotel.extra_cot_charge_adult         ?? "");
  const [mattChargeAdult, setMattChargeAdult] = useState(hotel.extra_mattress_charge_adult    ?? "");
  const [sofaChargeAdult, setSofaChargeAdult] = useState(hotel.extra_sofa_charge_adult        ?? "");

  // Extra bed kids
  const [bedKidsAvail,    setBedKidsAvail]    = useState<BedAvail>((hotel.extra_bed_kids_avail   as BedAvail) ?? null);
  const [bedKidsTypes,    setBedKidsTypes]    = useState<string[]>(hotel.extra_bed_kids_types    ?? []);
  const [cotChargeChild,  setCotChargeChild]  = useState(hotel.extra_cot_charge_child         ?? "");
  const [mattChargeChild, setMattChargeChild] = useState(hotel.extra_mattress_charge_child    ?? "");
  const [sofaChargeChild, setSofaChargeChild] = useState(hotel.extra_sofa_charge_child        ?? "");
  const [cribChargeChild, setCribChargeChild] = useState(hotel.extra_crib_charge_child        ?? "");

  // Meal rack prices
  const [mealBreakfast, setMealBreakfast] = useState(hotel.meal_price_breakfast ?? "");
  const [mealLunch,     setMealLunch]     = useState(hotel.meal_price_lunch     ?? "");
  const [mealDinner,    setMealDinner]    = useState(hotel.meal_price_dinner    ?? "");

  function toggle(arr: string[], item: string) {
    return arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
  }

  // Serialize boolean | null → "yes" | "no" | ""
  function b(v: boolean | null) {
    return v === null ? "" : v ? "yes" : "no";
  }

  return (
    <form id="wizard-form" action={formAction} className="space-y-5 py-5">
      {/* ── Hidden inputs ── all values must be present for FormData */}
      <input type="hidden" name="check_in_time"            value={checkInTime} />
      <input type="hidden" name="check_out_time"           value={checkOutTime} />
      <input type="hidden" name="cancellation_policy"      value={cancellationPolicy} />
      <input type="hidden" name="allow_unmarried_couples"  value={b(allowUnmarriedCouples)} />
      <input type="hidden" name="show_couple_tag"          value={b(showCoupleTag)} />
      <input type="hidden" name="allow_guests_below_18"    value={b(allowGuestsBelow18)} />
      <input type="hidden" name="allow_male_only_groups"   value={b(allowMaleOnlyGroups)} />
      <input type="hidden" name="allow_same_city_id"       value={b(allowSameCityId)} />
      <input type="hidden" name="smoking_allowed"          value={b(smokingAllowed)} />
      <input type="hidden" name="parties_events_allowed"   value={b(partiesEventsAllowed)} />
      <input type="hidden" name="wheelchair_accessible"    value={b(wheelchairAccessible)} />
      <input type="hidden" name="allow_outside_visitors"   value={b(allowOutsideVisitors)} />
      <input type="hidden" name="pets_on_property"         value={b(petsOnProperty)} />
      <input type="hidden" name="pets_allowed"             value={b(petsAllowed)} />
      <input type="hidden" name="allowed_pet_types"        value={allowedPetTypes.join(",")} />
      <input type="hidden" name="pet_extra_charges"        value={b(petExtraCharges)} />
      <input type="hidden" name="pets_restricted_areas"    value={petsRestrictedAreas} />
      <input type="hidden" name="pets_without_leash"       value={b(petsWithoutLeash)} />
      <input type="hidden" name="pet_food_available"       value={b(petFoodAvailable)} />
      <input type="hidden" name="checkin_24_hours"         value={b(checkin24Hours)} />
      <input type="hidden" name="acceptable_id_proofs"     value={acceptableIdProofs.join(",")} />
      <input type="hidden" name="infant_free_occupancy"    value={b(infantFreeOccupancy)} />
      <input type="hidden" name="infant_complimentary_food"   value={b(infantComplimentaryFood)} />
      <input type="hidden" name="extra_bed_included"         value={b(extraBedIncluded)} />
      <input type="hidden" name="extra_bed_adults_avail"     value={bedAdultsAvail ?? ""} />
      <input type="hidden" name="extra_bed_adults_types"     value={bedAdultsTypes.join(",")} />
      <input type="hidden" name="extra_bed_kids_avail"       value={bedKidsAvail ?? ""} />
      <input type="hidden" name="extra_bed_kids_types"       value={bedKidsTypes.join(",")} />
      <input type="hidden" name="meal_price_breakfast"       value={mealBreakfast} />
      <input type="hidden" name="meal_price_lunch"           value={mealLunch} />
      <input type="hidden" name="meal_price_dinner"          value={mealDinner} />

      {state?.error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
          {state.error}
        </div>
      )}

      {/* ── 1. Check-in & Check-out Time ──────────────────────────────── */}
      <SectionCard title="Check-in & Check-out Time">
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <PLabel htmlFor="pol-checkin-time" className="mb-1.5">Check-in Time</PLabel>
            <SearchSelect
              id="pol-checkin-time"
              options={TIME_OPTIONS}
              value={checkInTime}
              onChange={setCheckInTime}
              placeholder="Select time"
              searchPlaceholder="Search time…"
            />
          </div>
          <div>
            <PLabel htmlFor="pol-checkout-time" className="mb-1.5">Check-out Time</PLabel>
            <SearchSelect
              id="pol-checkout-time"
              options={TIME_OPTIONS}
              value={checkOutTime}
              onChange={setCheckOutTime}
              placeholder="Select time"
              searchPlaceholder="Search time…"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Cancellation Policy ────────────────────────────────────── */}
      <SectionCard title="Cancellation Policy">
        <div className="px-5 py-4 space-y-2.5">
          {CANCELLATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCancellationPolicy(opt.value)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                cancellationPolicy === opt.value
                  ? "border-primary-300 bg-primary-50"
                  : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
              )}
            >
              <div className={cn(
                "size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                cancellationPolicy === opt.value ? "border-primary-500" : "border-neutral-300"
              )}>
                {cancellationPolicy === opt.value && (
                  <div className="size-2 rounded-full bg-primary-500" />
                )}
              </div>
              <span className="text-xs text-neutral-700 flex-1">{opt.label}</span>
              {opt.recommended && (
                <span className="shrink-0 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  Recommended
                </span>
              )}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ── 3. Property Rules — Guest Profile ────────────────────────── */}
      <SectionCard title="Property Rules" description="Guest Profile">
        <PolicyRow
          label="Do you allow unmarried couples?"
          value={allowUnmarriedCouples}
          onChange={setAllowUnmarriedCouples}
        >
          <SubRow
            label="Do you want to show couple friendly tag on your listing?"
            value={showCoupleTag}
            onChange={setShowCoupleTag}
          />
        </PolicyRow>
        <PolicyRow
          label="Do you allow guests below 18 years of age at your property?"
          value={allowGuestsBelow18}
          onChange={setAllowGuestsBelow18}
        />
        <PolicyRow
          label="Groups with only male guests are allowed at your property?"
          value={allowMaleOnlyGroups}
          onChange={setAllowMaleOnlyGroups}
        />
        <PolicyRow
          label="Are IDs of the same city at the property allowed?"
          value={allowSameCityId}
          onChange={setAllowSameCityId}
        />
      </SectionCard>

      {/* ── 4. Property Rules — Activity & Accessibility ──────────────── */}
      <SectionCard title="Property Rules" description="Activity & Accessibility">
        <PolicyRow
          label="Is smoking allowed anywhere within the premises?"
          value={smokingAllowed}
          onChange={setSmokingAllowed}
        />
        <PolicyRow
          label="Are private parties or events allowed at the property?"
          value={partiesEventsAllowed}
          onChange={setPartiesEventsAllowed}
        />
        <PolicyRow
          label="Is your property accessible for guests who use a wheelchair?"
          value={wheelchairAccessible}
          onChange={setWheelchairAccessible}
        />
        <PolicyRow
          label="Can guests invite any outside visitors in the room during their stay?"
          value={allowOutsideVisitors}
          onChange={setAllowOutsideVisitors}
        />
      </SectionCard>

      {/* ── 5. Pets Policy ───────────────────────────────────────────── */}
      <SectionCard title="Pets Policy">
        <PolicyRow
          label="Any pet(s) living on the property?"
          value={petsOnProperty}
          onChange={setPetsOnProperty}
        />
        <PolicyRow
          label="Are pets allowed?"
          value={petsAllowed}
          onChange={setPetsAllowed}
        >
          {/* Which pets */}
          <div>
            <PLabel className="mb-2">Which pets are allowed at the property?</PLabel>
            <div className="flex flex-wrap gap-2">
              {PET_TYPE_OPTIONS.map((pet) => (
                <Pill
                  key={pet}
                  label={pet}
                  checked={allowedPetTypes.includes(pet)}
                  onToggle={() => setAllowedPetTypes(toggle(allowedPetTypes, pet))}
                />
              ))}
            </div>
          </div>
          <SubRow label="Are there any extra charges for pets?" value={petExtraCharges} onChange={setPetExtraCharges} />
          <div>
            <PLabel htmlFor="pol-pets-restricted-areas" className="mb-1.5">Pets are restricted/not allowed in these areas?</PLabel>
            <Input
              id="pol-pets-restricted-areas"
              value={petsRestrictedAreas}
              onChange={(e) => setPetsRestrictedAreas(e.target.value)}
              placeholder="e.g. Restaurant, Pool area, Lobby"
            />
          </div>
          <SubRow label="Are pets allowed to roam around without leash?" value={petsWithoutLeash} onChange={setPetsWithoutLeash} />
          <SubRow label="Is pet food available at the property?" value={petFoodAvailable} onChange={setPetFoodAvailable} />
        </PolicyRow>
      </SectionCard>

      {/* ── 6. Additional Policies ───────────────────────────────────── */}
      <SectionCard title="Additional Policies">
        <PolicyRow
          label="Do you have a 24-hour check-in?"
          value={checkin24Hours}
          onChange={setCheckin24Hours}
        />
        <div className="px-5 py-4">
          <PLabel className="mb-2.5">Acceptable Identity Proofs</PLabel>
          <div className="flex flex-wrap gap-2">
            {ID_PROOF_OPTIONS.map((proof) => (
              <Pill
                key={proof}
                label={proof}
                checked={acceptableIdProofs.includes(proof)}
                onToggle={() => setAcceptableIdProofs(toggle(acceptableIdProofs, proof))}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── 7. Child & Extra Bed Policy ──────────────────────────────── */}
      <SectionCard title="Child & Extra Bed Policy">
        <PolicyRow
          label="Do you want to include 1 infant (0–2 yrs) per room without counting them in total room occupancy?"
          value={infantFreeOccupancy}
          onChange={setInfantFreeOccupancy}
        />
        <PolicyRow
          label="Do you provide complimentary food item(s) like warm milk for infants (0–2 yrs) on request?"
          value={infantComplimentaryFood}
          onChange={setInfantComplimentaryFood}
        />
        <PolicyRow
          label="Is extra bed/mattress included in extra adult/paid child rates?"
          value={extraBedIncluded}
          onChange={setExtraBedIncluded}
        />
      </SectionCard>

      {/* ── 8. Extra Bed Policies ─────────────────────────────────────── */}
      <ExtraBedPolicies
        bedAdultsAvail={bedAdultsAvail}   setBedAdultsAvail={setBedAdultsAvail}
        bedAdultsTypes={bedAdultsTypes}   setBedAdultsTypes={setBedAdultsTypes}
        cotChargeAdult={cotChargeAdult}   setCotChargeAdult={setCotChargeAdult}
        mattChargeAdult={mattChargeAdult} setMattChargeAdult={setMattChargeAdult}
        sofaChargeAdult={sofaChargeAdult} setSofaChargeAdult={setSofaChargeAdult}
        bedKidsAvail={bedKidsAvail}       setBedKidsAvail={setBedKidsAvail}
        bedKidsTypes={bedKidsTypes}       setBedKidsTypes={setBedKidsTypes}
        cotChargeChild={cotChargeChild}   setCotChargeChild={setCotChargeChild}
        mattChargeChild={mattChargeChild} setMattChargeChild={setMattChargeChild}
        sofaChargeChild={sofaChargeChild} setSofaChargeChild={setSofaChargeChild}
        cribChargeChild={cribChargeChild} setCribChargeChild={setCribChargeChild}
      />

      {/* ── 9. Meal Rack Prices ───────────────────────────────────────── */}
      <MealRackPrices
        breakfast={mealBreakfast} setBreakfast={setMealBreakfast}
        lunch={mealLunch}         setLunch={setMealLunch}
        dinner={mealDinner}       setDinner={setMealDinner}
      />
    </form>
  );
}
