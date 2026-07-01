"use client";

import { useActionState, useState } from "react";
import { savePolicies, type PolicyState } from "./policy-actions";
import { HotelCancellationPolicy } from "@/app/generated/prisma";
import { cn } from "@/app/lib/utils";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

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
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50">
        <p className="text-sm font-semibold text-neutral-800">{title}</p>
        {description && <p className="text-[11px] text-neutral-400 mt-0.5">{description}</p>}
      </div>
      <div className="divide-y divide-neutral-100">{children}</div>
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
          value === false ? "bg-neutral-700 text-white" : "text-neutral-500 hover:bg-neutral-50"
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
          value === true ? "bg-primary-500 text-white" : "text-neutral-500 hover:bg-neutral-50"
        )}
      >
        Yes
      </button>
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
      <div className="flex items-center justify-between gap-6 px-5 py-3.5">
        <p className="text-xs text-neutral-700 leading-snug flex-1">{label}</p>
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
    <div className="flex items-center justify-between gap-6 py-1.5">
      <p className="text-xs text-neutral-600 leading-snug flex-1">{label}</p>
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
      className={cn(
        "inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-colors",
        checked
          ? "bg-primary-500 text-white border-primary-500"
          : "border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50"
      )}
    >
      {checked && <CheckIcon size={10} weight="bold" />}
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PoliciesTab({ hotel }: { hotel: PoliciesHotelData }) {
  const [state, formAction] = useActionState<PolicyState, FormData>(
    savePolicies.bind(null, hotel.id),
    {}
  );

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
  const [provideBedExtraAdults,   setProvideBedExtraAdults]   = useState<boolean | null>(hotel.provide_bed_extra_adults  ?? null);
  const [provideBedExtraKids,     setProvideBedExtraKids]     = useState<boolean | null>(hotel.provide_bed_extra_kids    ?? null);

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
      <input type="hidden" name="infant_complimentary_food" value={b(infantComplimentaryFood)} />
      <input type="hidden" name="extra_bed_included"       value={b(extraBedIncluded)} />
      <input type="hidden" name="provide_bed_extra_adults" value={b(provideBedExtraAdults)} />
      <input type="hidden" name="provide_bed_extra_kids"   value={b(provideBedExtraKids)} />

      {state?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
          {state.error}
        </div>
      )}

      {/* ── 1. Check-in & Check-out Time ──────────────────────────────── */}
      <SectionCard title="Check-in & Check-out Time">
        <div className="px-5 py-4 grid grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Check-in Time</label>
            <select
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 pr-8 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 appearance-none"
            >
              <option value="">Select time</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Check-out Time</label>
            <select
              value={checkOutTime}
              onChange={(e) => setCheckOutTime(e.target.value)}
              className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 pr-8 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 appearance-none"
            >
              <option value="">Select time</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
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
            label="Do you want to show couple friendly tag on MakeMyTrip & Goibibo?"
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
            <p className="text-xs font-medium text-neutral-600 mb-2">Which pets are allowed at the property?</p>
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
            <p className="text-xs font-medium text-neutral-600 mb-1.5">Pets are restricted/not allowed in these areas?</p>
            <input
              type="text"
              value={petsRestrictedAreas}
              onChange={(e) => setPetsRestrictedAreas(e.target.value)}
              placeholder="e.g. Restaurant, Pool area, Lobby"
              className="w-full h-9 rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 placeholder:text-neutral-400"
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
          <p className="text-xs font-medium text-neutral-700 mb-2.5">Acceptable Identity Proofs</p>
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
        <PolicyRow
          label="Do you provide bed to extra adults?"
          value={provideBedExtraAdults}
          onChange={setProvideBedExtraAdults}
        />
        <PolicyRow
          label="Do you provide bed to extra kids?"
          value={provideBedExtraKids}
          onChange={setProvideBedExtraKids}
        />
      </SectionCard>
    </form>
  );
}
