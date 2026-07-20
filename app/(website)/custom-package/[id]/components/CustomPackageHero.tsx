"use client";

import { useState } from "react";
import { ImagesIcon, CarIcon, BedIcon, ForkKnifeIcon, BinocularsIcon } from "@phosphor-icons/react";
import { Heading, Text } from "@/app/components/ui/Typography";
import ImageLightbox, { type LightboxImage } from "@/app/(website)/packages/[slug]/[duration]/[route]/[stay]/components/ImageLightbox";
import { SafeImage } from "./SafeImage";
import {
  deriveDayLocations, firstDayPhotoForStop,
  type PreviewData,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/[queryId]/ItineraryDocument";

const IMAGE_FALLBACK = (
  <div className="absolute inset-0 w-full h-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center">
    <ImagesIcon weight="duotone" className="size-8 text-white/40" />
  </div>
);

const PLACEHOLDER = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=60";

/** One entry per route stop, resolved the same way "Places You Gonna Visit"
 * used to be resolved in the document view — a manual override, then a real
 * catalog destination photo, then the first activity/hotel photo from that
 * stop's own days — so the hero grid never looks broken even without a
 * catalog match. */
function resolveStopPhotos(form: PreviewData): string[] {
  const dayLocations = deriveDayLocations(form.stops, form.itineraries.length);
  return form.stops.map((stop) => {
    if (stop.image) return stop.image;
    const catalogPhoto = form.stopImages?.[stop.name.trim()];
    if (catalogPhoto) return catalogPhoto;
    const dayNumbers = new Set(
      dayLocations
        .map((loc, idx) => (loc === stop.name ? idx + 1 : null))
        .filter((d): d is number => d != null),
    );
    return firstDayPhotoForStop(form.itineraries, dayNumbers) ?? "";
  }).filter(Boolean);
}

const INCLUSION_ICONS = {
  transfer: CarIcon,
  stay: BedIcon,
  meals: ForkKnifeIcon,
  activities: BinocularsIcon,
} as const;

function computeInclusions(form: PreviewData): { key: keyof typeof INCLUSION_ICONS; label: string }[] {
  const out: { key: keyof typeof INCLUSION_ICONS; label: string }[] = [];
  if (form.itineraries.some((d) => d.transport || d.transportVehicleType)) out.push({ key: "transfer", label: "Transfers" });
  if (form.itineraries.some((d) => d.accommodation)) out.push({ key: "stay", label: "Stay" });
  if (form.itineraries.some((d) => d.meals.length > 0)) out.push({ key: "meals", label: "Meals" });
  if (form.itineraries.some((d) => d.activities.some((a) => a.title.trim()))) out.push({ key: "activities", label: "Activities" });
  return out;
}

export function CustomPackageHero({ form }: { form: PreviewData }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const stopPhotos = resolveStopPhotos(form);
  const gridPhotos = [form.coverImage, ...stopPhotos].filter(Boolean) as string[];
  const heroPhoto = gridPhotos[0] || PLACEHOLDER;
  const tiles = gridPhotos.slice(1, 5);
  while (tiles.length < 4) tiles.push(heroPhoto);

  const lightboxImages: LightboxImage[] = [heroPhoto, ...tiles].map((src, i) => ({
    src, label: i === 0 ? form.title : (form.stops[i - 1]?.name ?? form.title),
  }));

  const inclusions = computeInclusions(form);
  const chips = form.stops.length > 0
    ? form.stops.map((s) => ({ days: s.nights, place: s.name }))
    : [{ days: form.totalNights, place: form.destination }];

  return (
    <div>
      <Heading level={1} weight="semibold">{form.title}</Heading>

      <div className="flex items-center gap-3 sm:gap-4 mt-2 overflow-x-auto scrollbar-none">
        <span className="inline-flex shrink-0 items-center px-3 py-1.5 rounded-pill bg-white border border-neutral-200">
          <Text as="span" size="sm" weight="bold" intent="secondary">
            {form.totalDays}D / {form.totalNights}N
          </Text>
        </span>
        <div className="h-6 w-px shrink-0 bg-(--border-muted)" />
        <div className="flex items-center gap-3 sm:gap-4">
          {chips.map((stop, i) => (
            <div key={i} className="flex items-center gap-1.5 shrink-0">
              <Text as="span" intent="muted" weight="bold" className="leading-none font-heading text-xl sm:text-3xl">
                {stop.days}
              </Text>
              <div className="flex flex-col leading-tight">
                <Text as="span" size="xss" intent="secondary" weight="medium" className="font-medium font-heading tracking-wide">
                  Nights in
                </Text>
                <Text as="span" size="sm" intent="primary" weight="semibold" className="font-heading">
                  {stop.place}
                </Text>
              </div>
              {i < chips.length - 1 && <div className="ml-2 h-6 w-px shrink-0 bg-(--border-default)" />}
            </div>
          ))}
        </div>
      </div>

      {inclusions.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mt-3 mb-1">
          <Text size="sm" weight="semibold" className="uppercase mr-2">Inclusion</Text>
          <div className="h-6 w-px bg-(--border-muted) mr-1" />
          {inclusions.map((inc) => {
            const Icon = INCLUSION_ICONS[inc.key];
            return (
              <div key={inc.key} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 text-sm">
                <Icon weight="fill" className="size-5 text-muted shrink-0" />
                <Text as="span" size="sm" intent="secondary">{inc.label}</Text>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile photo layout */}
      <div className="md:hidden mt-2 space-y-1.5">
        <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-neutral-100">
          <SafeImage src={heroPhoto} alt={form.title} className="absolute inset-0 w-full h-full object-cover" fallback={IMAGE_FALLBACK} />
          <button
            type="button"
            onClick={() => setLightboxIdx(0)}
            className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/75 transition-colors"
          >
            <ImagesIcon weight="duotone" className="size-5" /> View Gallery
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {tiles.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIdx(i + 1)}
              className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100"
            >
              <SafeImage src={src} alt="" className="absolute inset-0 w-full h-full object-cover" fallback={IMAGE_FALLBACK} />
            </button>
          ))}
        </div>
      </div>

      {/* Desktop photo grid */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-120 rounded-2xl overflow-hidden mt-2">
        <button
          type="button"
          onClick={() => setLightboxIdx(0)}
          className="relative col-span-2 row-span-2 group cursor-pointer overflow-hidden bg-neutral-100"
        >
          <SafeImage src={heroPhoto} alt={form.title} className="absolute inset-0 w-full h-full object-cover" fallback={IMAGE_FALLBACK} />
          <span className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold group-hover:bg-black/75 transition-colors">
            <ImagesIcon weight="duotone" className="size-5" /> View Gallery
          </span>
        </button>
        {tiles.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightboxIdx(i + 1)}
            className="relative group cursor-pointer overflow-hidden bg-neutral-100"
          >
            <SafeImage src={src} alt="" className="absolute inset-0 w-full h-full object-cover" fallback={IMAGE_FALLBACK} />
          </button>
        ))}
      </div>

      {lightboxIdx !== null && (
        <ImageLightbox
          images={lightboxImages}
          activeIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={setLightboxIdx}
        />
      )}
    </div>
  );
}
