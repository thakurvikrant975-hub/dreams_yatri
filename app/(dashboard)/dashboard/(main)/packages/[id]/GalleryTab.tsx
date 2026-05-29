"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "@/app/lib/utils";

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;
function r2(path: string | null | undefined) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${R2}/${path}`;
}
import {
  handleGetPackageGallery,
  handleGetSourceImages,
  handleUpsertGallerySlot,
  handleClearGallerySlot,
  handleUpdateGallerySlotLabel,
} from "@/app/actions/packages/gallery.actions";
import type { GallerySlot, GallerySourceImages, SourceImage } from "@/app/services/gallery.service";
import {
  ImageIcon,
  X,
  Loader2,
  Package,
  Hotel,
  Zap,
  BedDouble,
  ChevronLeft,
  Star,
  Route,
} from "lucide-react";
import { Button } from "../../components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────

type SlotData = GallerySlot | null;

type RouteOption = { id: number; name: string; durationLabel: string };

type Props = {
  packageId: number;
  routes: RouteOption[];
};

type SourceKey = "PACKAGE" | "HOTEL" | "ACTIVITY" | "ROOM";

// ── Constants ──────────────────────────────────────────────────────────────

const SOURCE_TABS: { key: SourceKey; label: string; icon: React.ElementType }[] = [
  { key: "PACKAGE", label: "Package", icon: Package },
  { key: "HOTEL",   label: "Hotel",   icon: Hotel },
  { key: "ACTIVITY", label: "Activity", icon: Zap },
  { key: "ROOM",    label: "Room",    icon: BedDouble },
];

const SLOT_LABELS: Record<number, string> = {
  1: "Cover Photo",
  2: "Image 2",
  3: "Image 3",
  4: "Image 4",
  5: "Image 5",
};

// ── Gallery Slot Card ──────────────────────────────────────────────────────

function SlotCard({
  position,
  slot,
  active,
  saving,
  label,
  savingLabel,
  onSelect,
  onClear,
  onLabelChange,
  onLabelBlur,
}: {
  position: number;
  slot: SlotData;
  active: boolean;
  saving: boolean;
  label: string;
  savingLabel: boolean;
  onSelect: () => void;
  onClear: () => void;
  onLabelChange: (val: string) => void;
  onLabelBlur: () => void;
}) {
  const isCover = position === 1;

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 overflow-hidden transition-all cursor-pointer group",
        isCover ? "col-span-2 row-span-2 aspect-4/3" : "aspect-square",
        active ? "border-dashboard-primary ring-2 ring-dashboard-primary/30" : "border-dashboard-base-content/20 hover:border-dashboard-primary/50",
        !slot && "bg-dashboard-base-200/30 border-dashed",
      )}
      onClick={onSelect}
    >
      {slot ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={r2(slot.image_url)}
            alt={label || SLOT_LABELS[position]}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          <div className="absolute top-2 left-2">
            <span className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
              isCover ? "bg-dashboard-primary text-dashboard-primary-content" : "bg-black/60 text-white",
            )}>
              {isCover && <Star className="inline h-2.5 w-2.5 mb-0.5 mr-0.5" />}
              {SLOT_LABELS[position]}
            </span>
          </div>
          {!saving && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {saving && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
          )}
          {!isCover && (
            <div className="absolute bottom-0 left-0 right-0" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={label}
                onChange={(e) => onLabelChange(e.target.value)}
                onBlur={onLabelBlur}
                placeholder="Add label…"
                maxLength={60}
                className="w-full bg-black/55 text-white text-[10px] px-2 py-1.5 placeholder:text-white/40 focus:outline-none focus:bg-black/75 transition-colors"
              />
              {savingLabel && (
                <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-white/60 animate-spin pointer-events-none" />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          {saving ? (
            <Loader2 className="h-5 w-5 text-dashboard-base-content/30 animate-spin" />
          ) : (
            <>
              <ImageIcon className="h-5 w-5 text-dashboard-base-content/25" />
              <span className="text-[10px] text-dashboard-base-content/40 font-medium">
                {SLOT_LABELS[position]}
              </span>
              {isCover && (
                <span className="text-[9px] text-dashboard-base-content/30">Cover</span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Image Picker Panel ─────────────────────────────────────────────────────

function ImagePickerPanel({
  activeSlot,
  sourceImages,
  loading,
  savingSlot,
  onPick,
  onClose,
}: {
  activeSlot: number;
  sourceImages: GallerySourceImages | null;
  loading: boolean;
  savingSlot: number | null;
  onPick: (img: SourceImage, sourceType: SourceKey) => void;
  onClose: () => void;
}) {
  const [activeSource, setActiveSource] = useState<SourceKey>("PACKAGE");

  const images = sourceImages?.[activeSource] ?? [];

  const grouped = images.reduce<Record<string, SourceImage[]>>((acc, img) => {
    (acc[img.group_label] ??= []).push(img);
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-dashboard-base-content/20 bg-dashboard-base-100 flex flex-col" style={{ minHeight: 420 }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-dashboard-base-content/10">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="text-dashboard-base-content/50 hover:text-dashboard-base-content cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-dashboard-base-content">
            Pick image for <span className="text-dashboard-primary">{SLOT_LABELS[activeSlot]}</span>
          </p>
        </div>
      </div>

      <div className="flex border-b border-dashboard-base-content/10 px-4">
        {SOURCE_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSource(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer",
              activeSource === key
                ? "border-dashboard-primary text-dashboard-primary"
                : "border-transparent text-dashboard-base-content/50 hover:text-dashboard-base-content",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 text-dashboard-base-content/50 animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-8 w-8 text-dashboard-base-content/50/30 mb-2" />
            <p className="text-sm text-dashboard-base-content/50">No images available</p>
            <p className="text-xs text-dashboard-base-content/40 mt-1">
              {activeSource === "PACKAGE"
                ? "Upload images in the Images tab"
                : `Add ${activeSource.toLowerCase()} items to the itinerary first`}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([groupLabel, imgs]) => (
              <div key={groupLabel}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-dashboard-base-content/50 mb-2">
                  {groupLabel}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {imgs.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      disabled={savingSlot !== null}
                      onClick={() => onPick(img, activeSource)}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-dashboard-primary transition-all group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r2(img.thumbnail ?? img.url)}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {savingSlot !== null && (
                        <div className="absolute inset-0 bg-black/20" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Route Gallery Panel ────────────────────────────────────────────────────

function RouteGalleryPanel({
  packageId,
  routeId,
}: {
  packageId: number;
  routeId: number;
}) {
  const [gallery, setGallery] = useState<SlotData[]>(Array(5).fill(null));
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [sourceImages, setSourceImages] = useState<GallerySourceImages | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [savingLabel, setSavingLabel] = useState<number | null>(null);

  // Load gallery when routeId changes
  useEffect(() => {
    setGalleryLoading(true);
    setActiveSlot(null);
    handleGetPackageGallery(packageId, routeId).then((res) => {
      setGalleryLoading(false);
      if (res.success) {
        setGallery(res.data);
        setLabels(Object.fromEntries(res.data.map((s, i) => [i + 1, s?.label ?? ""])));
      } else {
        toast.error(res.message ?? "Failed to load gallery");
      }
    });
  }, [packageId, routeId]);

  const openPicker = useCallback(
    async (position: number) => {
      setActiveSlot(position);
      setPickerLoading(true);
      const res = await handleGetSourceImages(packageId);
      setPickerLoading(false);
      if (res.success) {
        setSourceImages(res.data);
      } else {
        toast.error(res.message ?? "Failed to load images");
      }
    },
    [packageId],
  );

  async function handlePick(img: SourceImage, sourceType: SourceKey) {
    if (!activeSlot) return;
    setSavingSlot(activeSlot);
    const res = await handleUpsertGallerySlot(packageId, routeId, activeSlot, img.url, sourceType, img.source_id);
    setSavingSlot(null);
    if (!res.success) { toast.error(res.message); return; }
    setGallery((prev) => {
      const next = [...prev];
      next[activeSlot - 1] = {
        id: 0,
        position: activeSlot,
        image_url: img.url,
        source_type: sourceType,
        source_id: img.source_id,
        label: null,
      };
      return next;
    });
    setActiveSlot(null);
    toast.success(`${SLOT_LABELS[activeSlot]} updated`);
  }

  async function handleClear(position: number) {
    setSavingSlot(position);
    const res = await handleClearGallerySlot(packageId, routeId, position);
    setSavingSlot(null);
    if (!res.success) { toast.error(res.message); return; }
    setGallery((prev) => {
      const next = [...prev];
      next[position - 1] = null;
      return next;
    });
    setLabels((prev) => ({ ...prev, [position]: "" }));
    if (activeSlot === position) setActiveSlot(null);
    toast.success(`${SLOT_LABELS[position]} cleared`);
  }

  async function handleSaveLabel(position: number) {
    if (!gallery[position - 1]) return;
    const current = labels[position] ?? "";
    const saved = gallery[position - 1]?.label ?? "";
    if (current === saved) return;
    setSavingLabel(position);
    const res = await handleUpdateGallerySlotLabel(packageId, routeId, position, current);
    setSavingLabel(null);
    if (!res.success) { toast.error(res.message); return; }
    setGallery((prev) => {
      const next = [...prev];
      if (next[position - 1]) next[position - 1] = { ...next[position - 1]!, label: current || null };
      return next;
    });
  }

  const filledCount = gallery.filter(Boolean).length;

  if (galleryLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-dashboard-base-content/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Slot grid */}
      <div>
        <p className="text-xs text-dashboard-base-content/50 mb-3">
          {filledCount}/5 filled — click a slot to pick an image
        </p>
        <div className="grid grid-cols-4 grid-rows-2 gap-2" style={{ minHeight: 280 }}>
          {Array.from({ length: 5 }, (_, i) => i + 1).map((pos) => (
            <SlotCard
              key={pos}
              position={pos}
              slot={gallery[pos - 1]}
              active={activeSlot === pos}
              saving={savingSlot === pos}
              label={labels[pos] ?? ""}
              savingLabel={savingLabel === pos}
              onSelect={() => openPicker(pos)}
              onClear={() => handleClear(pos)}
              onLabelChange={(val) => setLabels((prev) => ({ ...prev, [pos]: val }))}
              onLabelBlur={() => handleSaveLabel(pos)}
            />
          ))}
        </div>
      </div>

      {/* Image picker */}
      <div>
        {activeSlot ? (
          <ImagePickerPanel
            activeSlot={activeSlot}
            sourceImages={sourceImages}
            loading={pickerLoading}
            savingSlot={savingSlot}
            onPick={handlePick}
            onClose={() => setActiveSlot(null)}
          />
        ) : (
          <div className="rounded-xl border border-dashed bg-dashboard-base-200/30 flex flex-col items-center justify-center" style={{ minHeight: 280 }}>
            <ImageIcon className="h-8 w-8 text-dashboard-base-content/50/30 mb-2" />
            <p className="text-sm text-dashboard-base-content/50">Select a slot to pick an image</p>
            <p className="text-xs text-dashboard-base-content/40 mt-1">
              Images sourced from package, hotels, activities, and rooms in the itinerary
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────

export function GalleryTab({ packageId, routes }: Props) {
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(routes[0]?.id ?? null);

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed bg-dashboard-base-200/30">
        <Route className="h-10 w-10 text-dashboard-base-content/50/30 mb-4" />
        <p className="text-sm font-medium text-dashboard-base-content/50">No route variants yet</p>
        <p className="text-xs text-dashboard-base-content/40 mt-1">
          Create at least one route in the Route Builder tab first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-dashboard-base-content">Gallery — Intro Section</h3>
        <p className="text-xs text-dashboard-base-content/50 mt-0.5">
          5 images per route variant. Position 1 is the large cover photo.
        </p>
      </div>

      {/* Route tabs */}
      <div className="flex gap-0 border-b border-dashboard-base-content/10 overflow-x-auto">
        {routes.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedRouteId(r.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer",
              selectedRouteId === r.id
                ? "border-dashboard-primary text-dashboard-primary"
                : "border-transparent text-dashboard-base-content/50 hover:text-dashboard-base-content",
            )}
          >
            <Route className="h-3 w-3" />
            {r.name}
            <span className="text-dashboard-base-content/40 font-normal">· {r.durationLabel}</span>
          </button>
        ))}
      </div>

      {/* Gallery for selected route */}
      {selectedRouteId != null && (
        <RouteGalleryPanel
          key={selectedRouteId}
          packageId={packageId}
          routeId={selectedRouteId}
        />
      )}
    </div>
  );
}
