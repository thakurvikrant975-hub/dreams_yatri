"use client";

import { useState } from "react";
import { cn } from "@/app/lib/utils";
import type { PoolConfig } from "./amenities-data";
import {
  POOL_FEATURES,
  POOL_FACILITIES,
  POOL_DEPTHS,
  WEEK_DAYS,
  makeTimeOptions,
} from "./amenities-data";

const TIME_OPTIONS = makeTimeOptions();

type Props = {
  initial: PoolConfig | null; // null = creating new pool
  onSave: (pool: PoolConfig) => void;
  onClose: () => void;
};

function makeEmptyPool(): PoolConfig {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "",
    suitableFor: "",
    features: [],
    winterAccess: false,
    facilities: [],
    openTime: "",
    closeTime: "",
    nonOpDays: [],
    depth: "",
    hasShallowEnd: false,
  };
}

function TagToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
        active
          ? "bg-primary-500 border-primary-500 text-white"
          : "bg-white border-neutral-300 text-neutral-600 hover:border-primary-400"
      )}
    >
      {label}
    </button>
  );
}

export default function SwimmingPoolModal({ initial, onSave, onClose }: Props) {
  const [pool, setPool] = useState<PoolConfig>(() =>
    initial ? { ...initial } : makeEmptyPool()
  );
  const [errors, setErrors] = useState<Partial<Record<keyof PoolConfig, string>>>({});

  function update<K extends keyof PoolConfig>(key: K, val: PoolConfig[K]) {
    setPool((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleArray(key: "features" | "nonOpDays" | "facilities", val: string) {
    setPool((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val],
      };
    });
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof PoolConfig, string>> = {};
    if (!pool.name.trim()) errs.name = "Pool name is required.";
    if (!pool.type) errs.type = "Select pool type.";
    if (!pool.suitableFor) errs.suitableFor = "Select suitable age group.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
            <h2 className="text-base font-bold text-neutral-800">
              {initial ? "Edit Pool" : "Add Swimming Pool"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

            {/* Pool Name */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                Pool Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={pool.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Rooftop Infinity Pool"
                className={cn(
                  "w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors",
                  errors.name
                    ? "border-red-400 focus:border-red-500"
                    : "border-neutral-300 focus:border-primary-500"
                )}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Pool Type */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">
                Pool Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {(["Indoor", "Outdoor"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("type", t)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                      pool.type === t
                        ? "border-primary-500 bg-primary-50 text-primary-600"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type}</p>}
            </div>

            {/* Suitable For */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">
                Suitable For <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {(["All ages", "Kid's only", "Adult only"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update("suitableFor", s)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                      pool.suitableFor === s
                        ? "border-primary-500 bg-primary-50 text-primary-600"
                        : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {errors.suitableFor && <p className="text-xs text-red-500 mt-1">{errors.suitableFor}</p>}
            </div>

            {/* Pool Features */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">
                Pool Features & Characteristics
              </label>
              <div className="flex flex-wrap gap-2">
                {POOL_FEATURES.map((f) => (
                  <TagToggle
                    key={f}
                    label={f}
                    active={pool.features.includes(f)}
                    onClick={() => toggleArray("features", f)}
                  />
                ))}
              </div>
            </div>

            {/* Seasonal Access */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
              <p className="text-sm font-medium text-neutral-700 mb-3">
                Is the pool accessible during the winter season?
              </p>
              <div className="flex gap-3">
                {([false, true] as const).map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => update("winterAccess", val)}
                    className={cn(
                      "px-6 py-2 rounded-full border text-sm font-medium transition-all",
                      pool.winterAccess === val
                        ? val
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "bg-neutral-700 border-neutral-700 text-white"
                        : "bg-white border-neutral-300 text-neutral-500 hover:border-neutral-500"
                    )}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {/* Pool Photos placeholder */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                Pool Photos & Videos
                <span className="ml-1 text-neutral-400 font-normal">(min. 2 required)</span>
              </label>
              <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center bg-neutral-50">
                <svg
                  className="w-8 h-8 text-neutral-300 mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                <p className="text-xs text-neutral-400">Photo upload is handled in the Photos tab</p>
              </div>
            </div>

            {/* Facilities (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">
                Facilities Provided
                <span className="ml-1 text-neutral-400 font-normal">(Optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {POOL_FACILITIES.map((f) => (
                  <TagToggle
                    key={f}
                    label={f}
                    active={pool.facilities.includes(f)}
                    onClick={() => toggleArray("facilities", f)}
                  />
                ))}
              </div>
            </div>

            {/* Timing (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">
                Timing
                <span className="ml-1 text-neutral-400 font-normal">(Optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">Opening Time</p>
                  <select
                    value={pool.openTime}
                    onChange={(e) => update("openTime", e.target.value)}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500"
                  >
                    <option value="">Select</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">Closing Time</p>
                  <select
                    value={pool.closeTime}
                    onChange={(e) => update("closeTime", e.target.value)}
                    className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500"
                  >
                    <option value="">Select</option>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-neutral-500 mb-1.5">Non-operational days</p>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleArray("nonOpDays", d)}
                      className={cn(
                        "w-10 h-10 rounded-full border text-xs font-semibold transition-all",
                        pool.nonOpDays.includes(d)
                          ? "bg-red-500 border-red-500 text-white"
                          : "bg-white border-neutral-300 text-neutral-600 hover:border-neutral-500"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Depth (Optional) */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2">
                Pool Depth
                <span className="ml-1 text-neutral-400 font-normal">(Optional)</span>
              </label>
              <select
                value={pool.depth}
                onChange={(e) => update("depth", e.target.value)}
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary-500 mb-2"
              >
                <option value="">Select Depth</option>
                {POOL_DEPTHS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pool.hasShallowEnd}
                  onChange={(e) => update("hasShallowEnd", e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-400 accent-primary-500"
                />
                <span className="text-sm text-neutral-600">This pool has a shallow end</span>
              </label>
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 shrink-0 bg-neutral-50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { if (validate()) onSave(pool); }}
              className="px-5 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              Save Pool
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
