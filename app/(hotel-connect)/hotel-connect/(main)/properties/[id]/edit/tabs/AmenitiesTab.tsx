"use client";

import { useActionState, useState } from "react";
import { saveAmenities, type AmenitiesState } from "./amenities-actions";
import {
  AMENITY_CATEGORIES,
  MANDATORY_CONFIG,
  GENERAL_SERVICES_CONFIG,
  type AmenityValue,
  type MandatoryItemConfig,
  type GeneralServicesItemConfig,
  type PoolConfig,
  isYesValue,
  isNoValue,
  getDetail,
  getPools,
  getSelections,
} from "./amenities-data";
import SwimmingPoolModal from "./SwimmingPoolModal";
import { SearchSelect } from "@/app/(hotel-connect)/hotel-connect/(main)/components/ui/search-select";
import { cn } from "@/app/lib/utils";

export type HotelAmenitiesInfo = {
  id: number;
  property_amenities: Record<string, AmenityValue> | null;
};

type AmenitiesMap = Record<string, AmenityValue>;

// ── Toggle switch ─────────────────────────────────────────────────────────────

function AmenityToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean | undefined;
  onChange: (val: boolean) => void;
  disabled: boolean;
}) {
  const isOn      = value === true;
  const hasAnswer = value !== undefined;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      onClick={() => onChange(!isOn)}
      disabled={disabled}
      className={cn(
        "relative w-11 h-6 rounded-full transition-all duration-200 shrink-0",
        "focus:outline-none focus:ring-2 focus:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isOn
          ? "bg-emerald-500 focus:ring-emerald-400"
          : hasAnswer
            ? "bg-neutral-400 focus:ring-neutral-400"
            : "bg-neutral-200 focus:ring-neutral-300"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200",
          isOn ? "left-5.5" : "left-0.5"
        )}
      />
    </button>
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
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={cn(
          "text-xs font-medium w-5 text-right",
          yes ? "text-emerald-600" : no ? "text-neutral-500" : "text-neutral-300"
        )}>
          {yes ? "Yes" : no ? "No" : ""}
        </span>
        <AmenityToggle value={yes ? true : no ? false : undefined} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

// ── Mandatory row (supports sub-options + pool) ───────────────────────────────

function MandatoryAmenityRow({
  config,
  value,
  onNoYes,
  onDetailChange,
  onOpenPool,
  onDeletePool,
  onEditPool,
  disabled,
}: {
  config: MandatoryItemConfig;
  value: AmenityValue | undefined;
  onNoYes: (val: boolean) => void;
  onDetailChange: (detail: string) => void;
  onOpenPool: () => void;
  onDeletePool: (id: string) => void;
  onEditPool: (pool: PoolConfig) => void;
  disabled: boolean;
}) {
  const yes    = isYesValue(value);
  const no     = isNoValue(value);
  const detail = getDetail(value);
  const pools  = getPools(value);

  const boolValue: boolean | undefined = yes ? true : no ? false : undefined;

  return (
    <div className={cn(
      "border-b border-neutral-100 last:border-0"
    )}>
      {/* Main row */}
      <div className="flex items-center justify-between px-6 py-3.5">
        <span className="text-sm text-neutral-700 flex-1 pr-4">{config.name}</span>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className={cn(
            "text-xs font-medium w-5 text-right",
            yes ? "text-emerald-600" : no ? "text-neutral-500" : "text-neutral-300"
          )}>
            {yes ? "Yes" : no ? "No" : ""}
          </span>
          <AmenityToggle value={boolValue} onChange={onNoYes} disabled={disabled} />
        </div>
      </div>

      {/* Sub-option: SearchSelect dropdown when Yes + has options */}
      {yes && config.subOptions && config.subOptions.length > 0 && (
        <div className="px-6 pb-3.5">
          <SearchSelect
            options={config.subOptions}
            value={detail || undefined}
            onChange={(val) => onDetailChange(val)}
            placeholder="Select type"
            showSearch={false}
            className="max-w-65"
            disabled={disabled}
          />
        </div>
      )}

      {/* Sub-option: pool list + add button when Yes + isPool */}
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
  onDetailChange,
  onSelectionToggle,
  disabled,
}: {
  config: GeneralServicesItemConfig;
  value: AmenityValue | undefined;
  onNoYes: (val: boolean) => void;
  onDetailChange: (detail: string) => void;
  onSelectionToggle: (option: string) => void;
  disabled: boolean;
}) {
  const yes        = isYesValue(value);
  const no         = isNoValue(value);
  const detail     = getDetail(value);
  const selections = getSelections(value);
  const boolValue: boolean | undefined = yes ? true : no ? false : undefined;

  return (
    <div className={cn(
      "border-b border-neutral-100 last:border-0",
      yes ? "bg-emerald-50/30" : no ? "bg-neutral-50/40" : ""
    )}>
      {/* Main row */}
      <div className="flex items-center justify-between px-6 py-3.5">
        <span className="text-sm text-neutral-700 flex-1 pr-4">{config.name}</span>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className={cn(
            "text-xs font-medium w-5 text-right",
            yes ? "text-emerald-600" : no ? "text-neutral-500" : "text-neutral-300"
          )}>
            {yes ? "Yes" : no ? "No" : ""}
          </span>
          <AmenityToggle value={boolValue} onChange={onNoYes} disabled={disabled} />
        </div>
      </div>

      {/* Sub-field when Yes */}
      {yes && config.subField && (
        <div className="px-6 pb-3.5">
          <p className="text-[11px] font-medium text-neutral-400 mb-2">{config.subField.label}</p>

          {config.subField.type === "select" && (
            <SearchSelect
              options={config.subField.options}
              value={detail || undefined}
              onChange={onDetailChange}
              placeholder="Select"
              showSearch={false}
              className="max-w-65"
              disabled={disabled}
            />
          )}

          {config.subField.type === "multiselect" && (
            <div className="flex flex-wrap gap-2">
              {config.subField.options.map((opt) => {
                const active = selections.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => onSelectionToggle(opt)}
                    disabled={disabled}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                      active
                        ? "bg-primary-500 border-primary-500 text-white"
                        : "bg-white border-neutral-300 text-neutral-600 hover:border-primary-400 hover:text-primary-500"
                    )}
                  >
                    {active && (
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
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

  const [amenities, setAmenities] = useState<AmenitiesMap>(
    () => (hotel.property_amenities as AmenitiesMap) ?? {}
  );
  const [activeCategory, setActiveCategory] = useState(AMENITY_CATEGORIES[0].label);
  const [poolModal, setPoolModal] = useState<{ editingPool: PoolConfig | null } | null>(null);

  // ── State updaters ─────────────────────────────────────────────────────────

  function setAmenityValue(key: string, value: AmenityValue) {
    setAmenities((prev) => ({ ...prev, [key]: value }));
  }

  function handleNoYes(config: MandatoryItemConfig, yes: boolean) {
    if (!yes) {
      setAmenityValue(config.name, false);
      return;
    }
    if (config.isPool) {
      const existing = getPools(amenities[config.name]);
      setAmenityValue(config.name, { yes: true, pools: existing });
    } else if (config.subOptions?.length) {
      const prevDetail = getDetail(amenities[config.name]);
      setAmenityValue(config.name, { yes: true, detail: prevDetail });
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleDetailChange(name: string, detail: string) {
    setAmenityValue(name, { yes: true, detail });
  }

  function handleGeneralServicesNoYes(config: GeneralServicesItemConfig, yes: boolean) {
    if (!yes) { setAmenityValue(config.name, false); return; }
    if (config.subField?.type === "multiselect") {
      const existing = getSelections(amenities[config.name]);
      setAmenityValue(config.name, { yes: true, selections: existing });
    } else if (config.subField?.type === "select") {
      const prevDetail = getDetail(amenities[config.name]);
      setAmenityValue(config.name, { yes: true, detail: prevDetail });
    } else {
      setAmenityValue(config.name, true);
    }
  }

  function handleSelectionToggle(name: string, option: string) {
    const existing = getSelections(amenities[name]);
    const next = existing.includes(option)
      ? existing.filter((s) => s !== option)
      : [...existing, option];
    setAmenityValue(name, { yes: true, selections: next });
  }

  function handleSavePool(pool: PoolConfig) {
    const existing = getPools(amenities["Swimming Pool"]);
    const isEdit = existing.some((p) => p.id === pool.id);
    const newPools = isEdit
      ? existing.map((p) => (p.id === pool.id ? pool : p))
      : [...existing, pool];
    setAmenityValue("Swimming Pool", { yes: true, pools: newPools });
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

  const activeCat        = AMENITY_CATEGORIES.find((c) => c.label === activeCategory)!;
  const activeStats      = getStats(activeCat.items);
  const isMandatory      = activeCategory === "Mandatory";
  const isGeneralServices = activeCategory === "General Services";

  return (
    <>
      <form id="wizard-form" action={formAction}>
        <input type="hidden" name="amenities_json" value={JSON.stringify(amenities)} />

        {state.error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200">
            {state.error}
          </div>
        )}

        {/* Sidebar + Content */}
        <div className="flex bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">

          {/* Sidebar */}
          <aside className="w-52 shrink-0 border-r border-neutral-200 bg-neutral-50 self-start sticky top-0 h-full overflow-y-auto">
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
          <div className="flex-1 min-w-0 flex flex-col">

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
                ? MANDATORY_CONFIG.map((config) => (
                  <MandatoryAmenityRow
                    key={config.name}
                    config={config}
                    value={amenities[config.name]}
                    onNoYes={(val) => handleNoYes(config, val)}
                    onDetailChange={(detail) => handleDetailChange(config.name, detail)}
                    onOpenPool={() => setPoolModal({ editingPool: null })}
                    onDeletePool={handleDeletePool}
                    onEditPool={(pool) => setPoolModal({ editingPool: pool })}
                    disabled={isPending}
                  />
                ))
                : isGeneralServices
                  ? GENERAL_SERVICES_CONFIG.map((config) => (
                    <GeneralServicesAmenityRow
                      key={config.name}
                      config={config}
                      value={amenities[config.name]}
                      onNoYes={(val) => handleGeneralServicesNoYes(config, val)}
                      onDetailChange={(detail) => handleDetailChange(config.name, detail)}
                      onSelectionToggle={(opt) => handleSelectionToggle(config.name, opt)}
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
      </form>

      {poolModal && (
        <SwimmingPoolModal
          initial={poolModal.editingPool}
          onSave={handleSavePool}
          onClose={() => setPoolModal(null)}
        />
      )}
    </>
  );
}
