// ItinerarySection.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ImageLightbox from './ImageLightbox';
import { cn } from '@/app/lib/utils';
import Accordion from '@/app/components/ui/Accordian';
import { Heading, Text } from '@/app/components/ui/Typography';
import {
  CheckIcon,
  MoonIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
  BuildingOffice2Icon,
  CalendarDateRangeIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CameraIcon,
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
  SealWarningIcon,
  NotePencilIcon,
  RoadHorizonIcon,
  BusIcon,
  TrainSimpleIcon,
  BankIcon,
  WavesIcon,
  TreeIcon,
  BinocularsIcon,
  BuildingsIcon,
} from '@phosphor-icons/react';
import { CheckInIcon, CheckOutIcon } from '@/app/components/icons/cusomIcon';
import Image from 'next/image';
import { Carousel } from '@/app/components/ui/Carousel';

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
  nights: number;
  hotelName: string;
  stayType: string | null;
  checkIn: string;
  checkOut: string;
  address: string | null;
  inclusions: { label: string; status: InclusionStatus }[];
  images: string[];
  roomName: string | null;
  roomCapacity: number | null;
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

export type DaySection = FlightSection | CabSection | StaySection | ActivitySection | FoodSection;

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
  attractions?: { imageUrl: string; caption: string }[];
}

interface ItineraryProps {
  days: ItineraryDay[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TABS = [
  { id: 'Plan', label: 'Plan', icon: CalendarDateRangeIcon },
  { id: 'Transfer', label: 'Transfer', icon: CarIcon },
  { id: 'Hotels', label: 'Hotels', icon: BuildingOffice2Icon },
  { id: 'Activity', label: 'Activity', icon: ParachuteIcon },
] as const;

type Tab = typeof TABS[number]['id'];

const TAB_SECTION_TYPE: Partial<Record<Tab, DaySection['type']>> = {
  Transfer: 'cab',
  Hotels: 'stay',
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

// ─── Location icon inference (uses DB LocationType enum) ─────────────────────
// Returns null for generic/administrative types — no extra icon shown for those.

function getLocationIcon(locationType: string | null | undefined): React.ElementType | null {
  switch (locationType) {
    case 'AIRPORT': return AirplaneTiltIcon;
    case 'BUS_STATION': return BusIcon;
    case 'TRAIN_STATION': return TrainSimpleIcon;
    case 'HOTEL': return BedIcon;
    case 'BEACH': return WavesIcon;
    case 'MOUNTAIN': return BinocularsIcon;
    case 'LANDMARK': return BankIcon;
    case 'ACTIVITY': return ParachuteIcon;
    case 'PORT': return WavesIcon;
    case 'ISLAND': return WavesIcon;
    case 'TOURISM_ZONE': return TreeIcon;
    default: return BuildingsIcon; // CITY, AREA, ROUTE_STOP, VILLAGE, etc.
  }
}

// ─── Cab Route Display ────────────────────────────────────────────────────────

function CabRoute({
  from,
  to,
  distance_km,
  fromLocationType,
  toLocationType,
}: {
  from: string;
  to: string;
  distance_km?: number | null;
  fromLocationType?: string | null;
  toLocationType?: string | null;
}) {
  const FromIcon = getLocationIcon(fromLocationType);
  const ToIcon = getLocationIcon(toLocationType);

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
              {FromIcon && <FromIcon weight="duotone" className="size-7 shrink-0" />}
              <Text size="sm" intent="primary" weight="semibold" className="font-heading">{from}</Text>
            </div>
          </div>
        </div>
      </div>

      <div className="h-9 w-full flex items-stretch">
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
              {ToIcon && <ToIcon weight="duotone" className="size-7 shrink-0" />}
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
            {stop.notePill && (
              <div className={cn(
                'mt-1.5 rounded-b-2xl px-3.5 py-2.5 text-[12.5px] ',
                stop.notePill.linkVariant === 'brand'
                  ? 'bg-primary-50 text-primary' :
                  stop.notePill.linkVariant === 'error'
                    ? 'bg-error-50 text-error-600' :
                    stop.notePill.linkVariant === 'success'
                      ? 'bg-success-50 text-success-600' :
                      stop.notePill.linkVariant === 'warning'
                        ? 'bg-warning-50 text-warning-600' :
                        stop.notePill.linkVariant === 'info'
                          ? 'bg-info-50 text-info-600'
                          : 'bg-neutral-50  text-secondary'
              )}>
                {stop.notePill.text}{' '}
                {stop.notePill.linkText && (
                  <span className={cn(
                    'font-semibold cursor-pointer',
                    stop.notePill.linkVariant === 'brand'
                      ? 'text-brand' :
                      stop.notePill.linkVariant === 'error'
                        ? 'text-error-600' :
                        stop.notePill.linkVariant === 'success'
                          ? 'text-success-600' :
                          stop.notePill.linkVariant === 'warning'
                            ? 'text-warning-600' :
                            stop.notePill.linkVariant === 'info'
                              ? 'text-info-600' :
                              stop.notePill.linkVariant === 'neutral'
                                ? 'text-primary'
                                : 'text-brand'
                  )}>
                    {stop.notePill.linkText}
                  </span>
                )}
              </div>
            )}
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
        {stop.notePill && (
          <div className={cn(
            'mt-1.5 rounded-lg px-3 py-2 text-[12.5px] border ',
            stop.notePill.linkVariant === 'brand'
              ? 'bg-primary-50 border-primary-100 text-primary'
              : 'bg-error-50 border-error-100 text-primary'
          )}>
            {stop.notePill.text}{' '}
            {stop.notePill.linkText && (
              <span className={cn(
                'font-semibold cursor-pointer',
                stop.notePill.linkVariant === 'brand'
                  ? 'text-brand'
                  : 'text-error-500'
              )}>
                {stop.notePill.linkText}
              </span>
            )}
          </div>
        )}
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
        <Icon weight='duotone' className="size-7 duo_icons shrink-0" />
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

function CabContent({ section }: { section: CabSection }) {
  const hasVehicleInfo = section.vehicle_name || section.vehicle_type || section.vehicle_capacity;

  return (
    <div className="mt-2 flex">
      <div className="w-10 shrink-0" />
      <div className="flex-1 flex gap-3">

        <div className='flex-1'>
          {/* Vehicle details pill */}
          {hasVehicleInfo && (
            <div className="flex items-center gap-2.5  mb-3">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {section.vehicle_name && (
                  <Text size="base" weight="semibold" intent="primary" className="font-heading">
                    {section.vehicle_name}
                  </Text>
                )}
                {section.vehicle_type && (
                  <>
                    <span className="text-muted text-sm">·</span>
                    <Text size="sm" intent="secondary">{section.vehicle_type}</Text>
                  </>
                )}
                {section.vehicle_capacity && (
                  <>
                    <span className="text-muted text-sm">·</span>
                    <Text size="sm" intent="secondary">{section.vehicle_capacity} Seats</Text>
                  </>
                )}
                {section.num_vehicles && section.num_vehicles > 1 && (
                  <>
                    <span className="text-muted text-sm">·</span>
                    <Text size="sm" intent="secondary">×{section.num_vehicles} Vehicles</Text>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Route: pickup → drop */}
          <CabRoute
            from={section.from.value}
            to={section.to.value}
            distance_km={section.distance_km}
            fromLocationType={section.from.locationType}
            toLocationType={section.to.locationType}
          />

          {/* Transfer-level note */}
          {section.transfer_notes && (
            <div className="flex items-start gap-2.5 bg-warning-50 border border-warning-200 rounded-xl px-3.5 py-2.5">
              <ExclamationTriangleIcon className="size-4 text-warning-500 shrink-0 mt-0.5" />
              <Text size="xs" className="text-warning-800">{section.transfer_notes}</Text>
            </div>
          )}
        </div>

        {/* Vehicle image */}
        {(section.vehicle_image || section.vehicle_name) && (
          <div className="relative h-36 aspect-video shrink-0 rounded-2xl overflow-hidden bg-neutral-100">
            <img
              src={section.vehicle_image || CAB_PLACEHOLDER}
              alt={section.vehicle_name ?? "Vehicle"}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
            {!section.vehicle_image && (
              <span className="absolute top-2 right-2 text-[9px] text-white/50 font-medium tracking-wide bg-black/30 rounded px-1 py-0.5">
                placeholder
              </span>
            )}
            {section.vehicle_name && (
              <span className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white drop-shadow-sm leading-tight line-clamp-2">
                {section.vehicle_name}
              </span>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function MealBadge({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const icon =
    lower.includes('breakfast') ? <CoffeeIcon weight="duotone" className="size-3.5 shrink-0" />
      : lower.includes('lunch') ? <BowlSteamIcon weight="duotone" className="size-3.5 shrink-0" />
        : lower.includes('dinner') ? <CheersIcon weight="duotone" className="size-3.5 shrink-0" />
          : <ForkKnifeIcon weight="duotone" className="size-3.5 shrink-0" />;
  return (
    <span className="inline-flex items-center gap-1 bg-success-50 text-success-700 ring-1 ring-inset ring-success-200 rounded-full px-2 py-0.5 text-[11px] font-semibold">
      {icon}{name}
    </span>
  );
}

function parseMealTypes(mealType: string | null, planName: string | null): string[] {
  const source = mealType ?? planName ?? '';
  if (!source) return [];
  const lower = source.toLowerCase();
  // Named plan codes → expand to individual meal names
  if (lower === 'ap' || lower === 'full board') return ['Breakfast', 'Lunch', 'Dinner'];
  if (lower === 'map' || lower === 'half board') return ['Breakfast', 'Dinner'];
  if (lower === 'cp' || lower === 'bb' || lower === 'bed & breakfast') return ['Breakfast'];
  if (lower === 'ep' || lower === 'room only') return [];
  // Free-text: split by comma/plus and trim
  return source.split(/[,+&]/).map(s => s.trim()).filter(Boolean);
}

/** Parses "N Star" and renders N filled yellow stars (+ grey empties up to 5). */
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
  const meals = section.activeMeals.length > 0
    ? section.activeMeals
    : parseMealTypes(section.mealType, section.planName);

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const closeLightbox  = useCallback(() => setLightboxIdx(null), []);
  const navigateLightbox = useCallback((i: number) => setLightboxIdx(i), []);

  const lightboxImgs = section.images.map((src, i) => ({
    src,
    label: i === 0 ? section.hotelName : (section.roomName ?? section.hotelName),
  }));

  return (
    <div className="mt-2 flex">
      <div className="w-10 shrink-0" />
      <div className="flex-1 space-y-3">

        {/* Hotel name + stars */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <Text size="base" weight="semibold" className="font-heading text-primary leading-tight relative">
              {section.hotelName}
              {section.stayType && (
                <span className="absolute top-0 left-full translate-x-2 -translate-y-0.5">
                  <HotelStars stayType={section.stayType} />
                </span>
              )}
            </Text>

          </div>
          {section.address && (
            <div className="flex items-start gap-1.5 mt-0.5">
              <MapPinIcon weight="duotone" className="size-3.5 text-muted shrink-0 mt-0.5" />
              <Text size="xs" intent="secondary" className="leading-snug">{section.address}</Text>
            </div>
          )}
        </div>

        <div className="flex gap-5">
          <div className="flex-1 flex flex-col gap-1">
            {/* Room details card */}
            <div className=" rounded-xl  flex flex-col gap-2">
              {/* Room name + capacity */}
              <div className="flex items-center gap-4">
                {section.roomName && (
                  <Text size="sm" weight="semibold" intent="primary">{section.roomName}</Text>
                )}
                {section.roomCapacity && (
                  <div className="flex items-center gap-1 text-muted">
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                    <Text size="xs" intent="secondary">Up to {section.roomCapacity} guests</Text>
                  </div>
                )}
              </div>


            </div>

            {/* Check-in / Check-out timeline */}
            <div className="flex mt-2">
              <div className="w-full border-l-[0.2em] border-l-(--border-default) flex-1 flex flex-row items-center gap-3.5">
                <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-12 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
                  <div className="flex items-center gap-3">
                    <div className="size-9 flex items-center justify-center ml-3 shrink-0">
                      <span className="text-muted size-7 scale-110"><CheckInIcon /></span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-full mt-0.5">
                      <Text size="xs" intent="primary" className="w-max font-heading shrink-0">Check In:</Text>
                      <Text size="sm" intent="primary" weight="semibold" className="font-heading">{section.checkIn}</Text>
                    </div>
                  </div>
                </div>

                <div className=" flex-1 flex items-stretch">
                  {/* <div className="w-full" /> */}
                  <div className="h-full w-full flex-1  px-3 flex items-center gap-0.5 relative ">
                    <div className="w-full border-b-[0.2em] border-b-(--border-default) border-dashed"></div>

                    <div className=" flex gap-1 px-3 bg-neutral-50 ring-1 ring-inset py-1 ring-neutral-300 rounded-md">
                      <Text as="span" size="sm" weight="medium" intent="secondary">
                        {section.nights}N
                      </Text>
                      <StarAndCrescentIcon weight="duotone" className="size-5 text-muted ml-2 -rotate-20" />
                    </div>

                    <div className="w-full border-b-[0.2em] border-b-(--border-default) border-dashed"></div>
                  </div>
                </div>

                <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-12 after:right-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
                  <div className="flex flex-row-reverse items-center gap-3">
                    <div className="size-9 flex items-center justify-center  shrink-0 mr-5">
                      <span className="text-muted size-7 scale-110"><CheckOutIcon /></span>
                    </div>
                    <div className="flex flex-col items-center gap-1 w-full ">
                      <Text size="xs" intent="primary" className="w-max font-heading shrink-0">Check Out:</Text>
                      <Text size="sm" intent="primary" weight="semibold" className="font-heading">{section.checkOut}</Text>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* Meal badges */}
          {meals.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {meals.map((m) => <MealBadge key={m} name={m} />)}
            </div>
          )}

          </div>

          {/* Image grid — clickable, opens lightbox */}
          {section.images.length > 0 && (
            <>
              <div className="grid grid-cols-4 grid-rows-4 gap-0.5 rounded-2xl overflow-hidden h-52 cursor-pointer">
                {section.images.slice(0, 5).map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    onClick={() => setLightboxIdx(i)}
                    className={cn(
                      'w-full h-full object-cover transition-opacity hover:opacity-90',
                      i === 0 && 'row-span-3 col-span-4',
                    )}
                  />
                ))}
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
            </>
          )}
        </div>



      </div>
    </div>
  );
}

function ActivityContent({ section }: { section: ActivitySection }) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);
  const hasPricing = section.pricingTiers && section.pricingTiers.length > 0;

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const closeLightbox    = useCallback(() => setLightboxIdx(null), []);
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
                <div
                  className="relative rounded-xl overflow-hidden cursor-pointer"
                  onClick={() => setLightboxIdx(idx)}
                >
                  <Image src={src} alt={label} width={1000} height={600} className="w-full aspect-5/3 object-cover hover:scale-[1.03] transition-transform duration-300" />
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-neutral-900/80 via-neutral-900/60 to-transparent px-2 py-1.5 pt-3">
                    <p className="text-sm text-white font-medium truncate">{label}</p>
                  </div>
                </div>
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

// ─── Attraction Stories ───────────────────────────────────────────────────────

function AttractionStories({
  items,
  className,
}: {
  items: { imageUrl: string; caption: string }[];
  className?: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  // Keyboard navigation + scroll lock while lightbox is open
  useEffect(() => {
    if (activeIdx === null) return;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveIdx(null);
      if (e.key === 'ArrowRight') setActiveIdx(i => (i !== null && i < items.length - 1 ? i + 1 : i));
      if (e.key === 'ArrowLeft') setActiveIdx(i => (i !== null && i > 0 ? i - 1 : i));
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
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
            className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
          >
            {/* Gradient ring — Instagram-style */}
            <div className="p-[2.5px] rounded-full bg-linear-to-tr from-yellow-400 via-red-500 to-violet-600 group-active:scale-95 transition-transform duration-150 shadow-sm">
              <div className="p-0.5 rounded-full bg-white ">
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

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      {active !== null && activeIdx !== null && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={() => setActiveIdx(null)}
        >
          {/* Center panel — stops propagation so clicks inside don't close */}
          <div
            className="relative flex flex-col items-center px-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Image — browser keeps natural aspect ratio */}
            <img
              src={active.imageUrl}
              alt={active.caption || ''}
              className="max-w-[90vw] max-h-[78vh] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
            />

            {/* Caption */}
            {active.caption && (
              <p className="mt-3 text-sm text-white/80 text-center max-w-[80vw] leading-snug">
                {active.caption}
              </p>
            )}

            {/* Dot indicators */}
            {items.length > 1 && (
              <div className="flex items-center gap-1.5 mt-3">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
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

          {/* Close button */}
          <button
            type="button"
            onClick={() => setActiveIdx(null)}
            className="absolute top-4 right-4 size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <XMarkIcon className="size-5" />
          </button>

          {/* Prev arrow */}
          {activeIdx > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setActiveIdx(activeIdx - 1); }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          {/* Next arrow */}
          {activeIdx < items.length - 1 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setActiveIdx(activeIdx + 1); }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}

          {/* Counter badge */}
          {items.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] text-white/50 tabular-nums">
              {activeIdx + 1} / {items.length}
            </div>
          )}
        </div>
      )}
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
};

function DaySectionBlock({ section, id }: { section: DaySection; id: string }) {
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
          {config.content(section)}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ItinerarySection({ days }: ItineraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Plan');

  const sectionType = TAB_SECTION_TYPE[activeTab];
  const visibleDays = sectionType
    ? days
      .map(d => ({ ...d, sections: d.sections.filter(s => s.type === sectionType) }))
      .filter(d => d.sections.length > 0)
    : days;

  return (
    <div className='bg-white rounded-2xl ring-1 ring-(--border-default)'>

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto px-3.5 py-2.5 no-scrollbar bg-neutral-200/80 rounded-t-[inherit]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-[0.1em] ring-inset text-[13px] font-medium whitespace-nowrap transition-all duration-150 font-heading',
              activeTab === id
                ? 'bg-brand ring-primary-400 text-white'
                : 'bg-surface ring-(--border-strong)/40 text-secondary shadow-md shadow-neutral-400/35 hover:bg-neutral-50 cursor-pointer'
            )}
          >
            <Icon weight='fill' className={cn("shrink-0 size-4", activeTab === id ? 'text-primary-50' : 'text-muted')} />
            {label}
          </button>
        ))}
      </div>

      {/* Day Accordions */}
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
                      <DaySectionBlock section={section} id={`day-${day}-${activeTab}-sec-${i}`} />
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
  );
}
