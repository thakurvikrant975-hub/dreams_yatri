"use client";

import { useState } from "react";
import Image from "next/image";
import { CarIcon, BedIcon, ForkKnifeIcon, ParachuteIcon, MapPinIcon, CoffeeIcon, BowlSteamIcon, CheersIcon, RoadHorizonIcon } from "@phosphor-icons/react";
import { CheckCheck, CircleX } from "lucide-react";
import { Accordion } from "@/app/components/ui/Accordian";
import { Text } from "@/app/components/ui/Typography";
import { Carousel } from "@/app/components/ui/Carousel";
import ImageLightbox, { type LightboxImage } from "@/app/components/gallery/ImageLightbox";
import { CheckInIcon, CheckOutIcon } from "@/app/components/icons/cusomIcon";
import { SafeImage } from "./SafeImage";
import {
  computeShiftedMeals, mealIncludedText, occupancyText, formatTime12h,
  type PreviewData,
} from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";
import type { DayItinerary, ActivityInput } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";

const STANDARD_MEAL_CHIPS = [
  { key: "breakfast", label: "Breakfast", icon: CoffeeIcon },
  { key: "lunch", label: "Lunch", icon: BowlSteamIcon },
  { key: "dinner", label: "Dinner", icon: CheersIcon },
] as const;

/** Icon + title + subtitle trigger for a collapsible section within a day —
 * mirrors the catalog page's SectionTrigger/DaySectionBlock pattern. */
function SectionBlock({
  id, icon: Icon, title, subtitle, children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <div className="flex items-center gap-5 w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icon aria-hidden="true" weight="duotone" className="size-7 text-primary-400 shrink-0" />
              <Text size="sm" weight="bold" intent="primary" className="font-heading shrink-0">{title}</Text>
              {subtitle && <Text size="xs" className="text-secondary truncate min-w-0">{subtitle}</Text>}
            </div>
            <Accordion.Chevron className="size-4 text-neutral-400" />
          </div>
        </Accordion.Trigger>
        <Accordion.Content className="px-0 pb-0">
          {children}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

function RouteTimeline({ from, to, distanceKm }: { from: string; to: string; distanceKm: number | null }) {
  return (
    <div className="w-full border-l-[0.2em] border-l-(--border-default) flex-1 flex flex-col gap-2 mb-3">
      <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-8 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
        <div className="flex items-center gap-3">
          <div className="size-7 flex items-center justify-center ml-3 shrink-0">
            <span className="text-muted"><MapPinIcon weight="duotone" className="size-5.5" /></span>
          </div>
          <div className="flex gap-3 w-full mt-0.5">
            <Text size="sm" intent="primary" className="w-max mb-0.5 font-heading shrink-0">Pickup Point:</Text>
            <Text size="sm" intent="primary" weight="semibold" className="font-heading">{from || "—"}</Text>
          </div>
        </div>
      </div>
      <div className="h-12 w-full flex items-stretch">
        <div className="w-18" />
        <div className="h-full flex-1 border-l-[0.2em] border-l-(--border-default) px-3 flex items-center gap-0.5">
          <Text as="span" size="sm" weight="medium" intent="secondary">{distanceKm ? `${distanceKm} km` : "In-city transfer"}</Text>
          <RoadHorizonIcon weight="duotone" className="size-5 text-muted ml-2" />
        </div>
      </div>
      <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-8 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
        <div className="flex gap-3 items-center">
          <div className="size-7 flex items-center justify-center ml-3 shrink-0">
            <span className="text-muted"><MapPinIcon weight="duotone" className="size-5.5" /></span>
          </div>
          <div className="flex items-center gap-3 w-full">
            <Text size="sm" intent="primary" className="w-max mb-0.5 font-heading shrink-0">Drop Point:</Text>
            <Text size="sm" intent="primary" weight="semibold" className="font-heading">{to || "—"}</Text>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransferBlock({ day }: { day: DayItinerary }) {
  const vehicleName = day.transportVehicleType || day.transport || "Cab";
  const extraCabs = (day.extraCabs ?? []).filter((c) => c.label.trim());
  return (
    <SectionBlock id={`day-${day.day}-cab`} icon={CarIcon} title="Transfer" subtitle={day.transportSeats ? `${day.transportSeats} Seats` : undefined}>
      <div className="mt-2 flex">
        <div className="w-10 shrink-0" />
        <div className="flex-1 flex gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-3">
              <Text size="base" weight="semibold" intent="primary" className="font-heading">
                {day.cabQuantity && day.cabQuantity > 1 ? `${day.cabQuantity}× ` : ""}{vehicleName}
              </Text>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <RouteTimeline from={day.transportPickup} to={day.transportDrop} distanceKm={day.transportDistanceKm} />
              {day.transportPhoto && (
                <div className="relative h-36 w-full sm:w-64 sm:aspect-video sm:shrink-0 rounded-2xl overflow-hidden bg-neutral-100">
                  <Image src={day.transportPhoto} alt={vehicleName} fill sizes="(min-width: 640px) 256px, 100vw" className="object-cover" />
                </div>
              )}
            </div>
            {extraCabs.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {extraCabs.map((c, i) => (
                  <Text key={i} size="xs" intent="muted" className="block">
                    + {c.quantity > 1 ? `${c.quantity}× ` : ""}{c.label}
                  </Text>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SectionBlock>
  );
}

function StayBlock({ day, adults, childCount }: { day: DayItinerary; adults: number; childCount: number }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const photos = [day.accommodationPhoto, ...day.accommodationRoomPhotos].filter(Boolean);
  const extraRooms = (day.extraRooms ?? []).filter((r) => r.roomPricingId > 0);
  const mealText = mealIncludedText(day.hotelMealPlan);

  return (
    <SectionBlock id={`day-${day.day}-stay`} icon={BedIcon} title="Stay At" subtitle={day.accommodationLocation || undefined}>
      <div className="mt-2 flex">
        <div className="w-10 shrink-0" />
        <div className="flex-1 flex flex-col">
          <div>
            <Text size="base" weight="semibold" className="font-heading text-primary leading-tight">{day.accommodation}</Text>
            {day.accommodationLocation && (
              <div className="flex items-center gap-1.5 mt-1">
                <MapPinIcon weight="duotone" className="size-3.5 text-muted shrink-0" />
                <Text size="xs" intent="secondary" className="leading-snug">{day.accommodationLocation}</Text>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1 flex flex-col gap-2.5 min-w-0">
              <div className="flex flex-col gap-1 mt-1">
                <Text size="xs" intent="secondary">{occupancyText(day.accommodationRoomCapacity, adults, childCount, day.roomsCount)}</Text>
              </div>

              {(day.hotelCheckIn || day.hotelCheckOut) && (
                <div className="w-full border-l-[0.2em] border-l-(--border-default) flex flex-row items-center gap-3.5 my-3">
                  <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-12 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
                    <div className="flex items-center gap-3">
                      <div className="size-9 flex items-center justify-center ml-3 shrink-0">
                        <span className="text-muted size-7"><CheckInIcon /></span>
                      </div>
                      <div className="flex flex-col items-center gap-1 w-full mt-0.5">
                        <Text size="xs" intent="primary" className="w-max font-heading shrink-0">Check In:</Text>
                        <Text size="sm" intent="primary" weight="semibold" className="font-heading">{formatTime12h(day.hotelCheckIn) || "—"}</Text>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center px-2 gap-0.5">
                    <div className="w-full border-b-[0.2em] border-b-(--border-default) border-dashed" />
                  </div>
                  <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-12 after:right-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
                    <div className="flex flex-row-reverse items-center gap-3">
                      <div className="size-9 flex items-center justify-center shrink-0 mr-4">
                        <span className="text-muted size-7"><CheckOutIcon /></span>
                      </div>
                      <div className="flex flex-col items-center gap-1 w-full">
                        <Text size="xs" intent="primary" className="w-max font-heading shrink-0">Check Out:</Text>
                        <Text size="sm" intent="primary" weight="semibold" className="font-heading">{formatTime12h(day.hotelCheckOut) || "—"}</Text>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {day.accommodationRoomSpecs && (
                <div className="flex flex-col gap-1 pt-2.5 border-t border-(--border-muted)">
                  <Text size="xs" intent="muted">({day.accommodationRoomSpecs})</Text>
                </div>
              )}

              {mealText && (
                <div className="flex items-center gap-2">
                  <ForkKnifeIcon weight="duotone" className="size-4 text-muted shrink-0" />
                  <Text size="sm" intent="secondary">{mealText}</Text>
                </div>
              )}

              {extraRooms.length > 0 && (
                <div className="space-y-0.5">
                  {extraRooms.map((r, i) => (
                    <Text key={i} size="xs" intent="muted" className="block">
                      + {r.quantity > 1 ? `${r.quantity}× ` : ""}{r.label}
                    </Text>
                  ))}
                </div>
              )}
            </div>

            {photos.length > 0 && (
              <div className="sm:shrink-0 sm:w-64">
                <div className="grid grid-cols-4 grid-rows-4 gap-0.5 rounded-2xl overflow-hidden h-44 sm:h-52 w-full">
                  {photos.slice(0, 5).map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxIdx(i)}
                      className={`relative overflow-hidden cursor-pointer ${i === 0 ? "row-span-3 col-span-4" : ""}`}
                    >
                      <Image src={src} alt={day.accommodation} fill sizes="(min-width: 640px) 256px, 100vw" className="object-cover hover:opacity-90" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {lightboxIdx !== null && (
            <ImageLightbox
              images={photos.map((src): LightboxImage => ({ src, label: day.accommodation }))}
              activeIdx={lightboxIdx}
              onClose={() => setLightboxIdx(null)}
              onNavigate={setLightboxIdx}
            />
          )}
        </div>
      </div>
    </SectionBlock>
  );
}

function MealsBlock({ meals }: { meals: string[] }) {
  const extras = meals.filter((m) => !STANDARD_MEAL_CHIPS.some((c) => m.toLowerCase().includes(c.key)));
  return (
    <SectionBlock id="meals" icon={ForkKnifeIcon} title="Meals">
      <div className="mt-2 flex">
        <div className="w-10 shrink-0" />
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-stretch gap-2">
            {STANDARD_MEAL_CHIPS.map(({ key, label, icon: Icon }) => {
              const included = meals.some((m) => m.toLowerCase().includes(key));
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-1 ${included ? "text-primary" : "text-muted"}`}
                >
                  <span className="flex items-center gap-1">
                    <Icon weight="duotone" className={`size-4 shrink-0 ${included ? "text-success-500" : "text-muted"}`} />
                    {label}
                  </span>
                  {included
                    ? <CheckCheck className="size-4 text-success-500 shrink-0" />
                    : <CircleX className="size-4 text-error-600 shrink-0" />}
                </div>
              );
            })}
          </div>
          {extras.length > 0 && (
            <Text size="xs" intent="muted">+ {extras.join(", ")}</Text>
          )}
        </div>
      </div>
    </SectionBlock>
  );
}

function ActivityBlock({ activity, index }: { activity: ActivityInput; index: number }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const images: LightboxImage[] = (activity.photos.length > 0 ? activity.photos : (activity.photo ? [activity.photo] : []))
    .map((src) => ({ src, label: activity.title }));

  return (
    <SectionBlock id={`activity-${index}`} icon={ParachuteIcon} title="Activity" subtitle={activity.title}>
      <div className="mt-2 flex">
        <div className="w-10 shrink-0" />
        <div className="flex-1 space-y-3">
          <Text size="base" weight="semibold" className="font-heading text-primary leading-tight">{activity.title}</Text>
          {activity.description && (
            <Text size="sm" intent="secondary" className="leading-relaxed block">{activity.description}</Text>
          )}
          {images.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Glimpses of the experience</p>
              <Carousel
                items={images}
                perView={3}
                gap={6}
                renderItem={(img, idx) => (
                  <button
                    type="button"
                    onClick={() => setLightboxIdx(idx)}
                    className="relative rounded-xl overflow-hidden w-full"
                  >
                    <SafeImage
                      src={img.src}
                      alt={img.label}
                      className="w-full aspect-5/3 object-cover hover:scale-[1.03] transition-transform duration-300"
                      fallback={<div className="w-full aspect-5/3 bg-neutral-100" />}
                    />
                  </button>
                )}
              />
              {lightboxIdx !== null && (
                <ImageLightbox images={images} activeIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} onNavigate={setLightboxIdx} />
              )}
            </div>
          )}
        </div>
      </div>
    </SectionBlock>
  );
}

/** Day-by-day accordion — mirrors the catalog page's Itnary.tsx visual
 * structure (day badge, Transfer/Stay/Meals/Activity sections with the same
 * timeline/photo-grid/chip layouts), simplified to the custom-package data
 * shape: one hotel + one cab per day (plus "extra room/cab" lines, unique to
 * custom packages), no pricing tiers, no optional-activity flag. */
export function CustomItinerarySection({ form }: { form: PreviewData }) {
  const shiftedMeals = computeShiftedMeals(form.itineraries);

  return (
    <Accordion variant="ghost" multiple defaultOpen={form.itineraries.map((d) => `day-${d.day}`)}>
      {form.itineraries.map((day, i) => {
        const activities = day.activities.filter((a) => a.title.trim());
        return (
          <Accordion.Item key={day.day} id={`day-${day.day}`} className="mb-3">
            <div className="bg-white rounded-2xl ring-1 ring-(--border-default) overflow-hidden px-4">
              <Accordion.Trigger className="py-3.5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="shrink-0 bg-brand px-3 py-1 rounded-pill">
                    <Text intent="inverse" size="xs" weight="semibold" className="font-heading">Day {day.day}</Text>
                  </span>
                  <Text as="span" intent="primary" weight="semibold" size="base" truncate className="font-heading">
                    {day.title}
                  </Text>
                </div>
                <Accordion.Chevron className="size-5 text-neutral-400 shrink-0" />
              </Accordion.Trigger>
              <Accordion.Content className="px-0 pb-2 pt-0">
                {day.description && (
                  <Text size="sm" intent="secondary" className="py-3 border-b border-(--border-muted) block">
                    {day.description}
                  </Text>
                )}
                <div className="flex flex-col divide-y divide-(--border-muted)">
                  {(day.transport || day.transportVehicleType || day.transportPickup) && (
                    <div className="py-4"><TransferBlock day={day} /></div>
                  )}
                  {day.accommodation && (
                    <div className="py-4"><StayBlock day={day} adults={form.adults} childCount={form.children} /></div>
                  )}
                  {shiftedMeals[i].length > 0 && (
                    <div className="py-4"><MealsBlock meals={shiftedMeals[i]} /></div>
                  )}
                  {activities.map((a, ai) => (
                    <div key={ai} className="py-4"><ActivityBlock activity={a} index={ai} /></div>
                  ))}
                </div>
              </Accordion.Content>
            </div>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}
