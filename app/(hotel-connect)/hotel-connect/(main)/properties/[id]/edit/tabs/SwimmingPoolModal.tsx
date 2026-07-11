"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/app/lib/utils";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { SearchSelect } from "../../../../components/ui/search-select";
import { Button } from "@/app/components/ui/Button";
import type { PoolConfig } from "./amenities-data";
import {
  POOL_FEATURES,
  POOL_FACILITIES,
  POOL_DEPTHS,
  WEEK_DAYS,
  makeTimeOptions,
} from "./amenities-data";
import { uploadHotelPhotos, deleteHotelPhoto, getPhotosByTag, type HotelPhoto } from "./photo-actions";
import {
  SwimmingPoolIcon,
  HouseIcon,
  SunIcon,
  UsersThreeIcon,
  BabyIcon,
  UserIcon,
  SnowflakeIcon,
  ClockIcon,
  RulerIcon,
  ImageIcon,
  XIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react/dist/ssr";

const TIME_OPTIONS = makeTimeOptions();
const POOL_PHOTO_TAG = "Swimming Pool";

type Props = {
  hotelId: number;
  initial: PoolConfig | null; // null = creating new pool
  poolNumber: number; // 1-based position, for the header ("Pool 2")
  poolTarget?: number; // if set, we're mid guided-add flow ("Pool 2 of 3")
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

// ── Shared bits ────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Label className="mb-2.5 block">{children}</Label>;
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
        "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
        active
          ? "bg-primary-500 border-primary-500 text-white"
          : "bg-white border-neutral-300 text-neutral-600 hover:border-primary-400 hover:bg-primary-50/40"
      )}
    >
      {label}
    </button>
  );
}

function OptionCard({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-semibold transition-all",
        active
          ? "border-primary-500 bg-primary-50 text-primary-600"
          : "border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50"
      )}
    >
      <span className={cn(active ? "text-primary-500" : "text-neutral-400")}>{icon}</span>
      {label}
    </button>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

export default function SwimmingPoolModal({ hotelId, initial, poolNumber, poolTarget, onSave, onClose }: Props) {
  const [pool, setPool] = useState<PoolConfig>(() =>
    initial ? { ...initial } : makeEmptyPool()
  );
  const [errors, setErrors] = useState<Partial<Record<keyof PoolConfig, string>>>({});

  // ── Pool photos — shared "Swimming Pool" tag bucket, visible in Photos tab too ──
  const [photos, setPhotos] = useState<HotelPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoCountError, setPhotoCountError] = useState<string | null>(null);
  // Photos uploaded during this modal session, not yet attached to a saved
  // pool — cleaned up if the host cancels instead of saving, so they don't
  // linger permanently tagged "Swimming Pool" with nothing pointing at them.
  const [sessionUploadedIds, setSessionUploadedIds] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPhotosByTag(hotelId, POOL_PHOTO_TAG).then((result) => {
      if (!cancelled) setPhotos(result);
    }).finally(() => {
      if (!cancelled) setPhotosLoading(false);
    });
    return () => { cancelled = true; };
  }, [hotelId]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setPendingUploads(files.length);
    setPhotoError(null);
    const fd = new FormData();
    for (const f of files) fd.append("photos", f);
    try {
      const result = await uploadHotelPhotos(hotelId, fd, [POOL_PHOTO_TAG]);
      if (result.photos?.length) {
        setPhotos((prev) => [...prev, ...result.photos!]);
        setSessionUploadedIds((prev) => [...prev, ...result.photos!.map((p) => p.id)]);
        setPhotoCountError(null);
      }
      if (result.error) setPhotoError(result.error);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      setPendingUploads(0);
      e.target.value = "";
    }
  }

  async function handlePhotoDelete(photoId: number) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    setSessionUploadedIds((prev) => prev.filter((id) => id !== photoId));
    const result = await deleteHotelPhoto(hotelId, photoId);
    if (result.error) setPhotoError(result.error);
  }

  function handleCancel() {
    // Photos uploaded this session were never attached to a saved pool —
    // don't leave them orphaned in the Photos tab.
    for (const id of sessionUploadedIds) {
      deleteHotelPhoto(hotelId, id).catch(() => {});
    }
    onClose();
  }

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUploadedIds, onClose]);

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

    const photosOk = photosLoading || photos.length >= 2;
    setPhotoCountError(photosOk ? null : "Add at least 2 photos of this pool.");

    if (Object.keys(errs).length > 0 || !photosOk) {
      requestAnimationFrame(() => {
        document.querySelector("[data-pool-error]")?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
    return Object.keys(errs).length === 0 && photosOk;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/50 z-60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto ring-1 ring-neutral-200">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-neutral-200 bg-linear-to-b bg-neutral-50 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center size-9 rounded-xl bg-primary-50 text-primary-500 ring-1 ring-inset ring-primary-100 shrink-0">
                <SwimmingPoolIcon size={19} weight="fill" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-neutral-800 truncate">
                  {initial
                    ? `Edit Pool ${poolNumber}`
                    : poolTarget
                      ? `Add Pool ${poolNumber} of ${poolTarget}`
                      : `Add Pool ${poolNumber}`}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {poolTarget
                    ? "Fill in this pool's details, then continue to the next."
                    : "Your hotel can list more than one pool — each with its own details."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-lg hover:bg-neutral-200/70 text-neutral-400 hover:text-neutral-600 transition-colors shrink-0"
              aria-label="Close"
            >
              <XIcon size={18} weight="bold" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

            {/* Pool Name */}
            <div data-pool-error={errors.name ? "" : undefined}>
              <Label className="mb-1.5 block">
                Pool Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={pool.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Rooftop Infinity Pool"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Pool Type */}
            <div data-pool-error={errors.type ? "" : undefined}>
              <Label className="mb-2 block">
                Pool Type <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-3">
                <OptionCard icon={<HouseIcon size={18} weight="duotone" />} label="Indoor" active={pool.type === "Indoor"} onClick={() => update("type", "Indoor")} />
                <OptionCard icon={<SunIcon size={18} weight="duotone" />} label="Outdoor" active={pool.type === "Outdoor"} onClick={() => update("type", "Outdoor")} />
              </div>
              {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type}</p>}
            </div>

            {/* Suitable For */}
            <div data-pool-error={errors.suitableFor ? "" : undefined}>
              <Label className="mb-2 block">
                Suitable For <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-3">
                <OptionCard icon={<UsersThreeIcon size={18} weight="duotone" />} label="All ages" active={pool.suitableFor === "All ages"} onClick={() => update("suitableFor", "All ages")} />
                <OptionCard icon={<BabyIcon size={18} weight="duotone" />} label="Kid's only" active={pool.suitableFor === "Kid's only"} onClick={() => update("suitableFor", "Kid's only")} />
                <OptionCard icon={<UserIcon size={18} weight="duotone" />} label="Adult only" active={pool.suitableFor === "Adult only"} onClick={() => update("suitableFor", "Adult only")} />
              </div>
              {errors.suitableFor && <p className="text-xs text-red-500 mt-1">{errors.suitableFor}</p>}
            </div>

            <div className="h-px bg-neutral-100" />

            {/* Pool Features */}
            <div>
              <SectionHeading>Pool Features &amp; Characteristics</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {POOL_FEATURES.map((f) => (
                  <TagToggle key={f} label={f} active={pool.features.includes(f)} onClick={() => toggleArray("features", f)} />
                ))}
              </div>
            </div>

            {/* Seasonal Access */}
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-3">
                <SnowflakeIcon size={16} className="text-neutral-400" />
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
                        : "bg-white border-neutral-300 text-neutral-500 hover:border-neutral-400"
                    )}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {/* Pool Photos */}
            <div data-pool-error={photoCountError ? "" : undefined}>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="block">
                  Pool Photos &amp; Videos
                  <span className="ml-1 normal-case tracking-normal font-normal text-neutral-400">(min. 2 required)</span>
                </Label>
                <span className={cn(
                  "text-[11px] font-semibold rounded-full px-2 py-0.5",
                  photos.length >= 2 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {photos.length}/2
                </span>
              </div>
              <p className="text-xs text-neutral-400 mb-2.5">
                These photos are automatically tagged &quot;Swimming Pool&quot; and also show up in the Photos step.
              </p>

              {photoError && (
                <p className="text-xs text-red-500 mb-2">{photoError}</p>
              )}
              {photoCountError && (
                <p className="text-xs text-red-500 mb-2">{photoCountError}</p>
              )}

              <div className="flex flex-wrap gap-3">
                {photosLoading ? (
                  <div className="w-20 h-16 rounded-lg bg-neutral-100 animate-pulse" />
                ) : (
                  photos.map((photo) => (
                    <div key={photo.id} className="relative group w-20 h-16 rounded-lg overflow-hidden bg-neutral-100 shrink-0">
                      {photo.url ? (
                        <Image src={photo.url} alt="Pool photo" fill className="object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon size={16} className="text-neutral-300" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePhotoDelete(photo.id)}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                        title="Remove photo"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  ))
                )}

                {uploading && Array.from({ length: pendingUploads }).map((_, i) => (
                  <div key={`pending-${i}`} className="w-20 h-16 rounded-lg bg-neutral-100 animate-pulse shrink-0" />
                ))}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-0.5 w-20 h-16 rounded-lg border-2 border-dashed border-neutral-300 text-neutral-400 hover:border-primary-300 hover:text-primary-500 transition-colors disabled:opacity-60 shrink-0"
                >
                  {uploading ? (
                    <span className="text-[10px] font-medium">…</span>
                  ) : (
                    <>
                      <PlusIcon size={16} weight="bold" />
                      <span className="text-[9px] font-semibold">Add</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="h-px bg-neutral-100" />

            {/* Facilities (Optional) */}
            <div>
              <SectionHeading>
                Facilities Provided
                <span className="ml-1 normal-case tracking-normal font-normal text-neutral-400">(Optional)</span>
              </SectionHeading>
              <div className="flex flex-wrap gap-2">
                {POOL_FACILITIES.map((f) => (
                  <TagToggle key={f} label={f} active={pool.facilities.includes(f)} onClick={() => toggleArray("facilities", f)} />
                ))}
              </div>
            </div>

            {/* Timing (Optional) */}
            <div>
              <SectionHeading>
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon size={14} className="text-neutral-400" /> Timing
                </span>
                <span className="ml-1 normal-case tracking-normal font-normal text-neutral-400">(Optional)</span>
              </SectionHeading>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1.5">Opening Time</p>
                  <SearchSelect
                    options={TIME_OPTIONS}
                    value={pool.openTime}
                    onChange={(v) => update("openTime", v)}
                    placeholder="Select"
                    searchPlaceholder="Search time…"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1.5">Closing Time</p>
                  <SearchSelect
                    options={TIME_OPTIONS}
                    value={pool.closeTime}
                    onChange={(v) => update("closeTime", v)}
                    placeholder="Select"
                    searchPlaceholder="Search time…"
                  />
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
              <SectionHeading>
                <span className="inline-flex items-center gap-1.5">
                  <RulerIcon size={14} className="text-neutral-400" /> Pool Depth
                </span>
                <span className="ml-1 normal-case tracking-normal font-normal text-neutral-400">(Optional)</span>
              </SectionHeading>
              <div className="mb-3">
                <SearchSelect
                  options={POOL_DEPTHS}
                  value={pool.depth}
                  onChange={(v) => update("depth", v)}
                  placeholder="Select Depth"
                  searchPlaceholder="Search depth…"
                />
              </div>
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
            <Button variant="outline" size="md" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => { if (validate()) { setSessionUploadedIds([]); onSave(pool); } }}
            >
              {initial
                ? "Save Changes"
                : poolTarget && poolNumber < poolTarget
                  ? "Save & Continue"
                  : "Add Pool"}
            </Button>
          </div>

        </div>
      </div>
    </>
  );
}

// ── Pool count prompt ────────────────────────────────────────────────────────
// Asked once, before the very first pool is added, so the guided flow can
// walk the host through creating exactly that many pools back-to-back.

export function PoolCountPrompt({
  onConfirm,
  onClose,
}: {
  onConfirm: (count: number) => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm(count);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-neutral-900/50 z-60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 w-full max-w-sm pointer-events-auto ring-1 ring-neutral-200 overflow-hidden">
          <div className="flex items-center gap-3 px-6 pt-6">
            <span className="flex items-center justify-center size-9 rounded-xl bg-primary-50 text-primary-500 ring-1 ring-inset ring-primary-100 shrink-0">
              <SwimmingPoolIcon size={19} weight="fill" />
            </span>
            <h2 className="text-sm font-bold text-neutral-800">
              How many swimming pools does this property have?
            </h2>
          </div>
          <p className="px-6 pt-2 text-xs text-neutral-500">
            We&apos;ll walk you through adding details for each pool, one at a time.
          </p>

          <div className="flex items-center justify-center gap-5 px-6 py-6">
            <button
              type="button"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              disabled={count <= 1}
              className="flex items-center justify-center size-10 rounded-full border border-neutral-300 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Decrease"
            >
              <MinusIcon size={16} weight="bold" />
            </button>
            <span className="text-3xl font-bold text-neutral-800 w-12 text-center tabular-nums">{count}</span>
            <button
              type="button"
              onClick={() => setCount((c) => Math.min(10, c + 1))}
              disabled={count >= 10}
              className="flex items-center justify-center size-10 rounded-full border border-neutral-300 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Increase"
            >
              <PlusIcon size={16} weight="bold" />
            </button>
          </div>

          <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 bg-neutral-50">
            <Button variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={() => onConfirm(count)}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
