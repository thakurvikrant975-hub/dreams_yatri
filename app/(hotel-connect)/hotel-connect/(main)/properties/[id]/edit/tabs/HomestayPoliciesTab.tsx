"use client";

import { useActionState, useState } from "react";
import { saveHomestayPolicy, type HomestayPolicyState } from "./homestay-policy-actions";
import { HotelCancellationPolicy } from "@/app/generated/prisma";
import { cn } from "@/app/lib/utils";
import { SearchSelect, MultiSearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { Card } from "@/app/components/ui/Card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Textarea } from "../../../../components/ui/textarea";

function PLabel({ className, ...props }: React.ComponentProps<"label">) {
  return <Label className={cn("normal-case tracking-normal", className)} {...props} />;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type HomestayPoliciesData = {
  id: number;
  check_in_time:           string | null;
  check_out_time:          string | null;
  has_check_in_end_time:   boolean | null;
  check_in_end_time:       string | null;
  cancellation_policy:     HotelCancellationPolicy | null;
  allow_unmarried_couples: boolean | null;
  show_couple_tag:         boolean | null;
  allow_guests_below_18:   boolean | null;
  allow_male_only_groups:  boolean | null;
  acceptable_id_proofs:    string[];
  allow_same_city_id:      boolean | null;
  smoking_allowed:         boolean | null;
  smoking_areas:           string | null;
  parties_events_allowed:  boolean | null;
  wheelchair_accessible:   boolean | null;
  entry_exit_restrictions: boolean | null;
  allow_outside_visitors:  boolean | null;
  noise_policy:            string | null;
  pets_on_property:        boolean | null;
  pets_allowed:            boolean | null;
  allowed_pet_types:       string[];
  pet_extra_charges:       boolean | null;
  pet_charge_amount:       string | null;
  pet_food_available:      boolean | null;
  pets_restricted_areas:   string | null;
  pets_without_leash:      boolean | null;
  pet_count:               number | null;
  food_kitchen_available:  boolean | null;
  caretaker_stays:         boolean | null;
  caretaker_details:       string | null;
  caretaker_availability:  string | null;
  caretaker_services:      string[];
  caretaker_knowledge:     string[];
  caretaker_helps_cleaning:boolean | null;
  self_checkin_smart_door: boolean | null;
  host_greets_helps:       boolean | null;
  caretaker_greets_helps:  boolean | null;
  building_staff_keys:     boolean | null;
  checkin_24_hours:        boolean | null;
  custom_policy:           string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const ampm = i < 12 ? "am" : "pm";
  const suffix = i === 0 ? " (midnight)" : i === 12 ? " (noon)" : "";
  return { value: `${String(i).padStart(2, "0")}:00`, label: `${h}:00 ${ampm}${suffix}` };
});

const CANCELLATION_OPTIONS: { value: HotelCancellationPolicy; label: string }[] = [
  { value: HotelCancellationPolicy.FREE_TILL_CHECKIN, label: "Free Cancellation till check-in" },
  { value: HotelCancellationPolicy.FREE_TILL_24H,     label: "Free Cancellation till 24 hours before check-in" },
  { value: HotelCancellationPolicy.FREE_TILL_72H,     label: "Free Cancellation till 72 hours before check-in" },
  { value: HotelCancellationPolicy.FREE_TILL_7D,      label: "Free Cancellation till 7 days before check-in" },
  { value: HotelCancellationPolicy.NON_REFUNDABLE,    label: "Non-Refundable" },
];

const ID_PROOF_OPTIONS = ["Aadhaar Card", "Passport", "Driving License", "Voter ID", "PAN Card"];
const PET_TYPE_OPTIONS  = ["Dogs", "Cats", "Birds", "Fish", "Rabbits", "Other"];

const SMOKING_AREA_OPTIONS = [
  "Outdoor only",
  "Designated area",
  "Balcony / Terrace",
  "Common areas",
  "Garden / Lawn",
];

const PET_AREA_OPTIONS = [
  "Bedrooms",
  "Living Room",
  "Kitchen",
  "Dining Area",
  "All Indoor Areas",
];

const CARETAKER_AVAIL_OPTIONS = [
  { value: "24_7",       label: "Available 24/7" },
  { value: "on_request", label: "Available on request" },
  { value: "specific",   label: "Available during specific hours" },
  { value: "daytime",    label: "Daytime only" },
];

const CARETAKER_SERVICES = [
  "Cab Bookings",
  "Car/Bike Rentals",
  "Restaurant Reservations",
  "Pick-up and Drop Services",
];

const CARETAKER_KNOWLEDGE = [
  "Local places",
  "Activities of interest",
];

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

function SubSectionHeader({ label }: { label: string }) {
  return (
    <div className="px-5 py-2.5 bg-neutral-50/60 border-b border-neutral-100">
      <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
    </div>
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
    <div className="flex rounded-lg border border-neutral-200 overflow-hidden shrink-0 text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "px-4 py-1.5 transition-colors",
          value === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50",
        )}
      >
        No
      </button>
      <div className="w-px bg-neutral-200" />
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "px-4 py-1.5 transition-colors",
          value === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50",
        )}
      >
        Yes
      </button>
    </div>
  );
}

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
      <div className="flex items-center justify-between gap-6 px-5 py-3.5">
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
    <div className="flex items-center justify-between gap-6 py-1.5">
      <PLabel className="flex-1">{label}</PLabel>
      <YesNoButtons value={value} onChange={onChange} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <PLabel className="mb-1.5">{children}</PLabel>;
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <SearchSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? "Select…"}
      searchPlaceholder="Search…"
    />
  );
}

function CheckboxGroup({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(item: string) {
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item],
    );
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              active
                ? "bg-primary-500 text-white border-primary-500"
                : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomestayPoliciesTab({ hotel }: { hotel: HomestayPoliciesData }) {
  const boundAction = saveHomestayPolicy.bind(null, hotel.id);
  const [state, formAction] = useActionState<HomestayPolicyState, FormData>(boundAction, {});

  // Check-in / out
  const [checkInTime,         setCheckInTime]         = useState(hotel.check_in_time          ?? "");
  const [checkOutTime,        setCheckOutTime]         = useState(hotel.check_out_time         ?? "");
  const [hasEndTime,          setHasEndTime]           = useState(hotel.has_check_in_end_time  ?? false);
  const [checkInEndTime,      setCheckInEndTime]       = useState(hotel.check_in_end_time      ?? "");

  // Cancellation
  const [cancellation,        setCancellation]         = useState<HotelCancellationPolicy | null>(hotel.cancellation_policy);

  // Guest profile
  const [unmarriedCouples,    setUnmarriedCouples]     = useState(hotel.allow_unmarried_couples ?? null);
  const [coupleTag,           setCoupleTag]            = useState(hotel.show_couple_tag         ?? null);
  const [guestsBelow18,       setGuestsBelow18]        = useState(hotel.allow_guests_below_18   ?? null);
  const [maleOnlyGroups,      setMaleOnlyGroups]       = useState(hotel.allow_male_only_groups  ?? null);
  const [idProofs,            setIdProofs]             = useState<string[]>(hotel.acceptable_id_proofs ?? []);
  const [sameCityId,          setSameCityId]           = useState(hotel.allow_same_city_id      ?? null);

  // Property restrictions
  const [smokingAllowed,      setSmokingAllowed]       = useState(hotel.smoking_allowed         ?? null);
  const [smokingAreas,        setSmokingAreas]         = useState(hotel.smoking_areas           ?? "");
  const [partiesAllowed,      setPartiesAllowed]       = useState(hotel.parties_events_allowed  ?? null);
  const [wheelchairAccess,    setWheelchairAccess]     = useState(hotel.wheelchair_accessible   ?? null);
  const [entryExitRestrict,   setEntryExitRestrict]    = useState(hotel.entry_exit_restrictions ?? null);
  const [outsideVisitors,     setOutsideVisitors]      = useState(hotel.allow_outside_visitors  ?? null);
  const [noisePolicy,         setNoisePolicy]          = useState(hotel.noise_policy            ?? "");

  // Pet policy
  const [petsOnProperty,      setPetsOnProperty]       = useState(hotel.pets_on_property        ?? null);
  const [petsAllowed,         setPetsAllowed]          = useState(hotel.pets_allowed             ?? null);
  const [petTypes,            setPetTypes]             = useState<string[]>(hotel.allowed_pet_types ?? []);
  const [petExtraCharges,     setPetExtraCharges]      = useState(hotel.pet_extra_charges        ?? null);
  const [petChargeAmount,     setPetChargeAmount]      = useState(hotel.pet_charge_amount        ?? "");
  const [petFoodAvail,        setPetFoodAvail]         = useState(hotel.pet_food_available       ?? null);
  const [petsRestrictAreas,   setPetsRestrictAreas]    = useState(hotel.pets_restricted_areas    ?? "");
  const [petsWithoutLeash,    setPetsWithoutLeash]     = useState(hotel.pets_without_leash       ?? null);
  const [petCount,            setPetCount]             = useState<string>(hotel.pet_count != null ? String(hotel.pet_count) : "");

  // Food & kitchen
  const [foodKitchen,         setFoodKitchen]          = useState(hotel.food_kitchen_available   ?? null);

  // Caretaker
  const [caretakerStays,      setCaretakerStays]       = useState(hotel.caretaker_stays          ?? null);
  const [caretakerDetails,    setCaretakerDetails]     = useState(hotel.caretaker_details        ?? "");
  const [caretakerAvail,      setCaretakerAvail]       = useState(hotel.caretaker_availability   ?? "");
  const [caretakerSvcs,       setCaretakerSvcs]        = useState<string[]>(hotel.caretaker_services ?? []);
  const [caretakerKnow,       setCaretakerKnow]        = useState<string[]>(hotel.caretaker_knowledge ?? []);
  const [caretakerCleaning,   setCaretakerCleaning]    = useState(hotel.caretaker_helps_cleaning ?? null);

  // Key exchange
  const [smartDoor,           setSmartDoor]            = useState(hotel.self_checkin_smart_door  ?? null);
  const [hostGreets,          setHostGreets]           = useState(hotel.host_greets_helps         ?? null);
  const [caretakerGreets,     setCaretakerGreets]      = useState(hotel.caretaker_greets_helps    ?? null);
  const [buildingStaff,       setBuildingStaff]        = useState(hotel.building_staff_keys       ?? null);

  // 24h check-in & custom
  const [checkin24h,          setCheckin24h]           = useState(hotel.checkin_24_hours           ?? null);
  const [customPolicy,        setCustomPolicy]         = useState(hotel.custom_policy              ?? "");

  function b(v: boolean | null): string {
    if (v === true)  return "yes";
    if (v === false) return "no";
    return "";
  }

  return (
    <>
      <form id="wizard-form" action={formAction} className="space-y-5 py-5">
        {/* ── Hidden serialised state ─────────────────────────────────────────── */}
        <input type="hidden" name="check_in_time"           value={checkInTime} />
        <input type="hidden" name="check_out_time"          value={checkOutTime} />
        <input type="hidden" name="has_check_in_end_time"   value={b(hasEndTime)} />
        <input type="hidden" name="check_in_end_time"       value={checkInEndTime} />
        <input type="hidden" name="cancellation_policy"     value={cancellation ?? ""} />
        <input type="hidden" name="allow_unmarried_couples" value={b(unmarriedCouples)} />
        <input type="hidden" name="show_couple_tag"         value={b(coupleTag)} />
        <input type="hidden" name="allow_guests_below_18"   value={b(guestsBelow18)} />
        <input type="hidden" name="allow_male_only_groups"  value={b(maleOnlyGroups)} />
        <input type="hidden" name="acceptable_id_proofs"    value={idProofs.join(",")} />
        <input type="hidden" name="allow_same_city_id"      value={b(sameCityId)} />
        <input type="hidden" name="smoking_allowed"         value={b(smokingAllowed)} />
        <input type="hidden" name="smoking_areas"           value={smokingAreas} />
        <input type="hidden" name="parties_events_allowed"  value={b(partiesAllowed)} />
        <input type="hidden" name="wheelchair_accessible"   value={b(wheelchairAccess)} />
        <input type="hidden" name="entry_exit_restrictions" value={b(entryExitRestrict)} />
        <input type="hidden" name="allow_outside_visitors"  value={b(outsideVisitors)} />
        <input type="hidden" name="noise_policy"            value={noisePolicy} />
        <input type="hidden" name="pets_on_property"        value={b(petsOnProperty)} />
        <input type="hidden" name="pets_allowed"            value={b(petsAllowed)} />
        <input type="hidden" name="allowed_pet_types"       value={petTypes.join(",")} />
        <input type="hidden" name="pet_extra_charges"       value={b(petExtraCharges)} />
        <input type="hidden" name="pet_charge_amount"       value={petChargeAmount} />
        <input type="hidden" name="pet_food_available"      value={b(petFoodAvail)} />
        <input type="hidden" name="pets_restricted_areas"   value={petsRestrictAreas} />
        <input type="hidden" name="pets_without_leash"      value={b(petsWithoutLeash)} />
        <input type="hidden" name="pet_count"               value={petCount} />
        <input type="hidden" name="food_kitchen_available"  value={b(foodKitchen)} />
        <input type="hidden" name="caretaker_stays"         value={b(caretakerStays)} />
        <input type="hidden" name="caretaker_details"       value={caretakerDetails} />
        <input type="hidden" name="caretaker_availability"  value={caretakerAvail} />
        <input type="hidden" name="caretaker_services"      value={caretakerSvcs.join(",")} />
        <input type="hidden" name="caretaker_knowledge"     value={caretakerKnow.join(",")} />
        <input type="hidden" name="caretaker_helps_cleaning"value={b(caretakerCleaning)} />
        <input type="hidden" name="self_checkin_smart_door" value={b(smartDoor)} />
        <input type="hidden" name="host_greets_helps"       value={b(hostGreets)} />
        <input type="hidden" name="caretaker_greets_helps"  value={b(caretakerGreets)} />
        <input type="hidden" name="building_staff_keys"     value={b(buildingStaff)} />
        <input type="hidden" name="checkin_24_hours"        value={b(checkin24h)} />
        <input type="hidden" name="custom_policy"           value={customPolicy} />

        {state?.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
            {state.error}
          </div>
        )}

        {/* ── 1. Check-in & Check-out Time ──────────────────────────────── */}
        <SectionCard title="Check-in & Check-out Time">
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <PLabel className="mb-1.5">Check-in Time</PLabel>
              <SearchSelect
                options={TIME_OPTIONS}
                value={checkInTime}
                onChange={setCheckInTime}
                placeholder="Select time"
                searchPlaceholder="Search time…"
              />
            </div>
            <div>
              <PLabel className="mb-1.5">Check-out Time</PLabel>
              <SearchSelect
                options={TIME_OPTIONS}
                value={checkOutTime}
                onChange={setCheckOutTime}
                placeholder="Select time"
                searchPlaceholder="Search time…"
              />
            </div>
          </div>
          <div className="px-5 pb-4 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hasEndTime}
                onChange={(e) => setHasEndTime(e.target.checked)}
                className="size-4 rounded border-neutral-300 accent-primary-500"
              />
              <span className="text-xs text-neutral-700">My property has a check-in end time</span>
            </label>
            {hasEndTime && (
              <div className="max-w-xs ml-6">
                <PLabel className="mb-1.5">Check-in End Time</PLabel>
                <SearchSelect
                  options={TIME_OPTIONS}
                  value={checkInEndTime}
                  onChange={setCheckInEndTime}
                  placeholder="Select time"
                  searchPlaceholder="Search time…"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── 2. Cancellation Policy ────────────────────────────────────── */}
        <SectionCard title="Cancellation Policy">
          <div className="px-5 py-4 space-y-2.5">
            {CANCELLATION_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={cn(
                    "size-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    cancellation === opt.value
                      ? "border-primary-500 bg-primary-500"
                      : "border-neutral-300 group-hover:border-primary-300",
                  )}
                  onClick={() => setCancellation(opt.value as HotelCancellationPolicy)}
                >
                  {cancellation === opt.value && (
                    <div className="size-1.5 rounded-full bg-white" />
                  )}
                </div>
                <input
                  type="radio"
                  name="_cp"
                  value={opt.value}
                  checked={cancellation === opt.value}
                  onChange={() => setCancellation(opt.value as HotelCancellationPolicy)}
                  className="sr-only"
                />
                <span className="text-xs text-neutral-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* ── 3. Property Rules ─────────────────────────────────────────── */}
        <SectionCard title="Property Rules">
          <SubSectionHeader label="Guest Profile" />

          <PolicyRow label="Do you allow unmarried couples?" value={unmarriedCouples} onChange={(v) => { setUnmarriedCouples(v); if (!v) setCoupleTag(null); }}>
            <SubRow label="Do you want to show couple friendly tag?" value={coupleTag} onChange={setCoupleTag} />
          </PolicyRow>
          <PolicyRow label="Do you allow guests below 18 years of age?" value={guestsBelow18} onChange={setGuestsBelow18} />
          <PolicyRow label="Groups with only male guests allowed?" value={maleOnlyGroups} onChange={setMaleOnlyGroups} />

          <div className="px-5 py-3.5 space-y-3">
            <PLabel>Acceptable Identity Proofs</PLabel>
            <MultiSearchSelect
              options={ID_PROOF_OPTIONS}
              value={idProofs}
              onChange={setIdProofs}
              placeholder="Select accepted ID types"
            />
          </div>
          <PolicyRow label="Are IDs of the same city allowed?" value={sameCityId} onChange={setSameCityId} />

          <SubSectionHeader label="Property Restrictions" />

          <PolicyRow label="Is smoking allowed?" value={smokingAllowed} onChange={(v) => { setSmokingAllowed(v); if (!v) setSmokingAreas(""); }}>
            <FieldLabel>Where is smoking allowed?</FieldLabel>
            <SelectField
              value={smokingAreas}
              onChange={setSmokingAreas}
              options={SMOKING_AREA_OPTIONS.map((s) => ({ value: s, label: s }))}
              placeholder="Select smoking area"
            />
          </PolicyRow>
          <PolicyRow label="Are private parties or events allowed?" value={partiesAllowed} onChange={setPartiesAllowed} />
          <PolicyRow label="Is your property accessible for wheelchairs?" value={wheelchairAccess} onChange={setWheelchairAccess} />
          <PolicyRow label="Restrictions on entry & exit timings?" value={entryExitRestrict} onChange={setEntryExitRestrict} />
          <PolicyRow label="Can guests invite outside visitors?" value={outsideVisitors} onChange={setOutsideVisitors} />

          <div className="px-5 py-3.5">
            <PLabel className="mb-1.5">Music / Noise Policy</PLabel>
            <Input
              type="text"
              value={noisePolicy}
              onChange={(e) => setNoisePolicy(e.target.value)}
              placeholder="e.g. No loud music after 10 PM"
            />
          </div>
        </SectionCard>

        {/* ── 4. Pet Policy ────────────────────────────────────────────── */}
        <SectionCard title="Pet Policy">
          <PolicyRow label="Any pet(s) living on the property?" value={petsOnProperty} onChange={setPetsOnProperty} />
          <PolicyRow label="Are pets allowed?" value={petsAllowed} onChange={(v) => { setPetsAllowed(v); if (!v) { setPetTypes([]); setPetExtraCharges(null); setPetChargeAmount(""); setPetFoodAvail(null); } }}>
            <FieldLabel>Which pets are allowed?</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {PET_TYPE_OPTIONS.map((p) => {
                const active = petTypes.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setPetTypes(active ? petTypes.filter((x) => x !== p) : [...petTypes, p])
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      active ? "bg-primary-500 text-white border-primary-500" : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <SubRow label="Are there any extra charges for pets?" value={petExtraCharges} onChange={setPetExtraCharges} />
            {petExtraCharges === true && (
              <div>
                <FieldLabel>Charges in INR</FieldLabel>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-400 font-medium">₹</span>
                  <Input
                    type="number"
                    min="0"
                    value={petChargeAmount}
                    onChange={(e) => setPetChargeAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-32"
                  />
                </div>
              </div>
            )}
            <SubRow label="Is pet food available?" value={petFoodAvail} onChange={setPetFoodAvail} />
          </PolicyRow>

          <div className="px-5 py-3.5 space-y-3">
            <PLabel>Pets restricted in these areas</PLabel>
            <MultiSearchSelect
              options={PET_AREA_OPTIONS}
              value={petsRestrictAreas ? petsRestrictAreas.split(",").map((s) => s.trim()).filter(Boolean) : []}
              onChange={(arr) => setPetsRestrictAreas(arr.join(","))}
              placeholder="Select restricted areas"
            />
          </div>

          <PolicyRow label="Are pets allowed to roam without leash?" value={petsWithoutLeash} onChange={setPetsWithoutLeash} />

          <div className="px-5 py-3.5">
            <PLabel className="mb-1.5">No. of pets allowed</PLabel>
            <Input
              type="number"
              min="0"
              value={petCount}
              onChange={(e) => setPetCount(e.target.value)}
              placeholder="Enter number"
              className="w-28"
            />
          </div>
        </SectionCard>

        {/* ── 5. Food & Kitchen Rules ───────────────────────────────────── */}
        <SectionCard title="Food & Kitchen Rules">
          <PolicyRow label="Are food & kitchen available?" value={foodKitchen} onChange={setFoodKitchen} />
        </SectionCard>

        {/* ── 6. Caretaker Information ──────────────────────────────────── */}
        <SectionCard title="Caretaker Information">
          <PolicyRow label="Does the caretaker stay at the property?" value={caretakerStays} onChange={(v) => { setCaretakerStays(v); if (!v) setCaretakerDetails(""); }}>
            <FieldLabel>Caretaker details</FieldLabel>
            <Textarea
              value={caretakerDetails}
              onChange={(e) => setCaretakerDetails(e.target.value)}
              rows={3}
              placeholder="Describe the caretaker and their role…"
            />
          </PolicyRow>

          <div className="px-5 py-3.5">
            <PLabel className="mb-1.5">Caretaker availability</PLabel>
            <SelectField
              value={caretakerAvail}
              onChange={setCaretakerAvail}
              options={CARETAKER_AVAIL_OPTIONS}
              placeholder="Select availability"
            />
          </div>

          <div className="px-5 py-3.5 space-y-2">
            <PLabel>Caretaker services</PLabel>
            <CheckboxGroup
              options={CARETAKER_SERVICES}
              selected={caretakerSvcs}
              onChange={setCaretakerSvcs}
            />
          </div>

          <div className="px-5 py-3.5 space-y-2">
            <PLabel>Caretaker knowledge</PLabel>
            <CheckboxGroup
              options={CARETAKER_KNOWLEDGE}
              selected={caretakerKnow}
              onChange={setCaretakerKnow}
            />
          </div>

          <PolicyRow label="Does the caretaker help in cleaning?" value={caretakerCleaning} onChange={setCaretakerCleaning} />
        </SectionCard>

        {/* ── 7. Key Exchange ───────────────────────────────────────────── */}
        <SectionCard title="Key Exchange">
          <PolicyRow label="Self Check-in via Smart Door?" value={smartDoor} onChange={setSmartDoor} />
          <PolicyRow label="Host Greets & Helps?" value={hostGreets} onChange={setHostGreets} />
          <PolicyRow label="Caretaker Greets & Helps?" value={caretakerGreets} onChange={setCaretakerGreets} />
          <PolicyRow label="Collect or Deposit Keys through Building Staff?" value={buildingStaff} onChange={setBuildingStaff} />
        </SectionCard>

        {/* ── 8. Check-in & Check-out Policies ─────────────────────────── */}
        <SectionCard title="Check-in & Check-out Policies">
          <PolicyRow label="Do you have a 24-hour check-in?" value={checkin24h} onChange={setCheckin24h} />
        </SectionCard>

        {/* ── 9. Custom Policy ──────────────────────────────────────────── */}
        <SectionCard title="Custom Policy">
          <div className="px-5 py-4">
            <Textarea
              value={customPolicy}
              onChange={(e) => setCustomPolicy(e.target.value)}
              rows={4}
              placeholder="Add any additional policies specific to your property…"
            />
          </div>
        </SectionCard>
      </form>
    </>
  );
}
