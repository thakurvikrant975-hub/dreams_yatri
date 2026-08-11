// ItinerarySection.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBooking, type CabGroup } from './PackageBookingProvider';
import type { CabTypeOption, RoomOption } from '@/app/actions/packages/fetch-page-data';
import { getCardImage } from '@/app/lib/imageUrl';
import { iconFor } from '@/app/lib/hotel-inventory/room-amenities';
import { AMENITY_ICONS } from '@/app/(website)/hotels/[slug]/amenity-icons';
import ImageLightbox from '@/app/components/gallery/ImageLightbox';
import { Dialog, VisuallyHidden } from 'radix-ui';
import { cn } from '@/app/lib/utils';
import Accordion from '@/app/components/ui/Accordian';
import { Text } from '@/app/components/ui/Typography';
import {
  CheckIcon,
  ClockIcon,
  BuildingOffice2Icon,
  CalendarDateRangeIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
} from '@heroicons/react/24/solid';
import {
  CarIcon,
  BedIcon,
  ForkKnifeIcon,
  ParachuteIcon,
  AirplaneTiltIcon,
  MapPinIcon,
  StarAndCrescentIcon,
  CoffeeIcon,
  BowlSteamIcon,
  CheersIcon,
  NotePencilIcon,
  RoadHorizonIcon,
  SeatIcon,
  SnowflakeIcon,
} from '@phosphor-icons/react';
import { CheckInIcon, CheckOutIcon } from '@/app/components/icons/cusomIcon';
import Image from 'next/image';
import { Carousel } from '@/app/components/ui/Carousel';
import { CheckCheck, CircleX } from 'lucide-react';


// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner';
type InclusionStatus = 'included' | 'excluded';
type NoteVariant = 'error' | 'success' | 'brand' | 'neutral' | 'warning' | 'info';
type NoteType = 'warning' | 'info' | 'error' | 'success' | 'neutral';

interface RouteStop {
  label: string;
  value: string;
  locationType?: string | null;
  note?: string;
  noteVariant?: NoteVariant;
  notePill?: {
    text: string;
    linkText?: string;
    linkVariant?: 'error' | 'success' | 'brand' | 'neutral' | 'warning' | 'info';
  };
}

interface FlightSection { type: 'flight'; from: RouteStop; to: RouteStop }
interface CabSection {
  type: 'cab';
  subtitle?: string;
  from: RouteStop;
  to: RouteStop;
  distance_km?: number | null;
  vehicle_name?: string | null;
  vehicle_type?: string | null;
  vehicle_capacity?: number | null;
  vehicle_image?: string | null;
  num_vehicles?: number;
  transfer_notes?: string | null;
}
interface StaySection {
  type: 'stay';
  itineraryStayId: number;
  hotelId: number;
  destinationId: number | null;
  roomPricingId: number;
  pricePerNight: number;
  nights: number;
  dayNumber: number;
  hotelName: string;
  stayType: string | null;
  checkIn: string;
  checkOut: string;
  address: string | null;
  location: string | null;
  inclusions: { label: string; status: InclusionStatus }[];
  images: string[];
  roomName: string | null;
  roomCapacity: number | null;
  roomBedType: string | null;
  roomAreaSqft: number | null;
  roomView: string | null;
  roomExtraBeds: number;
  activeMeals: string[];
  mealType: string | null;
  planName: string | null;
}
interface ActivitySection {
  type: 'activity';
  name: string;
  description?: string | null;
  duration_hours?: number | null;
  difficulty?: string | null;
  category?: string | null;
  is_optional?: boolean;
  pricingTiers?: { label: string; price: number }[];
  images: { src: string; label: string }[];
}
interface FoodSection { type: 'food'; meals: { meal: MealType; restaurant: string; items: string }[] }
interface MealSection { type: 'meal'; items: { name: string; source: string | null }[] }

export type DaySection = FlightSection | CabSection | StaySection | ActivitySection | FoodSection | MealSection;

export interface ItineraryNote {
  message: string;
  type: string;
  position: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  description?: string | null;
  sections: DaySection[];
  notes?: ItineraryNote[];
  attractions?: { imageUrl: string; fullImageUrl: string; caption: string }[];
}

interface ItineraryProps {
  days: ItineraryDay[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TABS = [
  { id: 'Plan', label: 'Plan', icon: CalendarDateRangeIcon },
  { id: 'Transfer', label: 'Transfer', icon: CarIcon },
  { id: 'Hotels', label: 'Hotels', icon: BuildingOffice2Icon },
  { id: 'Meals', label: 'Meals', icon: ForkKnifeIcon },
  { id: 'Activity', label: 'Activity', icon: ParachuteIcon },
] as const;

type Tab = typeof TABS[number]['id'];

const TAB_SECTION_TYPE: Partial<Record<Tab, DaySection['type']>> = {
  Transfer: 'cab',
  Hotels: 'stay',
  Meals: 'meal',
  Activity: 'activity',
};

const noteColorMap: Record<NoteVariant, string> = {
  error: 'text-error-700',
  success: 'text-success-700',
  brand: 'text-brand',
  neutral: 'text-muted',
  warning: 'text-warning-700',
  info: 'text-info-700'
};

const NOTE_STYLES: Record<NoteType, { bg: string; border: string; text: string; iconClass: string }> = {
  warning: { bg: 'bg-warning-50', border: 'border-warning-200', text: 'text-warning-800', iconClass: 'text-warning-500' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', iconClass: 'text-blue-500' },
  error: { bg: 'bg-error-50', border: 'border-error-200', text: 'text-error-800', iconClass: 'text-error-500' },
  success: { bg: 'bg-success-50', border: 'border-success-200', text: 'text-success-800', iconClass: 'text-success-500' },
  neutral: { bg: 'bg-neutral-50', border: 'border-neutral-200', text: 'text-secondary', iconClass: 'text-muted' },
};

const NOTE_ICONS: Record<NoteType, React.ElementType> = {
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
  error: XCircleIcon,
  success: CheckCircleIcon,
  neutral: NotePencilIcon,
};

const mealLabel: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

const PILL_CLASSES: Record<string, { wrapper: string; link: string }> = {
  brand:   { wrapper: 'bg-primary-50 text-primary',     link: 'text-brand' },
  error:   { wrapper: 'bg-error-50 text-error-600',     link: 'text-error-600' },
  success: { wrapper: 'bg-success-50 text-success-600', link: 'text-success-600' },
  warning: { wrapper: 'bg-warning-50 text-warning-600', link: 'text-warning-600' },
  info:    { wrapper: 'bg-info-50 text-info-600',       link: 'text-info-600' },
  neutral: { wrapper: 'bg-neutral-50 text-secondary',   link: 'text-primary' },
};

// ─── Note Block ───────────────────────────────────────────────────────────────

function NoteBlock({
  notes,
  position,
}: {
  notes: ItineraryNote[];
  position: 'top' | 'bottom';
}) {
  const filtered = notes.filter(n => {
    if (position === 'top') return ['top', 'before', 'start'].includes(n.position);
    if (position === 'bottom') return ['bottom', 'after', 'end'].includes(n.position);
    return false;
  });

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {filtered.map((note, i) => {
        const type = (note.type as NoteType) in NOTE_STYLES ? (note.type as NoteType) : 'neutral';
        const style = NOTE_STYLES[type];
        const Icon = NOTE_ICONS[type];
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border',
              style.bg, style.border
            )}
          >
            <Icon className={cn('size-4 shrink-0 mt-0.5', style.iconClass)} />
            <Text size="xs" className={style.text}>{note.message}</Text>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cab Route Display ────────────────────────────────────────────────────────

function CabRoute({
  from,
  to,
  distance_km,
}: {
  from: string;
  to: string;
  distance_km?: number | null;
}) {
  return (

    <div className="w-full border-l-[0.2em] border-l-(--border-default) flex-1 flex flex-col gap-2 mb-3">
      {/* Pickup */}
      <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-8 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
        <div className="flex items-center gap-3">
          <div className="size-7 flex items-center justify-center ml-3 shrink-0">
            <span className='text-muted'><MapPinIcon weight='duotone' className='size-5.5' /></span>
          </div>
          <div className="flex gap-3 w-full mt-0.5">
            <Text size="sm" intent="primary" className="w-max mb-0.5 font-heading shrink-0">Pickup Point:</Text>
            <div className="flex items-center gap-1.5 ">
              <Text size="sm" intent="primary" weight="semibold" className="font-heading">{from}</Text>
            </div>
          </div>
        </div>
      </div>

      <div className="h-12 w-full flex items-stretch">
        <div className="w-18" />
        <div className="h-full flex-1 border-l-[0.2em] border-l-(--border-default) px-3 flex items-center gap-0.5">
          <Text as='span' size="sm" weight='medium' intent='secondary'>
            {distance_km ? `${distance_km} km` : 'In-city transfer'}
          </Text>
          <RoadHorizonIcon weight='duotone' className="size-5 text-muted ml-2" />
        </div>
      </div>

      {/* Drop */}
      <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-8 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
        <div className="flex gap-3 items-center">
          <div className="size-7 flex items-center justify-center ml-3 shrink-0">
            <span className='text-muted'><MapPinIcon weight='duotone' className='size-5.5' /></span>
          </div>
          <div className="flex items-center gap-3 w-full">
            <Text size="sm" intent="primary" className="w-max mb-0.5 font-heading shrink-0">Drop Point:</Text>
            <div className="flex items-center gap-1.5 ">
              <Text size="sm" intent="primary" weight="semibold" className="font-heading">{to}</Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Travel Stop (existing) ───────────────────────────────────────────────────

function TravelStop({ stop }: { stop: RouteStop }) {
  return (
    <div className='relative after:absolute after:w-0.5 after:h-full after:max-h-8 after:left-0 after:top-0  after:bg-primary-400 after:-translate-x-[0.12em]'>
      <div className="flex gap-3">
        <div className="size-7 flex items-center justify-center ml-1">
          <MapPinIcon weight='regular' className="size-5.5 text-muted" />
        </div>
        <div className='flex gap-3 w-full'>
          <Text size='sm' intent='primary' className="w-max mb-0.5 font-heading">{stop.label}</Text>
          <div className='space-y-0.5 flex-1'>
            <Text size='sm' intent='primary' weight='semibold' className='font-heading'>{stop.value}</Text>
            {stop.note && (
              <Text
                size="xs"
                className={cn(noteColorMap[stop.noteVariant ?? 'neutral'])}
                dangerouslySetInnerHTML={{ __html: stop.note }}
              />
            )}
            {stop.notePill && (() => {
              const pill = PILL_CLASSES[stop.notePill.linkVariant ?? 'neutral'] ?? PILL_CLASSES.neutral;
              return (
                <div className={cn('mt-1.5 rounded-b-2xl px-3.5 py-2.5 text-[12.5px]', pill.wrapper)}>
                  {stop.notePill.text}{' '}
                  {stop.notePill.linkText && (
                    <span className={cn('font-semibold cursor-pointer', pill.link)}>
                      {stop.notePill.linkText}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div >
  )
}

function TravelTransfer({ stopFrom, stopTo }: { stopFrom: RouteStop; stopTo: RouteStop }) {
  return (
    <div className="flex">
      <div className="w-10" />
      <div className='w-full border-l-[0.12em] border-l-(--border-default) flex-1 py-2 flex flex-col gap-7 mb-3'>
        <TravelStop stop={stopFrom} />
        <TravelStop stop={stopTo} />
      </div>
    </div>
  )
}

function RouteStop({
  stop,
  showLine = true,
}: {
  stop: RouteStop;
  showLine?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-3 ml-8">
      <div className="flex flex-col items-center w-8 shrink-0">
        <div className="size-8 flex items-center justify-center">
          <MapPinIcon className="size-5 text-neutral-300" />
        </div>
        {showLine && (
          <div className="w-0.5 flex-1 min-h-3 bg-primary-500" />
        )}
      </div>
      <div className="flex-1 py-1">
        <div className='flex gap-3 items-center'>
          <Text size='sm' intent='secondary' className=" mb-0.5 font-heading">{stop.label}</Text>
          <Text size='sm' intent='primary' weight='semibold' className='font-heading'>{stop.value}</Text>
        </div>
        {stop.note && (
          <Text size='sm' className={cn(noteColorMap[stop.noteVariant ?? 'neutral'])}>
            {stop.note}
          </Text>
        )}
        {stop.notePill && (() => {
          const pill = PILL_CLASSES[stop.notePill.linkVariant ?? 'neutral'] ?? PILL_CLASSES.neutral;
          return (
            <div className={cn('mt-1.5 rounded-lg px-3 py-2 text-[12.5px]', pill.wrapper)}>
              {stop.notePill.text}{' '}
              {stop.notePill.linkText && (
                <span className={cn('font-semibold cursor-pointer', pill.link)}>
                  {stop.notePill.linkText}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionTrigger({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-5 w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon aria-hidden="true" weight='duotone' className="size-7 duo_icons shrink-0" />
        <Text size='sm' weight='bold' intent='primary' className="font-heading shrink-0">{title}</Text>
        {subtitle && (
          <Text size='xs' className="text-secondary truncate min-w-0">{subtitle}</Text>
        )}
      </div>
      <Accordion.Chevron className="size-4 text-neutral-400" />
    </div>
  );
}

// ─── Section Renderers ────────────────────────────────────────────────────────

function FlightContent({ section }: { section: FlightSection }) {
  return (
    <div className="mt-3">
      <TravelTransfer stopFrom={section.from} stopTo={section.to} />
    </div>
  );
}

// Dummy placeholder image shown until a real vehicle photo is attached
const CAB_PLACEHOLDER = "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=70";

function CabContent({ section, day }: { section: CabSection; day?: number }) {
  const { cabGroups, cabSelections, setCabForGroup, isPricingLoading } = useBooking();
  const [vehicleSidebarOpen, setVehicleSidebarOpen] = useState(false);

  // Find the selected cab for this day's range
  const cabGroup = day != null
    ? cabGroups.find(g => g.dayFrom <= day && day <= g.dayTo)
    : undefined;
  const selectedCabId = cabGroup ? cabSelections.get(cabGroup.groupKey) : undefined;
  const selectedCab = cabGroup?.cabs.find(c => c.id === selectedCabId)
    ?? cabGroup?.cabs.find(c => c.is_default)
    ?? cabGroup?.cabs[0];
  const canChangeVehicle = !!cabGroup && cabGroup.cabs.length > 1;

  const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  const resolvedName = selectedCab?.label ?? section.vehicle_name;
  const resolvedType = selectedCab?.vehicle.type ?? section.vehicle_type;
  const resolvedCapacity = selectedCab?.vehicle.passenger_capacity ?? section.vehicle_capacity;
  const resolvedImage = selectedCab?.vehicle.image_key
    ? (selectedCab.vehicle.image_key.startsWith('http')
      ? selectedCab.vehicle.image_key
      : `${R2}/${selectedCab.vehicle.image_key}`)
    : section.vehicle_image;

  const hasVehicleInfo = resolvedName || resolvedType || resolvedCapacity;

  return (
    <div className="mt-2 flex">
      <div className="w-10 shrink-0" />
      <div className="flex-1 flex gap-3">

        <div className='flex-1'>
          {/* Vehicle details pill */}
          {hasVehicleInfo && (
            <div className="flex items-center gap-2.5 justify-between  mb-3">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {resolvedName && (
                  <Text size="base" weight="semibold" intent="primary" className="font-heading">
                    {resolvedName}
                  </Text>
                )}
                {resolvedType && (
                  <>
                    <span className="text-muted text-sm">·</span>
                    <Text size="sm" intent="secondary">{resolvedType}</Text>
                  </>
                )}
                {resolvedCapacity && (
                  <>
                    <span className="text-muted text-sm">·</span>
                    <Text size="sm" intent="secondary">{resolvedCapacity} Seats</Text>
                  </>
                )}
                {section.num_vehicles && section.num_vehicles > 1 && (
                  <>
                    <span className="text-muted text-sm">·</span>
                    <Text size="sm" intent="secondary">×{section.num_vehicles} Vehicles</Text>
                  </>
                )}
              </div>
              {canChangeVehicle && (
                <button
                  type="button"
                  onClick={() => setVehicleSidebarOpen(true)}
                  className="text-xs text-primary-500 hover:text-primary-600 font-semibold cursor-pointer shrink-0 "
                >
                  Choose Vehicle
                </button>
              )}
            </div>
          )}

          {/* Route: pickup → drop */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <CabRoute
              from={section.from.value}
              to={section.to.value}
              distance_km={section.distance_km}
            />

            {/* Vehicle image */}
            {(resolvedImage || resolvedName) && (
              <div className="relative h-36 w-full sm:w-auto sm:aspect-video sm:shrink-0 rounded-2xl overflow-hidden bg-neutral-100">
                <Image
                  src={resolvedImage || CAB_PLACEHOLDER}
                  alt={resolvedName ?? "Vehicle"}
                  fill
                  sizes="(min-width: 640px) 256px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
                {!resolvedImage && (
                  <span className="absolute top-2 right-2 text-[9px] text-white/50 font-medium tracking-wide bg-black/30 rounded px-1 py-0.5">
                    placeholder
                  </span>
                )}
                {resolvedName && (
                  <span className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                    {resolvedName}
                  </span>
                )}
              </div>
            )}
          </div>


          {/* Transfer-level note */}
          {section.transfer_notes && (
            <div className="flex items-start gap-2.5 bg-warning-50 border border-warning-200 rounded-xl px-3.5 py-2.5">
              <ExclamationTriangleIcon className="size-4 text-warning-500 shrink-0 mt-0.5" />
              <Text size="xs" className="text-warning-800">{section.transfer_notes}</Text>
            </div>
          )}
        </div>


      </div>

      {cabGroup && (
        <ChangeVehicleSidebar
          open={vehicleSidebarOpen}
          onClose={() => setVehicleSidebarOpen(false)}
          cabGroup={cabGroup}
          selectedCab={selectedCab}
          fromLabel={section.from.value}
          toLabel={section.to.value}
          onSelect={(cabTypeId) => {
            setCabForGroup(cabGroup.groupKey, cabTypeId);
            setVehicleSidebarOpen(false);
          }}
          isPricingLoading={isPricingLoading}
        />
      )}
    </div>
  );
}

// ─── Change Vehicle Sidebar ───────────────────────────────────────────────────

/** "TEMPO_TRAVELLER" → "Tempo Traveller"; "LUXURY_SUV" → "Luxury SUV" */
function formatVehicleType(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .map(w => (w === 'suv' ? 'SUV' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Price difference vs. the currently selected vehicle, computed from real
 *  segment rates (PER_DAY diff × days in range; PER_KM shown as a rate diff
 *  since total distance isn't known client-side). Only comparable when both
 *  cabs use the same pricing type. */
function vehicleDelta(
  cab: CabTypeOption,
  selectedCab: CabTypeOption | undefined,
  days: number,
): { text: string; isIncrease: boolean } | null {
  if (!selectedCab || cab.id === selectedCab.id) return null;
  const segA = cab.segments[0];
  const segB = selectedCab.segments[0];
  if (!segA || !segB || segA.pricing_type !== segB.pricing_type) return null;
  const perUnitDiff = segA.price - segB.price;
  if (perUnitDiff === 0) return null;
  const isPerDay = segA.pricing_type === 'PER_DAY';
  const totalDiff = isPerDay ? perUnitDiff * days : perUnitDiff;
  const amount = Math.round(Math.abs(totalDiff)).toLocaleString('en-IN');
  return {
    text: `${totalDiff > 0 ? '+' : '−'} ₹${amount}${isPerDay ? '' : ' /km'}`,
    isIncrease: totalDiff > 0,
  };
}

function VehicleOptionCard({
  cab,
  selected,
  delta,
  onSelect,
}: {
  cab: CabTypeOption;
  selected: boolean;
  delta: { text: string; isIncrease: boolean } | null;
  onSelect: () => void;
}) {
  const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '';
  const image = cab.vehicle.image_key
    ? (cab.vehicle.image_key.startsWith('http') ? cab.vehicle.image_key : `${R2}/${cab.vehicle.image_key}`)
    : CAB_PLACEHOLDER;

  return (
    <div
      className={cn(
        'rounded-2xl bg-white transition-all duration-200',
        selected
          ? 'ring-2 ring-primary-500 shadow-md shadow-primary-200/40'
          : 'ring-1 ring-inset ring-(--border-default) shadow-sm shadow-neutral-200/50 hover:ring-(--border-strong) hover:shadow-md hover:shadow-neutral-200/70',
      )}
    >
      {/* Selected banner — flows in normal layout, never overlaps content below */}
      {selected && (
        <div className="flex items-center gap-1.5 bg-primary-500 text-white text-[10px] font-bold uppercase tracking-wide px-3.5 py-2 rounded-t-[inherit]">
          <CheckCircleIcon className="size-3.5" />
          Selected Vehicle
        </div>
      )}

      <div className="flex gap-3.5 p-3.5">
        {/* Full, uncropped vehicle photo — letterboxed on a neutral backdrop */}
        <div className="relative w-28 h-20 shrink-0 rounded-xl overflow-hidden bg-neutral-50 ring-1 ring-inset ring-(--border-muted)">
          <Image src={image} alt={cab.label} fill sizes="112px" className="object-contain p-1.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <Text size="sm" weight="bold" intent="primary" className="font-heading">
              {cab.label}
            </Text>
            <Text size="xs" intent="muted">(or similar)</Text>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className="text-[10px] font-semibold text-secondary bg-neutral-100 rounded-full px-2 py-0.5">
              {formatVehicleType(cab.vehicle.type)}
            </span>
            {cab.is_default && (
              <span className="text-[10px] font-semibold text-primary-600 bg-primary-50 rounded-full px-2 py-0.5">
                Recommended
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2.5">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-secondary">
              <span className="flex items-center justify-center size-5 rounded-full bg-neutral-100 shrink-0">
                <SeatIcon weight="duotone" className="size-3 text-muted" />
              </span>
              {cab.vehicle.passenger_capacity} Seater
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-secondary">
              <span className={cn('flex items-center justify-center size-5 rounded-full shrink-0', cab.vehicle.has_ac ? 'bg-info-50' : 'bg-neutral-100')}>
                {cab.vehicle.has_ac
                  ? <SnowflakeIcon weight="duotone" className="size-3 text-info-500" />
                  : <XCircleIcon className="size-3 text-muted" />}
              </span>
              {cab.vehicle.has_ac ? 'AC' : 'Non-AC'}
            </span>
          </div>

          {cab.note && (
            <Text size="xs" intent="muted" className="mt-2 leading-snug line-clamp-2">{cab.note}</Text>
          )}
        </div>
      </div>

      <div
        className={cn(
          'flex items-center justify-end gap-3 px-3.5 py-2.5 border-t rounded-b-[inherit]',
          selected ? 'border-primary-100 bg-primary-50/60' : 'border-(--border-muted) bg-neutral-50/70',
        )}
      >
        {selected ? (
          <Text as="span" size="xs" weight="semibold" intent="brand" className="whitespace-nowrap flex items-center gap-1">
            <CheckIcon className="size-3.5" /> Selected
          </Text>
        ) : (
          <div className="flex items-center gap-2.5 shrink-0">
            {delta && (
              <Text
                size="sm"
                weight="bold"
                className={cn('font-heading whitespace-nowrap', delta.isIncrease ? 'text-primary' : 'text-success-600')}
              >
                {delta.text}
              </Text>
            )}
            <button
              type="button"
              onClick={onSelect}
              className="text-xs font-semibold text-primary-600 ring-1 ring-inset ring-primary-300 hover:bg-primary-50 rounded-full px-3.5 py-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              Select
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeVehicleSidebar({
  open,
  onClose,
  cabGroup,
  selectedCab,
  fromLabel,
  toLabel,
  onSelect,
  isPricingLoading,
}: {
  open: boolean;
  onClose: () => void;
  cabGroup: CabGroup;
  selectedCab?: CabTypeOption;
  fromLabel?: string;
  toLabel?: string;
  onSelect: (cabTypeId: number) => void;
  isPricingLoading: boolean;
}) {
  const days = Math.max(1, cabGroup.dayTo - cabGroup.dayFrom + 1);
  const dayRangeLabel = cabGroup.dayFrom === cabGroup.dayTo
    ? `Applies to Day ${cabGroup.dayFrom}`
    : `Applies to Day ${cabGroup.dayFrom} – ${cabGroup.dayTo}`;
  const routeLabel = fromLabel && toLabel && fromLabel !== '–' && toLabel !== '–'
    ? `${fromLabel} → ${toLabel}`
    : null;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          data-layout="website"
          className="fixed inset-y-0 right-0 z-9999 flex h-full w-full flex-col bg-white shadow-2xl outline-none sm:w-135 sm:max-w-[90vw] data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right duration-300"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-(--border-muted) bg-white">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex items-center justify-center size-10 rounded-xl bg-primary-50 shrink-0 mt-0.5">
                <CarIcon weight="duotone" className="size-5.5 text-brand" />
              </div>
              <div className="min-w-0">
                <Dialog.Title asChild>
                  <Text size="base" weight="bold" intent="primary" className="font-heading">
                    Change Vehicle
                  </Text>
                </Dialog.Title>
                {routeLabel && (
                  <Text size="sm" intent="secondary" weight="medium" className="mt-0.5">{routeLabel}</Text>
                )}
                <Text size="xs" intent="muted" className="mt-0.5">{dayRangeLabel} of your itinerary</Text>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-muted hover:bg-neutral-100 hover:text-primary transition-colors cursor-pointer shrink-0"
              >
                <XMarkIcon className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 bg-neutral-50/60">
            {cabGroup.cabs.map((cab) => (
              
              <VehicleOptionCard
                key={cab.id}
                cab={cab}
                selected={cab.id === selectedCab?.id}
                delta={vehicleDelta(cab, selectedCab, days)}
                onSelect={() => onSelect(cab.id)}
              />
            ))}
          </div>

          <div className="px-5 py-3.5 border-t border-(--border-muted)">
            <Text size="xs" intent="muted" className="text-center">
              {isPricingLoading
                ? 'Updating your package price…'
                : 'Your package price updates automatically for the selected vehicle.'}
            </Text>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function parseMealTypes(mealType: string | null, planName: string | null): string[] {
  const source = mealType ?? planName ?? '';
  if (!source) return [];
  const lower = source.toLowerCase();
  // Detect explicit meal mentions first (canonical time order) so descriptive
  // names like "AP (Breakfast, Dinner)" / "CP (Breakfast Only)" resolve correctly.
  const found: string[] = [];
  if (lower.includes('breakfast')) found.push('Breakfast');
  if (/morning[\s_-]*snack/.test(lower)) found.push('Morning Snacks');
  if (lower.includes('lunch')) found.push('Lunch');
  if (/evening[\s_-]*snack/.test(lower)) found.push('Evening Snacks');
  if (lower.includes('dinner')) found.push('Dinner');
  if (found.length) return found;
  // Bare plan codes
  if (lower === 'ap' || lower === 'full board') return ['Breakfast', 'Lunch', 'Dinner'];
  if (lower === 'map' || lower === 'half board') return ['Breakfast', 'Dinner'];
  if (lower === 'cp' || lower === 'bb' || lower === 'bed & breakfast') return ['Breakfast'];
  if (lower === 'ep' || lower === 'room only') return [];
  return [];
}

/** Parses "N Star" and renders N filled yellow stars (+ grey empties up to 5). */
function ordinalDay(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}
function formatStayDate(d: Date): string {
  return `${ordinalDay(d.getDate())} ${d.toLocaleString('en-US', { month: 'short' })}`;
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** ["Breakfast"] → "Breakfast"; ["Breakfast","Dinner"] → "Breakfast & Dinner";
 *  ["Breakfast","Lunch","Dinner"] → "Breakfast, Lunch & Dinner" */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

const STANDARD_MEAL_KEYS = ['breakfast', 'lunch', 'dinner'] as const;
const STANDARD_MEAL_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** Builds a readable summary of included meals (respects parsed plans like MAP). */
function mealSummaryText(meals: string[]): string {
  const labels: string[] = [];
  for (const key of STANDARD_MEAL_KEYS) {
    if (meals.some(m => m.toLowerCase().includes(key))) labels.push(STANDARD_MEAL_LABELS[key]);
  }
  // Snacks / other plan meals not in the standard three
  for (const m of meals) {
    const k = m.toLowerCase();
    if (STANDARD_MEAL_KEYS.some(s => k.includes(s))) continue;
    const label = m.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels.length === 0 ? 'Room only · No meals included' : `${formatList(labels)} included`;
}

// ── Change Hotel / Change Room helpers ──────────────────────────────────────

function formatTime12(t: string | null | undefined): string {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Interleaves hotel + room photos into a single gallery — mirrors the same
 *  slot logic used server-side when building the default StaySection. */
function interleaveStayImages(
  hotelImages: { url: string | null }[],
  roomImages: { url: string | null }[],
): string[] {
  const hotelPool = hotelImages.map(img => img.url ? getCardImage(img.url) : null).filter(Boolean) as string[];
  const roomPool = roomImages.map(img => img.url ? getCardImage(img.url) : null).filter(Boolean) as string[];
  const take = (primary: string[], fallback: string[]) => primary.shift() ?? fallback.shift();
  const slots: string[] = [];
  const s1 = take(hotelPool, roomPool); if (s1) slots.push(s1);
  for (let i = 0; i < 2; i++) { const v = take(roomPool, hotelPool); if (v) slots.push(v); }
  for (let i = 0; i < 2; i++) { const v = take(hotelPool, roomPool); if (v) slots.push(v); }
  return slots;
}

/** Price difference vs. the current stay's rate, computed from real
 *  price_per_night figures × nights — same approach as vehicleDelta(). */
function priceDeltaLabel(
  candidatePricePerNight: number,
  currentPricePerNight: number,
  numNights: number,
): { text: string; isIncrease: boolean } | null {
  const diff = (candidatePricePerNight - currentPricePerNight) * numNights;
  if (diff === 0) return null;
  const amount = Math.round(Math.abs(diff)).toLocaleString('en-IN');
  return { text: `${diff > 0 ? '+' : '−'} ₹${amount}`, isIncrease: diff > 0 };
}

function StayOptionCard({
  option,
  selected,
  delta,
  emphasizeRoom,
  onSelect,
}: {
  option: RoomOption;
  selected: boolean;
  delta: { text: string; isIncrease: boolean } | null;
  /** true for "Change Room" cards — prioritizes the room's own photo/amenities
   *  over the hotel's, since the card represents a specific room, not the property. */
  emphasizeRoom: boolean;
  onSelect: () => void;
}) {
  const primaryImageKey = emphasizeRoom
    ? (option.room_images[0]?.url ?? option.images[0]?.url ?? null)
    : (option.images[0]?.url ?? option.room_images[0]?.url ?? null);
  const image = primaryImageKey ? getCardImage(primaryImageKey) : null;
  const roomTitle = [option.room_name, option.plan_name].filter(Boolean).join(' - ');
  const amenities = emphasizeRoom ? option.room_amenities.slice(0, 6) : [];

  return (
    <div
      className={cn(
        'rounded-2xl bg-white transition-all duration-200',
        selected
          ? 'ring-2 ring-primary-500 shadow-md shadow-primary-200/40'
          : 'ring-1 ring-inset ring-(--border-default) shadow-sm shadow-neutral-200/50 hover:ring-(--border-strong) hover:shadow-md hover:shadow-neutral-200/70',
      )}
    >
      {/* Selected banner — flows in normal layout, never overlaps content below */}
      {selected && (
        <div className="flex items-center gap-1.5 bg-primary-500 text-white text-[10px] font-bold uppercase tracking-wide px-3.5 py-2 rounded-t-[inherit]">
          <CheckCircleIcon className="size-3.5" />
          Selected
        </div>
      )}

      <div className={cn(
        'relative w-full h-36 bg-neutral-50 flex items-center justify-center overflow-hidden',
        !selected && 'rounded-t-[inherit]',
      )}>
        {image ? (
          <Image src={image} alt={roomTitle || option.hotel_name} fill sizes="500px" className="object-cover" />
        ) : (
          <BuildingOffice2Icon className="size-10 text-neutral-300" />
        )}
      </div>

      <div className="p-3.5">
        {!emphasizeRoom && (
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Text size="sm" weight="bold" intent="primary" className="font-heading truncate">
                {option.hotel_name}
              </Text>
              {option.stay_type && <HotelStars stayType={option.stay_type} />}
            </div>
            {option.location && (
              <div className="flex items-center gap-1 mt-0.5 min-w-0">
                <MapPinIcon weight="duotone" className="size-3 text-muted shrink-0" />
                <Text size="xs" intent="secondary" className="truncate">{option.location}</Text>
              </div>
            )}
          </>
        )}
        {roomTitle && (
          <Text size="sm" weight="semibold" intent="primary" className={cn('font-heading leading-snug', !emphasizeRoom && 'mt-2')}>
            {roomTitle}
          </Text>
        )}
        {option.room_capacity && (
          <Text size="xs" intent="muted" className="mt-0.5">Sleeps {option.room_capacity}</Text>
        )}

        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2.5 pt-2.5 border-t border-(--border-muted)">
            {amenities.map((label) => {
              const Icon = AMENITY_ICONS[iconFor(label)] ?? CheckCircleIcon;
              return (
                <span key={label} className="flex items-center gap-1 text-[11px] font-medium text-secondary">
                  <Icon className="size-3.5 text-muted shrink-0" />
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div
        className={cn(
          'flex items-center justify-end gap-3 px-3.5 py-2.5 border-t rounded-b-[inherit]',
          selected ? 'border-primary-100 bg-primary-50/60' : 'border-(--border-muted) bg-neutral-50/70',
        )}
      >
        {selected ? (
          <Text as="span" size="xs" weight="semibold" intent="brand" className="whitespace-nowrap flex items-center gap-1">
            <CheckIcon className="size-3.5" /> Selected
          </Text>
        ) : (
          <div className="flex items-center gap-2.5 shrink-0">
            {delta && (
              <Text
                size="sm"
                weight="bold"
                className={cn('font-heading whitespace-nowrap', delta.isIncrease ? 'text-primary' : 'text-success-600')}
              >
                {delta.text}
              </Text>
            )}
            <button
              type="button"
              onClick={onSelect}
              className="text-xs font-semibold text-primary-600 ring-1 ring-inset ring-primary-300 hover:bg-primary-50 rounded-full px-3.5 py-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              Select
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeStaySidebar({
  open,
  onClose,
  title,
  subtitle,
  stayType,
  location,
  options,
  isLoading,
  currentRoomPricingId,
  currentPricePerNight,
  numNights,
  emphasizeRoom,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | null;
  /** Shown next to the subtitle — the one hotel every card in this list belongs to. */
  stayType?: string | null;
  location?: string | null;
  options: RoomOption[];
  isLoading: boolean;
  currentRoomPricingId: number;
  currentPricePerNight: number;
  numNights: number;
  emphasizeRoom: boolean;
  onSelect: (roomPricingId: number) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-9999 bg-black/50 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Content
          data-layout="website"
          className="fixed inset-y-0 right-0 z-9999 flex h-full w-full flex-col bg-white shadow-2xl outline-none sm:w-135 sm:max-w-[90vw] data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right duration-300"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-(--border-muted) bg-white">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex items-center justify-center size-10 rounded-xl bg-primary-50 shrink-0 mt-0.5">
                <BedIcon weight="duotone" className="size-5.5 text-brand" />
              </div>
              <div className="min-w-0">
                <Dialog.Title asChild>
                  <Text size="base" weight="bold" intent="primary" className="font-heading">
                    {title}
                  </Text>
                </Dialog.Title>
                {subtitle && (
                  <div className="mt-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Text size="sm" intent="secondary" weight="medium" className="truncate">{subtitle}</Text>
                      {stayType && <HotelStars stayType={stayType} />}
                    </div>
                    {location && (
                      <div className="flex items-center gap-1 mt-0.5 min-w-0">
                        <MapPinIcon weight="duotone" className="size-3 text-muted shrink-0" />
                        <Text size="xs" intent="secondary" className="truncate">{location}</Text>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-muted hover:bg-neutral-100 hover:text-primary transition-colors cursor-pointer shrink-0"
              >
                <XMarkIcon className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 bg-neutral-50/60">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-neutral-100 animate-pulse" />
              ))
            ) : options.length === 0 ? (
              <div className="py-10 text-center">
                <Text size="sm" intent="secondary">No other options available right now.</Text>
              </div>
            ) : (
              options.map((opt) => (
                <StayOptionCard
                  key={opt.room_pricing_id}
                  option={opt}
                  selected={opt.room_pricing_id === currentRoomPricingId}
                  delta={priceDeltaLabel(opt.price_per_night, currentPricePerNight, numNights)}
                  emphasizeRoom={emphasizeRoom}
                  onSelect={() => onSelect(opt.room_pricing_id)}
                />
              ))
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-(--border-muted)">
            <Text size="xs" intent="muted" className="text-center">
              Your package price updates automatically for the selected option.
            </Text>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HotelStars({ stayType }: { stayType: string }) {
  const count = parseInt(stayType) || 0;
  if (count < 1 || count > 5) return <span className="text-xs text-muted">{stayType}</span>;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={cn('size-3', i < count ? 'text-amber-400' : 'text-neutral-200')}
        />
      ))}
    </span>
  );
}

function StayContent({ section }: { section: StaySection }) {
  const {
    adults, childCount, travelDate, roomGuests,
    roomSelections, setRoomForStay,
    roomAlternatesByStay, hotelAlternatesByStay,
    loadRoomAlternatives, loadHotelAlternatives, isLoadingAlternatives,
  } = useBooking();

  const [roomSidebarOpen, setRoomSidebarOpen] = useState(false);
  const [hotelSidebarOpen, setHotelSidebarOpen] = useState(false);

  // ── Resolve display data — the user's selected alternate, else the server default ──
  const selectedRoomPricingId = roomSelections.get(section.itineraryStayId);
  const selectedOption: RoomOption | null =
    selectedRoomPricingId != null && selectedRoomPricingId !== section.roomPricingId
      ? roomAlternatesByStay.get(section.itineraryStayId)?.find(r => r.room_pricing_id === selectedRoomPricingId)
        ?? hotelAlternatesByStay.get(section.itineraryStayId)?.find(r => r.room_pricing_id === selectedRoomPricingId)
        ?? null
      : null;

  const hotelName     = selectedOption?.hotel_name ?? section.hotelName;
  const stayType      = selectedOption?.stay_type ?? section.stayType;
  const location       = selectedOption?.location ?? section.location;
  const roomName       = selectedOption?.room_name ?? section.roomName;
  const roomBedType    = selectedOption?.room_bed_type ?? section.roomBedType;
  const roomAreaSqft   = selectedOption?.room_area_sqft ?? section.roomAreaSqft;
  const roomView       = selectedOption?.room_view ?? section.roomView;
  const roomExtraBeds  = selectedOption?.room_extra_beds ?? section.roomExtraBeds;
  const planName        = selectedOption?.plan_name ?? section.planName;
  const mealTypeVal     = selectedOption?.meal_type ?? section.mealType;
  const checkIn         = selectedOption ? formatTime12(selectedOption.check_in_time) : section.checkIn;
  const checkOut        = selectedOption ? formatTime12(selectedOption.check_out_time) : section.checkOut;
  const images          = selectedOption ? interleaveStayImages(selectedOption.images, selectedOption.room_images) : section.images;
  const currentPricePerNight = selectedOption?.price_per_night ?? section.pricePerNight;
  const currentHotelId       = selectedOption?.hotel_id ?? section.hotelId;

  const meals = section.activeMeals.length > 0
    ? section.activeMeals
    : parseMealTypes(mealTypeVal, planName);

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const navigateLightbox = useCallback((i: number) => setLightboxIdx(i), []);

  const lightboxImgs = images.map((src, i) => ({
    src,
    label: i === 0 ? hotelName : (roomName ?? hotelName),
  }));

  const hasMealInfo = meals.length > 0 || planName || mealTypeVal;

  // ── Occupancy + stay dates (from the traveller's booking context) ──
  // Room count mirrors roomGuests.length — the guest's own MMT-style split —
  // rather than re-deriving totalPax ÷ capacity here. The two pickers'
  // shared per-room cap (personsPerRoom in PackageBookingProvider) is already
  // clamped to the tightest room across every stay in the itinerary, so any
  // split the guest can configure is guaranteed to fit THIS stay's room too;
  // re-deriving independently here (and worse, off room_capacity alone, which
  // is only the base beds — see app/lib/room-capacity.ts) used to disagree
  // with both what the guest picked and what pricing actually charges.
  const rooms = roomGuests.length;
  const occupancy =
    `${rooms} Room${rooms !== 1 ? 's' : ''} | ${adults} Adult${adults !== 1 ? 's' : ''}` +
    (childCount > 0 ? `, ${childCount} Child${childCount !== 1 ? 'ren' : ''}` : '');

  // Dates only — the check-in/out times live in the infographic below.
  const nightsLabel = `${section.nights} Night${section.nights !== 1 ? 's' : ''}`;
  let stayDates: string | null = null;
  if (travelDate) {
    const start = new Date(`${travelDate}T00:00:00`);
    const checkInDate = addDays(start, section.dayNumber - 1);
    const checkOutDate = addDays(checkInDate, section.nights);
    stayDates = `${formatStayDate(checkInDate)} - ${formatStayDate(checkOutDate)}, ${nightsLabel}`;
  }

  // ── Room type (from the room pricing variant) ──
  const roomTitle = [roomName, planName].filter(Boolean).join(' - ');
  const roomSpecs = [
    roomAreaSqft ? `${roomAreaSqft} sq.ft` : null,
    roomBedType,
    roomView,
  ].filter(Boolean).join(' | ');
  const extraBedNote = roomExtraBeds > 0
    ? `${roomExtraBeds} Extra bed${roomExtraBeds !== 1 ? 's' : ''}/mattress${roomExtraBeds !== 1 ? 'es' : ''} will be provided at no extra cost`
    : null;
  const hasRoomInfo = !!(roomTitle || roomSpecs || extraBedNote);

  return (
    <div className="mt-2 flex">
      <div className="w-10 shrink-0" />
      <div className="flex-1 flex flex-col">

        {/* ── Hotel name + stars + address + change actions ── */}
        <div>
          <div className="flex items-center gap-2.5 justify-between flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Text size="base" weight="semibold" className="font-heading text-primary leading-tight">
                {hotelName}
              </Text>
              {stayType && <HotelStars stayType={stayType} />}
            </div>
            <button
              type="button"
              onClick={() => { loadHotelAlternatives(section.itineraryStayId, currentHotelId); setHotelSidebarOpen(true); }}
              className="text-xs text-primary-500 hover:text-primary-600 font-semibold cursor-pointer shrink-0"
            >
              Change Hotel
            </button>
          </div>
          {location && (
            <div className="flex items-center gap-1.5 mt-1">
              <MapPinIcon weight="duotone" className="size-3.5 text-muted shrink-0" />
              <Text size="xs" intent="secondary" className="leading-snug">{location}</Text>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {/* ── Left: details ── */}
          <div className="flex-1 flex flex-col gap-2.5 min-w-0">

            {/* Occupancy + stay dates */}
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-2">
                <svg className="size-3.5 shrink-0 text-muted" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                </svg>
                <Text size="xs" intent="secondary">{occupancy}</Text>
              </div>
              {stayDates && (
                <div className="flex items-center gap-2">
                  <ClockIcon className="size-3.5 shrink-0 text-muted" />
                  <Text size="xs" intent="secondary">{stayDates}</Text>
                </div>
              )}
            </div>

            {/* Check-in / Check-out timeline */}
            <div className="w-full border-l-[0.2em] border-l-(--border-default) flex flex-row items-center gap-3.5 my-3">
              <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-12 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
                <div className="flex items-center gap-3">
                  <div className="size-9 flex items-center justify-center ml-3 shrink-0">
                    <span className="text-muted size-7 transform-[scaleX(-1.1)_scaleY(1.1)]"><CheckInIcon /></span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-full mt-0.5">
                    <Text size="xs" intent="primary" className="w-max font-heading shrink-0">Check In:</Text>
                    <Text size="sm" intent="primary" weight="semibold" className="font-heading">{checkIn}</Text>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex items-center px-2 gap-0.5">
                <div className="w-full border-b-[0.2em] border-b-(--border-default) border-dashed" />
                <div className="flex gap-1 px-2.5 bg-neutral-50 ring-1 ring-inset py-1 ring-neutral-300 rounded-md shrink-0">
                  <Text as="span" size="sm" weight="medium" intent="secondary">{section.nights}N</Text>
                  <StarAndCrescentIcon weight="duotone" className="size-4 text-muted ml-1 -rotate-20" />
                </div>
                <div className="w-full border-b-[0.2em] border-b-(--border-default) border-dashed" />
              </div>
              <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-12 after:right-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
                <div className="flex flex-row-reverse items-center gap-3">
                  <div className="size-9 flex items-center justify-center shrink-0 mr-4">
                    <span className="text-muted size-7 scale-110"><CheckOutIcon /></span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-full">
                    <Text size="xs" intent="primary" className="w-max font-heading shrink-0">Check Out:</Text>
                    <Text size="sm" intent="primary" weight="semibold" className="font-heading">{checkOut}</Text>
                  </div>
                </div>
              </div>
            </div>

            {/* Room type — from the selected room pricing variant */}
            {hasRoomInfo && (
              <div className="flex flex-col gap-1 pt-2.5 border-t border-(--border-muted)">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {roomTitle && (
                    <Text size="sm" weight="semibold" className="text-primary font-heading leading-snug">
                      {roomTitle}
                    </Text>
                  )}
                  <button
                    type="button"
                    onClick={() => { loadRoomAlternatives(section.itineraryStayId, currentHotelId); setRoomSidebarOpen(true); }}
                    className="text-xs text-primary-500 hover:text-primary-600 font-semibold cursor-pointer shrink-0"
                  >
                    Change Room
                  </button>
                </div>
                {roomSpecs && (
                  <Text size="xs" intent="muted">({roomSpecs})</Text>
                )}
                {extraBedNote && (
                  <div className="flex items-start gap-1.5 mt-0.5">
                    <CheckIcon className="size-3.5 text-success-600 shrink-0 mt-0.5" />
                    <Text size="xs" intent="secondary" className="leading-snug">{extraBedNote}</Text>
                  </div>
                )}
              </div>
            )}

            {/* Meal inclusion — concise summary (respects plans like MAP/CP) */}
            {hasMealInfo && (
              <div className="flex items-center gap-2">
                <ForkKnifeIcon weight="duotone" className="size-4 text-muted shrink-0" />
                <Text size="sm" intent="secondary">{mealSummaryText(meals)}</Text>
              </div>
            )}

          </div>

          {images.length > 0 && (
            <div className="sm:shrink-0 sm:w-64">
              <div className="grid grid-cols-4 grid-rows-4 gap-0.5 rounded-2xl overflow-hidden h-44 sm:h-52 w-full">
                {images.slice(0, 5).map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxIdx(i)}
                    aria-label={`View ${hotelName} photo ${i + 1}`}
                    className={cn(
                      'relative overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-primary-400 focus-visible:-outline-offset-2',
                      i === 0 && 'row-span-3 col-span-4',
                    )}
                  >
                    <Image
                      src={src}
                      alt={i === 0 ? hotelName : `${hotelName} photo ${i + 1}`}
                      fill
                      sizes="(min-width: 640px) 256px, 100vw"
                      className="object-cover transition-opacity hover:opacity-90"
                      priority={i === 0}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {lightboxIdx !== null && (
          <ImageLightbox
            images={lightboxImgs}
            activeIdx={lightboxIdx}
            onClose={closeLightbox}
            onNavigate={navigateLightbox}
            zClass="z-9999"
          />
        )}

      </div>

      <ChangeStaySidebar
        open={roomSidebarOpen}
        onClose={() => setRoomSidebarOpen(false)}
        title="Change Room"
        subtitle={hotelName}
        stayType={stayType}
        location={location}
        options={roomAlternatesByStay.get(section.itineraryStayId) ?? []}
        isLoading={isLoadingAlternatives && roomSidebarOpen}
        currentRoomPricingId={selectedRoomPricingId ?? section.roomPricingId}
        currentPricePerNight={currentPricePerNight}
        numNights={section.nights}
        emphasizeRoom
        onSelect={(id) => { setRoomForStay(section.itineraryStayId, id); setRoomSidebarOpen(false); }}
      />
      <ChangeStaySidebar
        open={hotelSidebarOpen}
        onClose={() => setHotelSidebarOpen(false)}
        title="Change Hotel"
        subtitle={location}
        options={hotelAlternatesByStay.get(section.itineraryStayId) ?? []}
        isLoading={isLoadingAlternatives && hotelSidebarOpen}
        currentRoomPricingId={selectedRoomPricingId ?? section.roomPricingId}
        currentPricePerNight={currentPricePerNight}
        numNights={section.nights}
        emphasizeRoom={false}
        onSelect={(id) => { setRoomForStay(section.itineraryStayId, id); setHotelSidebarOpen(false); }}
      />
    </div>
  );
}

function ActivityContent({ section }: { section: ActivitySection }) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const navigateLightbox = useCallback((i: number) => setLightboxIdx(i), []);

  // Measure once on mount (element is clamped) to know if text actually overflows
  useEffect(() => {
    const el = descRef.current;
    if (el) setDescOverflows(el.scrollHeight > el.clientHeight + 1);
  }, []);

  return (
    <div className="mt-2 flex">
      <div className="w-10 shrink-0" />
      <div className="flex-1 space-y-3">

        {/* Activity name */}
        <Text size="base" weight="semibold" className="font-heading text-primary leading-tight">
          {section.name}
        </Text>

        {/* Description */}
        {section.description && (
          <div>
            <div className="relative">
              {/* ref on the clamped element itself so scrollHeight reflects true overflow */}
              <p
                ref={descRef}
                className={cn('text-sm text-secondary leading-relaxed', !descExpanded && 'line-clamp-2')}
              >
                {section.description}
              </p>
              {/* Inline "Read more" — overlaid at end of last visible line */}
              {!descExpanded && descOverflows && (
                <button
                  type="button"
                  onClick={() => setDescExpanded(true)}
                  className="absolute bottom-0 right-0 pl-8 bg-linear-to-r from-transparent via-white to-white text-xs font-semibold text-brand hover:text-primary transition-colors"
                >
                  Read more
                </button>
              )}
            </div>
            {descExpanded && (
              <button
                type="button"
                onClick={() => setDescExpanded(false)}
                className="mt-0.5 text-xs font-semibold text-brand hover:text-primary transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        )}



        {/* Pricing tiers */}
        {section.pricingTiers && section.pricingTiers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {section.pricingTiers.map((tier, i) => (
              <div key={i} className="flex items-baseline gap-1.5 bg-neutral-50 ring-1 ring-inset ring-neutral-200 rounded-xl px-3 py-1.5">
                <Text size="xs" intent="secondary">{tier.label}</Text>
                <Text size="sm" weight="bold" intent="primary" className="font-heading">
                  ₹{tier.price.toLocaleString('en-IN')}
                </Text>
              </div>
            ))}
          </div>
        )}

        {/* Image carousel — click to open lightbox */}
        {section.images.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest">Glimpses of the experience</p>
            <Carousel
              items={section.images}
              perView={3}
              gap={6}
              renderItem={({ src, label }, idx) => (
                <button
                  type="button"
                  aria-label={`View ${label} photo ${idx + 1}`}
                  onClick={() => setLightboxIdx(idx)}
                  className="relative rounded-xl overflow-hidden w-full focus-visible:outline-2 focus-visible:outline-primary-400 focus-visible:-outline-offset-2"
                >
                  <Image src={src} alt={label} width={400} height={240} className="w-full aspect-5/3 object-cover hover:scale-[1.03] transition-transform duration-300" />
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-neutral-900/80 via-neutral-900/60 to-transparent px-2 py-1.5 pt-3">
                    <p className="text-sm text-white font-medium truncate">{label}</p>
                  </div>
                </button>
              )}
            />
            {lightboxIdx !== null && (
              <ImageLightbox
                images={section.images}
                activeIdx={lightboxIdx}
                onClose={closeLightbox}
                onNavigate={navigateLightbox}
                zClass="z-9999"
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function FoodContent({ section }: { section: FoodSection }) {
  return (
    <div className="mt-2 flex flex-col gap-3">
      {section.meals.map(({ meal, restaurant, items }, i) => (
        <div key={i} className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="size-7 rounded-full border-[1.5px] border-primary-400 flex items-center justify-center shrink-0">
              <ForkKnifeIcon size={12} className="text-brand" />
            </div>
            {i < section.meals.length - 1 && (
              <div className="w-px flex-1 mt-1 bg-primary-100" />
            )}
          </div>
          <div className="pt-0.5">
            <p className="text-[12px] font-semibold text-primary">
              {mealLabel[meal]} :{' '}
              <span className="font-normal text-secondary">{restaurant}</span>
            </p>
            <p className="text-[11px] text-muted">{items}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Meal Content ─────────────────────────────────────────────────────────────

const STANDARD_MEAL_CHIPS = [
  { key: 'breakfast', label: 'Breakfast', icon: CoffeeIcon },
  { key: 'lunch', label: 'Lunch', icon: BowlSteamIcon },
  { key: 'dinner', label: 'Dinner', icon: CheersIcon },
] as const;

function mealIconFor(name: string): React.ElementType {
  const l = name.toLowerCase();
  if (l.includes('breakfast')) return CoffeeIcon;
  if (l.includes('lunch')) return BowlSteamIcon;
  if (l.includes('dinner')) return CheersIcon;
  return ForkKnifeIcon;
}

/**
 * One row per meal, in time order: breakfast, lunch, dinner, then anything
 * non-standard the plan adds (snacks, high tea).
 *
 * Previously the same three meals were drawn twice — a chip strip showing which
 * were included, then a separate list of only the included ones with their
 * venue. A single list carries both: the strike-through and the tick/cross say
 * whether a meal is in, and the venue rides on the same line.
 */
function mealRows(section: MealSection) {
  const isStandard = (name: string) =>
    STANDARD_MEAL_CHIPS.some(c => name.toLowerCase().includes(c.key));

  const standard = STANDARD_MEAL_CHIPS.map(({ key, label, icon }) => {
    const item = section.items.find(it => it.name.toLowerCase().includes(key));
    return { label: item?.name ?? label, source: item?.source ?? null, icon, included: !!item };
  });

  const extras = section.items
    .filter(it => !isStandard(it.name))
    .map(it => ({ label: it.name, source: it.source, icon: mealIconFor(it.name), included: true }));

  return [...standard, ...extras];
}

function MealContent({ section }: { section: MealSection }) {
  return (
    <div className="mt-2 flex">
      <div className="w-10 shrink-0" />
      <div className="flex-1 flex flex-col gap-2.5">
        {mealRows(section).map(({ label, source, icon: Icon, included }, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className={cn(
                'size-7 rounded-full border-[1.5px] flex items-center justify-center shrink-0 bg-neutral-50',
                included
                  ? 'border-muted shadow-sm shadow-neutral-200/80'
                  : 'border-(--border-default) opacity-60',
              )}
            >
              <Icon weight="fill" className="size-3.5 text-muted" />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
              <span className="relative shrink-0">
                <Text
                  size="sm"
                  intent={included ? 'primary' : 'muted'}
                  weight="semibold"
                  className="font-heading"
                >
                  {label}
                </Text>
                {!included && (
                  <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-px rounded-full bg-error-600" />
                )}
              </span>
              {/* Venue only where there's a meal to serve. */}
              {included && source && (
                <>
                  <span className="text-muted text-sm">·</span>
                  <Text size="xs" intent="secondary" className="truncate min-w-0">{source}</Text>
                </>
              )}
            </div>

            {included
              ? <CheckCheck className="size-4 text-success-500 shrink-0" />
              : <CircleX className="size-4 text-error-600 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Attraction Stories ───────────────────────────────────────────────────────

function AttractionStories({
  items,
  className,
}: {
  items: { imageUrl: string; fullImageUrl: string; caption: string }[];
  className?: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Arrow-key navigation (Escape + focus trap handled by Radix Dialog)
  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setActiveIdx(i => (i !== null && i < items.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setActiveIdx(i => (i !== null && i > 0 ? i - 1 : i));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIdx, items.length]);

  if (!items?.length) return null;

  const active = activeIdx !== null ? items[activeIdx] : null;

  return (
    <div className={className ?? "mt-4 pt-4 border-t border-(--border-muted)"}>

      {/* Header */}
      <div className="flex items-center gap-1.5 mb-3">
        <Text size="xs" intent="secondary" weight="medium">Attractions</Text>
      </div>

      {/* Story circles row */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIdx(i)}
            className="flex flex-col items-center gap-1.5 shrink-0 group focus-visible:outline-2 focus-visible:outline-primary-400 focus-visible:outline-offset-2 focus:outline-none"
          >
            {/* Gradient ring — Instagram-style */}
            <div className="p-0.5 rounded-full bg-linear-to-tr from-yellow-400 via-red-500 to-violet-600 group-active:scale-95 transition-transform duration-150 shadow-sm">
              <div className="p-1 rounded-full bg-white">
                <div className="size-11 rounded-full overflow-hidden">
                  <img
                    src={item.imageUrl}
                    alt={item.caption || ''}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            {/* Caption label */}
            <p className="text-[10px] text-secondary text-center leading-snug max-w-18 line-clamp-2 font-medium">
              {item.caption || ' '}
            </p>
          </button>
        ))}
      </div>

      {/* ── Lightbox — Radix Dialog for focus trap + aria-modal ── */}
      <Dialog.Root open={activeIdx !== null} onOpenChange={(open) => { if (!open) setActiveIdx(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-9999 bg-black/90 backdrop-blur-md" />
          <Dialog.Content
            className="fixed inset-0 z-9999 flex items-center justify-center outline-none"
            aria-describedby={undefined}
            onEscapeKeyDown={() => setActiveIdx(null)}
          >
            <VisuallyHidden.Root asChild>
              <Dialog.Title>
                {active?.caption
                  ? `Attraction: ${active.caption} — ${(activeIdx ?? 0) + 1} of ${items.length}`
                  : `Attraction photo ${(activeIdx ?? 0) + 1} of ${items.length}`}
              </Dialog.Title>
            </VisuallyHidden.Root>

            {active !== null && activeIdx !== null && (
              <div className="relative flex flex-col items-center px-4">
                <img
                  src={active.fullImageUrl}
                  alt={active.caption || `Attraction photo ${activeIdx + 1}`}
                  className="w-[90vw] h-[78vh] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
                />
                {active.caption && (
                  <p className="mt-3 text-sm text-white/80 text-center max-w-[80vw] leading-snug">
                    {active.caption}
                  </p>
                )}
                {items.length > 1 && (
                  <div role="tablist" aria-label="Attraction photos" className="flex items-center gap-1.5 mt-3">
                    {items.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={i === activeIdx}
                        aria-label={`Photo ${i + 1}`}
                        onClick={() => setActiveIdx(i)}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-200',
                          i === activeIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/60',
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="absolute top-4 right-4 size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              >
                <XMarkIcon aria-hidden="true" className="size-5" />
              </button>
            </Dialog.Close>

            {activeIdx !== null && activeIdx > 0 && (
              <button
                type="button"
                aria-label="Previous"
                onClick={() => setActiveIdx(activeIdx - 1)}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}

            {activeIdx !== null && activeIdx < items.length - 1 && (
              <button
                type="button"
                aria-label="Next"
                onClick={() => setActiveIdx(activeIdx + 1)}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            )}

            {activeIdx !== null && items.length > 1 && (
              <div aria-live="polite" aria-atomic="true" className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] text-white/50 tabular-nums">
                {activeIdx + 1} / {items.length}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

// ─── Day Section Block ────────────────────────────────────────────────────────

// Format decimal hours → "3h", "1h 30m", "45m"
function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Truncate a place name to `max` visible chars, appending "…" when cut
function truncatePlace(name: string, max = 15): string {
  const trimmed = name.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 1).trimEnd() + '…' : trimmed;
}

const SECTION_CONFIG: {
  [K in DaySection['type']]: {
    icon: React.ElementType;
    title: string | ((section: Extract<DaySection, { type: K }>) => string);
    subtitle?: (section: Extract<DaySection, { type: K }>) => string | undefined;
    content: (section: Extract<DaySection, { type: K }>) => React.ReactNode;
  }
} = {
  flight: {
    icon: AirplaneTiltIcon,
    title: 'Flight',
    content: (s) => <FlightContent section={s} />,
  },
  cab: {
    icon: CarIcon,
    // Use the exact assigned vehicle name; fall back to generic "Transfer"
    title: 'Transfer',
    subtitle: (s) => {
      const parts: string[] = [];
      if (s.distance_km) parts.push(`${s.distance_km} km`);
      const from = s.from?.value;
      const to = s.to?.value;
      if (from && to && from !== '–' && to !== '–') {
        parts.push(`${truncatePlace(from)} → ${truncatePlace(to)}`);
      }
      return parts.length ? `· ${parts.join('  ·  ')}` : undefined;
    },
    content: (s) => <CabContent section={s} />,
  },
  stay: {
    icon: BedIcon,
    title: 'Stay At',
    subtitle: (s) => `· ${s.nights} night${s.nights !== 1 ? 's' : ''} · ${s.hotelName}`,
    content: (s) => <StayContent section={s} />,
  },
  activity: {
    icon: ParachuteIcon,
    title: 'Activity',
    subtitle: (s) => {
      const parts: string[] = [];
      if (s.is_optional) parts.push('Optional');
      if (s.category) parts.push(s.category);
      if (s.difficulty) parts.push(s.difficulty);
      if (s.duration_hours) parts.push(formatDuration(s.duration_hours));
      return parts.length ? `· ${parts.join(' · ')}` : undefined;
    },
    content: (s) => <ActivityContent section={s} />,
  },
  food: {
    icon: ForkKnifeIcon,
    title: 'Food',
    content: (s) => <FoodContent section={s} />,
  },
  meal: {
    icon: ForkKnifeIcon,
    title: 'Meals',
    subtitle: (s) => {
      const names = Array.from(new Set(s.items.map(it => it.name)));
      return names.length ? `· ${names.join(', ')}` : undefined;
    },
    content: (s) => <MealContent section={s} />,
  },
};

function DaySectionBlock({ section, id, day }: { section: DaySection; id: string; day?: number }) {
  const config = SECTION_CONFIG[section.type] as {
    icon: React.ElementType;
    title: string | ((s: typeof section) => string);
    subtitle?: (s: typeof section) => string | undefined;
    content: (s: typeof section) => React.ReactNode;
  };

  const resolvedTitle =
    typeof config.title === 'function' ? config.title(section) : config.title;

  return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <SectionTrigger
            icon={config.icon}
            title={resolvedTitle}
            subtitle={config.subtitle?.(section)}
          />
        </Accordion.Trigger>
        <Accordion.Content className="px-0 pb-0">
          {section.type === 'cab'
            ? <CabContent section={section} day={day} />
            : config.content(section)
          }
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ItinerarySection({ days }: ItineraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Plan');
  const tabListRef = useRef<HTMLDivElement>(null);

  const sectionType = TAB_SECTION_TYPE[activeTab];
  const visibleDays = sectionType
    ? days
      .map(d => ({ ...d, sections: d.sections.filter(s => s.type === sectionType) }))
      .filter(d => d.sections.length > 0)
    : days;

  const handleTabKeyDown = (e: React.KeyboardEvent, currentIdx: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (currentIdx + 1) % TABS.length;
    if (e.key === 'ArrowLeft') next = (currentIdx - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActiveTab(TABS[next].id);
    const btns = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    btns?.[next]?.focus();
  };

  return (
    <div className='bg-white rounded-2xl ring-1 ring-(--border-default)'>

      {/* Tab Bar */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Itinerary view"
        className="flex gap-2 overflow-x-auto px-3.5 py-2.5 no-scrollbar bg-neutral-200/80 rounded-t-[inherit]"
      >
        {TABS.map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`itinerary-panel-${id}`}
            id={`itinerary-tab-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={(e) => handleTabKeyDown(e, i)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-[0.1em] ring-inset text-[13px] font-medium whitespace-nowrap transition-all duration-150 font-heading',
              activeTab === id
                ? 'bg-brand ring-primary-400 text-white'
                : 'bg-surface ring-(--border-strong)/40 text-secondary shadow-md shadow-neutral-400/35 hover:bg-neutral-50 cursor-pointer'
            )}
          >
            <Icon aria-hidden="true" weight='fill' className={cn("shrink-0 size-4", activeTab === id ? 'text-primary-50' : 'text-muted')} />
            {label}
          </button>
        ))}
      </div>

      {/* Day Accordions */}
      <div role="tabpanel" id={`itinerary-panel-${activeTab}`} aria-labelledby={`itinerary-tab-${activeTab}`}>
        {visibleDays.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Text size="sm" intent="secondary">No {activeTab.toLowerCase()} details available for this package.</Text>
          </div>
        ) : (
          <Accordion key={activeTab} variant="ghost" multiple defaultOpen={visibleDays.map(d => `day-${d.day}-${activeTab}`)}>
            {visibleDays.map(({ day, title, description, sections, notes, attractions }) => (
              <Accordion.Item key={`${day}-${activeTab}`} id={`day-${day}-${activeTab}`} className="mb-2">

                {/* Day Trigger */}
                <div className="px-4">
                  <Accordion.Trigger className="py-3.5 border-b border-(--border-muted) rounded-none">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="shrink-0 bg-brand px-3 py-1 rounded-pill">
                        <Text intent='inverse' size='xs' weight='semibold' className='font-heading'>
                          Day {day}
                        </Text>
                      </span>
                      <Text as='span' intent='primary' weight='semibold' size='base' truncate={true} className='font-heading'>
                        {title}
                      </Text>
                    </div>
                    <Accordion.Chevron className="size-5 text-neutral-400 shrink-0" />
                  </Accordion.Trigger>
                </div>

                {/* Day Content */}
                <Accordion.Content className="px-4 pb-2 pt-0">

                  {/* Top notes */}
                  {notes && notes.length > 0 && (
                    <div className="pt-3">
                      <NoteBlock notes={notes} position="top" />
                    </div>
                  )}

                  {activeTab === 'Plan' && description && (
                    <Text size='sm' intent='secondary' className="py-3 border-b border-(--border-muted)">
                      {description}
                    </Text>
                  )}

                  {/* Attraction stories — below description */}
                  {activeTab === 'Plan' && attractions && attractions.length > 0 && (
                    <AttractionStories
                      items={attractions}
                      className="pt-3 pb-3 border-b border-(--border-muted)"
                    />
                  )}

                  <div className="flex flex-col divide-y divide-(--border-muted)">
                    {sections.map((section, i) => (
                      <div key={i} className="py-5">
                        <DaySectionBlock section={section} id={`day-${day}-${activeTab}-sec-${i}`} day={day} />
                      </div>
                    ))}
                  </div>

                  {/* Bottom notes */}
                  {notes && notes.length > 0 && (
                    <div className="pb-2">
                      <NoteBlock notes={notes} position="bottom" />
                    </div>
                  )}

                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </div>

    </div>
  );
}
