"use client";

import { useActionState, useState } from "react";
import { saveAmenities, type AmenitiesState } from "./amenities-actions";
import {
  AMENITY_CATEGORIES,
  MANDATORY_CONFIG,
  GUEST_HOUSE_MANDATORY_CONFIG,
  GENERAL_SERVICES_CONFIG,
  SECURITY_CONFIG,
  BASIC_FACILITIES_CONFIG,
  OUTDOOR_SPORTS_CONFIG,
  FOOD_AND_DRINK_CONFIG,
  TRANSFERS_CONFIG,
  ENTERTAINMENT_CONFIG,
  MEDIA_TECHNOLOGY_CONFIG,
  FAMILY_KIDS_CONFIG,
  SPA_WELLNESS_CONFIG,
  WATER_SPORTS_CONFIG,
  INDOOR_SPORTS_CONFIG,
  LIVE_SHOWS_CONFIG,
  WILDLIFE_NATURE_CONFIG,
  RIDES_SAFARI_CONFIG,
  WORKSHOPS_CONFIG,
  type AmenityValue,
  type MandatoryItemConfig,
  type MandatorySubField,
  type MultiFieldAmenityValue,
  type GeneralServicesItemConfig,
  type PoolConfig,
  isYesValue,
  isNoValue,
  getPools,
  getF1,
  getF1s,
  getF2,
  getF2s,
} from "./amenities-data";
import SwimmingPoolModal, { PoolCountPrompt } from "./SwimmingPoolModal";
import { SearchSelect, MultiSearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { cn } from "@/app/lib/utils";

export type HotelAmenitiesInfo = {
  id: number;
  property_amenities: Record<string, AmenityValue> | null;
  property_sub_type: string | null;
};

type AmenitiesMap = Record<string, AmenityValue>;

// ── Yes / No button pair ──────────────────────────────────────────────────────

function YesNoButtons({
  value,
  onChange,
  disabled,
}: {
  value: boolean | undefined;
  onChange: (val: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-xs font-medium shrink-0">
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={cn(
          "px-3.5 py-1.5 transition-colors disabled:opacity-50",
          value === false
            ? "bg-neutral-700 text-white"
            : "text-neutral-500 hover:bg-neutral-50"
        )}
      >
        No
      </button>
      <div className="w-px bg-neutral-200" />
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={cn(
          "px-3.5 py-1.5 transition-colors disabled:opacity-50",
          value === true
            ? "bg-primary-500 text-white"
            : "text-neutral-500 hover:bg-neutral-50"
        )}
      >
        Yes
      </button>
    </div>
  );
}

// ── Sidebar category nav item ─────────────────────────────────────────────────

function CategoryNavItem({
  label,
  answered,
  total,
  active,
  onClick,
}: {
  label: string;
  answered: number;
  total: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-neutral-100 transition-colors relative",
        active
          ? "bg-primary-50 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary-500"
          : "hover:bg-neutral-100"
      )}
    >
      <p className={cn("text-[13px] font-medium leading-snug", active ? "text-primary-600" : "text-neutral-700")}>
        {label}
      </p>
      <p
        className={cn(
          "text-[11px] mt-0.5 font-medium",
          answered === total ? "text-emerald-600" : answered > 0 ? "text-amber-500" : "text-neutral-400"
        )}
      >
        {answered} of {total}
      </p>
    </button>
  );
}

// ── Simple row (non-mandatory categories) ─────────────────────────────────────

function SimpleAmenityRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: AmenityValue | undefined;
  onChange: (val: boolean) => void;
  disabled: boolean;
}) {
  const yes = isYesValue(value);
  const no  = isNoValue(value);

  return (
    <div className={cn(
      "flex items-center justify-between px-6 py-3.5 border-b border-neutral-100 last:border-0",
      yes ? "bg-emerald-50/40" : no ? "bg-neutral-50/40" : ""
    )}>
      <span className="text-sm text-neutral-700 flex-1 pr-4">{label}</span>
      <YesNoButtons value={yes ? true : no ? false : undefined} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── Mandatory row (field1 / field2 + pool) ────────────────────────────────────

function FieldChips({
  field,
  currentStr,
  currentArr,
  fieldKey,
  onFieldChange,
  disabled,
}: {
  field: MandatorySubField;
  currentStr: string;
  currentArr: string[];
  fieldKey: "f1" | "f2";
  onFieldChange: (k: "f1" | "f2", v: string | string[]) => void;
  disabled: boolean;
}) {
  if (field.type === "select") {
    return (
      <SearchSelect
        options={field.options}
        value={currentStr || undefined}
        onChange={(v) => onFieldChange(fieldKey, v)}
        placeholder="Select..."
        showSearch={false}
        disabled={disabled}
        className="max-w-xs"
      />
    );
  }

  return (
    <MultiSearchSelect
      options={field.options}
      value={currentArr}
      onChange={(v) => onFieldChange(fieldKey, v)}
      placeholder="Select..."
      showSearch={field.options.length > 6}
      disabled={disabled}
      className="max-w-xs"
    />
  );
}

function MandatoryAmenityRow({
  config,
  value,
  onNoYes,
  onFieldChange,
  onOpenPool,
  onDeletePool,
  onEditPool,
  disabled,
  hasError,
}: {
  config: MandatoryItemConfig;
  value: AmenityValue | undefined;
  onNoYes: (val: boolean) => void;
  onFieldChange: (field: "f1" | "f2", value: string | string[]) => void;
  onOpenPool: () => void;
  onDeletePool: (id: string) => void;
  onEditPool: (pool: PoolConfig) => void;
  disabled: boolean;
  hasError?: boolean;
}) {
  const yes   = isYesValue(value);
  const no    = isNoValue(value);
  const pools = getPools(value);
  const f1    = getF1(value);
  const f1s   = getF1s(value);
  const f2    = getF2(value);
  const f2s   = getF2s(value);

  const boolValue: boolean | undefined = yes ? true : no ? false : undefined;

  return (
    <div className={cn("border-b border-neutral-100 last:border-0", hasError && "bg-red-50/40")}>
      {/* Main row */}
      <div className="flex items-center justify-between px-6 py-3.5">
        <span className={cn("text-sm flex-1 pr-4", hasError ? "text-red-700 font-medium" : "text-neutral-700")}>
          {config.name}
          {hasError && <span className="ml-2 text-[10px] font-semibold text-red-500 uppercase tracking-wide">Required</span>}
        </span>
        <YesNoButtons value={boolValue} onChange={onNoYes} disabled={disabled} />
      </div>

      {/* Field 1 */}
      {yes && config.field1 && (
        <div className="px-6 pb-3.5">
          {config.field1.label && (
            <p className="text-[11px] font-medium text-neutral-400 mb-2">{config.field1.label}</p>
          )}
          <FieldChips
            field={config.field1}
            currentStr={f1}
            currentArr={f1s}
            fieldKey="f1"
            onFieldChange={onFieldChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Field 2 */}
      {yes && config.field2 && (
        <div className="px-6 pb-3.5">
          {config.field2.label && (
            <p className="text-[11px] font-medium text-neutral-400 mb-2">{config.field2.label}</p>
          )}
          <FieldChips
            field={config.field2}
            currentStr={f2}
            currentArr={f2s}
            fieldKey="f2"
            onFieldChange={onFieldChange}
            disabled={disabled}
          />
        </div>
      )}

      {/* Pool list */}
      {yes && config.isPool && (
        <div className="px-6 pb-3.5 space-y-2">
          {pools.map((pool) => (
            <div
              key={pool.id}
              className="flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-3.5 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-neutral-700">{pool.name || "Unnamed pool"}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {[pool.type, pool.suitableFor].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <button
                  type="button"
                  onClick={() => onEditPool(pool)}
                  disabled={disabled}
                  className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
                  title="Edit pool"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePool(pool.id)}
                  disabled={disabled}
                  className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
                  title="Remove pool"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={onOpenPool}
            disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 border-dashed border-primary-300 text-primary-500 text-sm font-medium hover:border-primary-400 hover:bg-primary-50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {pools.length === 0 ? "Add Swimming Pool" : "Add Another Pool"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── General Services row (select + multiselect sub-fields) ───────────────────

function GeneralServicesAmenityRow({
  config,
  value,
  onNoYes,
  onFieldChange,
  disabled,
}: {
  config: GeneralServicesItemConfig;
  value: AmenityValue | undefined;
  onNoYes: (val: boolean) => void;
  onFieldChange: (field: "f1" | "f2", val: string | string[]) => void;
  disabled: boolean;
}) {
  const yes   = isYesValue(value);
  const no    = isNoValue(value);
  const f1    = getF1(value);
  const f1s   = getF1s(value);
  const f2    = getF2(value);
  const f2s   = getF2s(value);
  const boolValue: boolean | undefined = yes ? true : no ? false : undefined;

  return (
    <div className={cn(
      "border-b border-neutral-100 last:border-0",
      yes ? "bg-emerald-50/30" : no ? "bg-neutral-50/40" : ""
    )}>
      <div className="flex items-center justify-between px-6 py-3.5">
        <span className="text-sm text-neutral-700 flex-1 pr-4">{config.name}</span>
        <YesNoButtons value={boolValue} onChange={onNoYes} disabled={disabled} />
      </div>

      {yes && config.field1 && (
        <div className="px-6 pb-3.5">
          {config.field1.label && (
            <p className="text-[11px] font-medium text-neutral-400 mb-2">{config.field1.label}</p>
          )}
          <FieldChips field={config.field1} currentStr={f1} currentArr={f1s} fieldKey="f1" onFieldChange={onFieldChange} disabled={disabled} />
        </div>
      )}

      {yes && config.field2 && (
        <div className="px-6 pb-3.5">
          {config.field2.label && (
            <p className="text-[11px] font-medium text-neutral-400 mb-2">{config.field2.label}</p>
          )}
          <FieldChips field={config.field2} currentStr={f2} currentArr={f2s} fieldKey="f2" onFieldChange={onFieldChange} disabled={disabled} />
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AmenitiesTab({ hotel }: { hotel: HotelAmenitiesInfo }) {
  const boundAction = saveAmenities.bind(null, hotel.id);
  const [state, formAction, isPending] = useActionState<AmenitiesState, FormData>(
    boundAction,
    {}
  );

  const mandatoryConfig = hotel.property_sub_type === "GUEST_HOUSE"
    ? GUEST_HOUSE_MANDATORY_CONFIG
    : MANDATORY_CONFIG;

  const [amenities, setAmenities] = useState<AmenitiesMap>(
    () => (hotel.property_amenities as AmenitiesMap) ?? {}
  );
  const [activeCategory, setActiveCategory] = useState(AMENITY_CATEGORIES[0].label);
  const [search, setSearch] = useState("");
  const [poolModal, setPoolModal] = useState<{ editingPool: PoolConfig | null } | null>(null);
  const [poolCountPrompt, setPoolCountPrompt] = useState(false);
  // Set only while guiding the host through adding their stated number of
  // pools back-to-back; cleared once that many pools exist or the flow is cancelled.
  const [pendingPoolCount, setPendingPoolCount] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showMandatoryErrors, setShowMandatoryErrors] = useState(false);

  // ── Validation ─────────────────────────────────────────────────────────────

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    const unanswered = mandatoryConfig.filter((c) => amenities[c.name] === undefined);
    const yesCount = mandatoryConfig.filter((c) => isYesValue(amenities[c.name])).length;

    if (unanswered.length > 0) {
      e.preventDefault();
      setValidationError(
        `${unanswered.length} mandatory amenit${unanswered.length === 1 ? "y has" : "ies have"} no answer. Please select Yes or No for every item in the Mandatory category.`
      );
      setShowMandatoryErrors(true);
      setActiveCategory("Mandatory");
      return;
    }
    if (yesCount < 3) {
      e.preventDefault();
      setValidationError(
        `At least 3 mandatory amenities must be marked "Yes". Currently only ${yesCount} ${yesCount === 1 ? "is" : "are"} selected.`
      );
      setActiveCategory("Mandatory");
      return;
    }
    setValidationError(null);
    setShowMandatoryErrors(false);
  }

  // ── State updaters ─────────────────────────────────────────────────────────

  function setAmenityValue(key: string, value: AmenityValue) {
    setAmenities((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
  }

  function handleNoYes(config: MandatoryItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.isPool) {
      setAmenityValue(config.name, { yes: true, pools: getPools(amenities[config.name]) });
    } else if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleMandatoryFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleWorkshopsNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleWorkshopsFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleRidesSafariNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleRidesSafariFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleWildlifeNatureNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleWildlifeNatureFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleLiveShowsNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleLiveShowsFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleIndoorSportsNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleIndoorSportsFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleWaterSportsNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleWaterSportsFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleSpaWellnessNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleSpaWellnessFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleFamilyKidsNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleFamilyKidsFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleMediaTechnologyNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleMediaTechnologyFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleEntertainmentNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleEntertainmentFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleTransfersNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleTransfersFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleFoodAndDrinkNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleFoodAndDrinkFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleOutdoorSportsNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleOutdoorSportsFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleBasicFacilitiesNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleBasicFacilitiesFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleSecurityNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleSecurityFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleGeneralServicesNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.field1) {
      const existing = amenities[config.name];
      const prev: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "f1" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      setAmenityValue(config.name, prev);
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleGeneralFieldChange(name: string, field: "f1" | "f2", val: string | string[]) {
    setAmenities((prev) => {
      const existing = prev[name];
      const base: MultiFieldAmenityValue =
        typeof existing === "object" && existing !== null && "yes" in existing
          ? { ...(existing as MultiFieldAmenityValue) }
          : { yes: true };
      return { ...prev, [name]: { ...base, [field]: val } as MultiFieldAmenityValue };
    });
  }

  function handleOpenPoolFlow() {
    const existing = getPools(amenities["Swimming Pool"]);
    if (existing.length === 0) {
      setPoolCountPrompt(true);
    } else {
      setPoolModal({ editingPool: null });
    }
  }

  function handlePoolCountConfirm(count: number) {
    setPendingPoolCount(count);
    setPoolCountPrompt(false);
    setPoolModal({ editingPool: null });
  }

  function handleSavePool(pool: PoolConfig) {
    const existing = getPools(amenities["Swimming Pool"]);
    const isEdit = existing.some((p) => p.id === pool.id);
    const newPools = isEdit
      ? existing.map((p) => (p.id === pool.id ? pool : p))
      : [...existing, pool];
    setAmenityValue("Swimming Pool", { yes: true, pools: newPools });

    // Guided flow: keep opening a fresh pool form until the host's stated count is reached.
    if (!isEdit && pendingPoolCount !== null && newPools.length < pendingPoolCount) {
      setPoolModal({ editingPool: null });
    } else {
      setPendingPoolCount(null);
      setPoolModal(null);
    }
  }

  function handleClosePoolModal() {
    setPendingPoolCount(null);
    setPoolModal(null);
  }

  function handleDeletePool(id: string) {
    const existing = getPools(amenities["Swimming Pool"]);
    setAmenityValue("Swimming Pool", { yes: true, pools: existing.filter((p) => p.id !== id) });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  function getStats(items: string[]) {
    return {
      answered: items.filter((i) => amenities[i] !== undefined).length,
      total: items.length,
    };
  }

  const activeCat   = AMENITY_CATEGORIES.find((c) => c.label === activeCategory)!;
  const activeStats = getStats(activeCat.items);
  const sq          = search.toLowerCase().trim();

  const searchResults = sq
    ? AMENITY_CATEGORIES.flatMap((cat) =>
        cat.items
          .filter((name) => name.toLowerCase().includes(sq))
          .map((name) => ({ name, category: cat.label }))
      )
    : [];
  const isMandatory           = activeCategory === "Mandatory";
  const isGeneralServices     = activeCategory === "General Services";
  const isSecurityCategory    = activeCategory === "Security";
  const isBasicFacilities     = activeCategory === "Basic Facilities";
  const isOutdoorSports       = activeCategory === "Outdoor Sports & Activities";
  const isFoodAndDrink        = activeCategory === "Food and Drink";
  const isTransfers           = activeCategory === "Transfers";
  const isEntertainment       = activeCategory === "Entertainment";
  const isMediaTechnology     = activeCategory === "Media and Technology";
  const isFamilyKids          = activeCategory === "Family and Kids";
  const isSpaWellness         = activeCategory === "Spa & Wellness";
  const isWaterSports         = activeCategory === "Water Sports & Activities";
  const isIndoorSports        = activeCategory === "Indoor Sports & Activities";
  const isLiveShows           = activeCategory === "Live Shows & Music";
  const isWildlifeNature      = activeCategory === "Wildlife & Nature";
  const isRidesSafari         = activeCategory === "Rides, Safari, Excursions & Tour";
  const isWorkshops           = activeCategory === "Hands-on Workshops";

  return (
    <>
      <form id="wizard-form" action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="amenities_json" value={JSON.stringify(amenities)} />

        {(state.error || validationError) && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            <p>{validationError ?? state.error}</p>
            {validationError && activeCategory !== "Mandatory" && (
              <button
                type="button"
                onClick={() => setActiveCategory("Mandatory")}
                className="mt-1 text-red-600 underline underline-offset-2 text-xs hover:text-red-800"
              >
                Jump to Mandatory section →
              </button>
            )}
          </div>
        )}

        {/* Global search */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search all amenities…"
            className="w-full text-sm border border-neutral-200 rounded-xl px-4 py-2.5 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors bg-white shadow-sm"
          />
        </div>

        {sq ? (
          /* Global search results */
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
            {searchResults.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-400">
                No amenities match &ldquo;{search}&rdquo;
              </p>
            ) : (
              searchResults.map(({ name, category }) => {
                const value = amenities[name];
                const yes = isYesValue(value);
                const no  = isNoValue(value);
                return (
                  <div
                    key={`${category}::${name}`}
                    className={cn(
                      "flex items-center justify-between px-6 py-3.5 border-b border-neutral-100 last:border-0",
                      yes ? "bg-emerald-50/40" : no ? "bg-neutral-50/40" : "",
                    )}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm text-neutral-700">{name}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{category}</p>
                    </div>
                    <YesNoButtons
                      value={yes ? true : no ? false : undefined}
                      onChange={(val) => setAmenityValue(name, val)}
                      disabled={isPending}
                    />
                  </div>
                );
              })
            )}
          </div>
        ) : (

        /* Sidebar + Content */
        <div className="flex bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">

          {/* Sidebar */}
          <aside className="w-64 shrink-0  self-start sticky top-0 h-full overflow-y-auto">
            <div className="px-4 py-2.5 border-b border-neutral-200 bg-white sticky top-0">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Categories</p>
            </div>
            {AMENITY_CATEGORIES.map((cat) => {
              const { answered, total } = getStats(cat.items);
              return (
                <CategoryNavItem
                  key={cat.label}
                  label={cat.label}
                  answered={answered}
                  total={total}
                  active={cat.label === activeCategory}
                  onClick={() => setActiveCategory(cat.label)}
                />
              );
            })}
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col border-l border-neutral-200 ">

            {/* Category header */}
            <div className="px-6 py-4 border-b border-neutral-200 bg-white sticky top-0 z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-800">{activeCat.label}</h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {activeStats.answered === activeStats.total ? (
                      <span className="text-emerald-600 font-medium">All {activeStats.total} answered ✓</span>
                    ) : (
                      <>{activeStats.answered} of {activeStats.total} answered</>
                    )}
                  </p>
                </div>
                {!isMandatory && !isGeneralServices && activeStats.answered > 0 && activeStats.answered < activeStats.total && (
                  <button
                    type="button"
                    onClick={() => {
                      const updates: AmenitiesMap = {};
                      activeCat.items.forEach((item) => {
                        if (amenities[item] === undefined) updates[item] = false;
                      });
                      setAmenities((prev) => ({ ...prev, ...updates }));
                    }}
                    className="shrink-0 text-[11px] text-neutral-400 hover:text-neutral-600 underline underline-offset-2 transition-colors"
                  >
                    Mark remaining as No
                  </button>
                )}
              </div>
            </div>

            {/* Rows */}
            <div>
              {isMandatory
                ? mandatoryConfig.map((config) => (
                  <MandatoryAmenityRow
                    key={config.name}
                    config={config}
                    value={amenities[config.name]}
                    onNoYes={(val) => handleNoYes(config, val)}
                    onFieldChange={(field, val) => handleMandatoryFieldChange(config.name, field, val)}
                    onOpenPool={handleOpenPoolFlow}
                    onDeletePool={handleDeletePool}
                    onEditPool={(pool) => setPoolModal({ editingPool: pool })}
                    disabled={isPending}
                    hasError={showMandatoryErrors && amenities[config.name] === undefined}
                  />
                ))
                : isGeneralServices
                  ? GENERAL_SERVICES_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleGeneralServicesNoYes(config, val)}
                      onFieldChange={(field, val) => handleGeneralFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isSecurityCategory
                  ? SECURITY_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleSecurityNoYes(config, val)}
                      onFieldChange={(field, val) => handleSecurityFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isBasicFacilities
                  ? BASIC_FACILITIES_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleBasicFacilitiesNoYes(config, val)}
                      onFieldChange={(field, val) => handleBasicFacilitiesFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isOutdoorSports
                  ? OUTDOOR_SPORTS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleOutdoorSportsNoYes(config, val)}
                      onFieldChange={(field, val) => handleOutdoorSportsFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isFoodAndDrink
                  ? FOOD_AND_DRINK_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleFoodAndDrinkNoYes(config, val)}
                      onFieldChange={(field, val) => handleFoodAndDrinkFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isTransfers
                  ? TRANSFERS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleTransfersNoYes(config, val)}
                      onFieldChange={(field, val) => handleTransfersFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isEntertainment
                  ? ENTERTAINMENT_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleEntertainmentNoYes(config, val)}
                      onFieldChange={(field, val) => handleEntertainmentFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isMediaTechnology
                  ? MEDIA_TECHNOLOGY_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleMediaTechnologyNoYes(config, val)}
                      onFieldChange={(field, val) => handleMediaTechnologyFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isFamilyKids
                  ? FAMILY_KIDS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleFamilyKidsNoYes(config, val)}
                      onFieldChange={(field, val) => handleFamilyKidsFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isSpaWellness
                  ? SPA_WELLNESS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleSpaWellnessNoYes(config, val)}
                      onFieldChange={(field, val) => handleSpaWellnessFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isWaterSports
                  ? WATER_SPORTS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleWaterSportsNoYes(config, val)}
                      onFieldChange={(field, val) => handleWaterSportsFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isIndoorSports
                  ? INDOOR_SPORTS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleIndoorSportsNoYes(config, val)}
                      onFieldChange={(field, val) => handleIndoorSportsFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isLiveShows
                  ? LIVE_SHOWS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleLiveShowsNoYes(config, val)}
                      onFieldChange={(field, val) => handleLiveShowsFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isWildlifeNature
                  ? WILDLIFE_NATURE_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleWildlifeNatureNoYes(config, val)}
                      onFieldChange={(field, val) => handleWildlifeNatureFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isRidesSafari
                  ? RIDES_SAFARI_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleRidesSafariNoYes(config, val)}
                      onFieldChange={(field, val) => handleRidesSafariFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : isWorkshops
                  ? WORKSHOPS_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleWorkshopsNoYes(config, val)}
                      onFieldChange={(field, val) => handleWorkshopsFieldChange(config.name, field, val)}
                      disabled={isPending}
                    />
                  ))
                  : activeCat.items.map((item) => (
                    <SimpleAmenityRow
                      key={item}
                      label={item}
                      value={amenities[item]}
                      onChange={(val) => setAmenityValue(item, val)}
                      disabled={isPending}
                    />
                  ))}
            </div>

          </div>
        </div>
        )} {/* end sq ternary */}
      </form>

      {poolCountPrompt && (
        <PoolCountPrompt
          onConfirm={handlePoolCountConfirm}
          onClose={() => setPoolCountPrompt(false)}
        />
      )}

      {poolModal && (
        <SwimmingPoolModal
          // Force a remount between successive "new pool" forms in the guided
          // flow (initial stays null each time) so stale form state doesn't
          // carry over from the previous pool.
          key={poolModal.editingPool?.id ?? `new-${getPools(amenities["Swimming Pool"]).length}`}
          initial={poolModal.editingPool}
          poolNumber={
            poolModal.editingPool
              ? getPools(amenities["Swimming Pool"]).findIndex((p) => p.id === poolModal.editingPool!.id) + 1
              : getPools(amenities["Swimming Pool"]).length + 1
          }
          poolTarget={poolModal.editingPool ? undefined : (pendingPoolCount ?? undefined)}
          onSave={handleSavePool}
          onClose={handleClosePoolModal}
        />
      )}
    </>
  );
}
