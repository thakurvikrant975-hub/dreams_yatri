// ItinerarySection.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/app/lib/utils';
import Accordion from '@/app/components/ui/Accordian';
import {
  MapPinIcon,
  CheckIcon,
  XCircleIcon,
  MoonIcon,
  ArrowRightEndOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
  BellAlertIcon,
  MapIcon,
  TruckIcon,
  BuildingOffice2Icon,
  BoltIcon,
} from '@heroicons/react/24/solid';
import {
  AirplaneIcon,
  CarIcon,
  BedIcon,
  ClockIcon,
  ForkKnifeIcon,

} from '@phosphor-icons/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner';
type InclusionStatus = 'included' | 'excluded';
type NoteVariant = 'red' | 'green' | 'blue' | 'gray';

interface RouteStop {
  label: string;
  value: string;
  note?: string;
  noteVariant?: NoteVariant;
  notePill?: {
    text: string;
    linkText?: string;
    linkVariant?: 'red' | 'blue';
  };
}

interface FlightSection { type: 'flight'; from: RouteStop; to: RouteStop }
interface CabSection { type: 'cab'; subtitle?: string; from: RouteStop; to: RouteStop }
interface StaySection { type: 'stay'; nights: number; hotelName: string; stars: number; checkIn: string; checkOut: string; inclusions: { label: string; status: InclusionStatus }[]; images: string[] }
interface ActivitySection { type: 'activity'; startTime?: string; duration?: string; name: string; images: { src: string; label: string }[] }
interface FoodSection { type: 'food'; meals: { meal: MealType; restaurant: string; items: string }[] }

type DaySection = FlightSection | CabSection | StaySection | ActivitySection | FoodSection;

interface ItineraryDay {
  day: number;
  title: string;
  description?: string;
  sections: DaySection[];
}

interface ItineraryProps {
  days: ItineraryDay[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'Plan', label: 'Plan', icon: MapIcon },
  { id: 'Transfer', label: 'Transfer', icon: TruckIcon },
  { id: 'Hotels', label: 'Hotels', icon: BuildingOffice2Icon },
  { id: 'Food', label: 'Food', icon: ForkKnifeIcon },
  { id: 'Activity', label: 'Activity', icon: BoltIcon },
] as const;

type Tab = typeof TABS[number]['id'];

const noteColorMap: Record<NoteVariant, string> = {
  red: 'text-error-500',
  green: 'text-success-600',
  blue: 'text-primary-500',
  gray: 'text-muted',
};

const mealLabel: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

// ─── Route Stop ───────────────────────────────────────────────────────────────

function RouteStop({
  stop,
  showLine = true,
}: {
  stop: RouteStop;
  showLine?: boolean;
}) {
  return (
    <div className="flex gap-0">
      {/* Pin + vertical red line */}
      <div className="flex flex-col items-center w-8 shrink-0">
        <div className="size-8 flex items-center justify-center">
          <MapPinIcon className="size-5 text-neutral-300" />
        </div>
        {showLine && (
          <div className="w-0.5 flex-1 min-h-3 bg-primary-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pt-1 pb-3 pl-1">
        <p className="text-[11px] font-semibold text-muted mb-0.5">{stop.label}</p>
        <p className="text-[13px] font-semibold text-primary mb-1">{stop.value}</p>

        {stop.note && (
          <p className={cn('text-[11.5px] font-medium', noteColorMap[stop.noteVariant ?? 'gray'])}>
            {stop.note}
          </p>
        )}

        {stop.notePill && (
          <div className={cn(
            'mt-1.5 rounded-lg px-3 py-2 text-[12.5px] border',
            stop.notePill.linkVariant === 'blue'
              ? 'bg-primary-50 border-primary-100 text-primary'
              : 'bg-error-50 border-error-100 text-primary'
          )}>
            {stop.notePill.text}{' '}
            {stop.notePill.linkText && (
              <span className={cn(
                'font-semibold cursor-pointer',
                stop.notePill.linkVariant === 'blue'
                  ? 'text-primary-500'
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

// ─── Section Header (shared trigger layout) ───────────────────────────────────

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
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-neutral-500" />
        <span className="text-[14px] font-bold text-primary">{title}</span>
        {subtitle && (
          <span className="text-[12px] text-muted">{subtitle}</span>
        )}
      </div>
      <Accordion.Chevron className="size-3.5 text-neutral-400" />
    </div>
  );
}

// ─── Section Renderers ────────────────────────────────────────────────────────

function FlightContent({ section }: { section: FlightSection }) {
  return (
    <div className="mt-3">
      <RouteStop stop={section.from} showLine />
      <RouteStop stop={section.to} showLine={false} />
    </div>
  );
}

function CabContent({ section }: { section: CabSection }) {
  return (
    <div className="mt-3">
      <RouteStop stop={section.from} showLine />
      <RouteStop stop={section.to} showLine={false} />
    </div>
  );
}

function StayContent({ section }: { section: StaySection }) {
  return (
    <div className="mt-2">
      <p className="text-[15px] font-bold text-primary">{section.hotelName}</p>
      <p className="text-warning-400 text-sm tracking-wider mt-0.5 mb-3">
        {'★'.repeat(section.stars)}
      </p>

      {/* Check In */}
      <div className="border-l-[3px] border-primary-500 pl-3 mb-2.5">
        <div className="flex items-center gap-2.5 py-1">
          <ArrowRightEndOnRectangleIcon className="size-5 text-neutral-500 shrink-0" />
          <span className="text-[13px] font-bold text-neutral-600 min-w-[82px]">Check In:</span>
          <span className="text-[13px] font-semibold text-primary">{section.checkIn}</span>
        </div>
        <div className="ml-7 mt-1">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted border border-neutral-200 rounded-lg px-2.5 py-1 bg-neutral-50">
            <MoonIcon className="size-3.5" />
            {section.nights} Nights
          </span>
        </div>
      </div>

      {/* Check Out */}
      <div className="border-l-[3px] border-primary-500 pl-3 mb-3">
        <div className="flex items-center gap-2.5 py-1">
          <ArrowLeftStartOnRectangleIcon className="size-5 text-neutral-500 shrink-0" />
          <span className="text-[13px] font-bold text-neutral-600 min-w-[82px]">Check Out:</span>
          <span className="text-[13px] font-semibold text-primary">{section.checkOut}</span>
        </div>
      </div>

      {/* Inclusions */}
      <div className="flex items-center gap-3 flex-wrap border border-neutral-200 rounded-xl px-3.5 py-2.5">
        <span className="text-[12px] font-semibold text-muted">Inclusion :</span>
        {section.inclusions.map(({ label, status }) => (
          <div key={label} className="flex items-center gap-1.5 text-[13px] text-primary">
            <BellAlertIcon className="size-3.5 text-neutral-400" />
            {label}
            {status === 'included'
              ? <CheckIcon className="size-4 text-success-500" />
              : <XCircleIcon className="size-4 text-error-500" />}
          </div>
        ))}
      </div>

      {/* Image grid */}
      {section.images.length > 0 && (
        <div className="grid grid-cols-[1.6fr_1fr_1fr] grid-rows-2 gap-0.5 rounded-2xl overflow-hidden mt-3 h-52">
          {section.images.slice(0, 5).map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className={cn('w-full h-full object-cover', i === 0 && 'row-span-2')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityContent({ section }: { section: ActivitySection }) {
  return (
    <div className="mt-2">
      <p className="text-[13px] font-semibold text-primary mb-2">{section.name}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {section.images.map(({ src, label }, i) => (
          <div key={i} className="relative rounded-xl overflow-hidden">
            <img src={src} alt={label} className="w-full h-24 object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-r from-black/60 to-transparent px-2 py-1.5">
              <p className="text-[10px] text-white font-medium">{label}</p>
            </div>
          </div>
        ))}
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
              <ForkKnifeIcon size={12} className="text-primary-500" />
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

// ─── Day Section Block ────────────────────────────────────────────────────────

function DaySectionBlock({ section, id }: { section: DaySection; id: string }) {
  if (section.type === 'flight') return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <SectionTrigger icon={AirplaneIcon} title="Flight" />
        </Accordion.Trigger>
        <Accordion.Content className="px-0 pb-0">
          <FlightContent section={section} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );

  if (section.type === 'cab') return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <SectionTrigger
            icon={CarIcon}
            title="Cab"
            subtitle={section.subtitle ? `• ${section.subtitle}` : undefined}
          />
        </Accordion.Trigger>
        <Accordion.Content className="px-0 pb-0">
          <CabContent section={section} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );

  if (section.type === 'stay') return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <SectionTrigger
            icon={BedIcon}
            title="Stay At"
            subtitle={`• ${section.nights} days • ${section.hotelName}`}
          />
        </Accordion.Trigger>
        <Accordion.Content className="px-0 pb-0">
          <StayContent section={section} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );

  if (section.type === 'activity') return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <SectionTrigger
            icon={ClockIcon}
            title="Activity"
            subtitle={[
              section.startTime && `• Start At ${section.startTime}`,
              section.duration && `• For ${section.duration}`,
            ].filter(Boolean).join(' ')}
          />
        </Accordion.Trigger>
        <Accordion.Content className="px-0 pb-0">
          <ActivityContent section={section} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );

  if (section.type === 'food') return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <SectionTrigger icon={ForkKnifeIcon} title="Food" />
        </Accordion.Trigger>
        <Accordion.Content className="px-0 pb-0">
          <FoodContent section={section} />
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ItinerarySection({ days }: ItineraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Plan');

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
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border-[0.13em] text-[13px] font-medium whitespace-nowrap transition-all duration-150 font-heading',
              activeTab === id
                ? 'bg-primary-500 border-primary-300 text-white'
                : 'bg-surface border-(--border-default) text-secondary shadow-md shadow-neutral-400/35'
            )}
          >
            <Icon weight='fill' className={cn("shrink-0 size-4 ", activeTab === id ? 'text-primary-100' : 'text-muted')} />
            {label}
          </button>
        ))}
      </div>

      {/* Day Accordions */}
      <Accordion variant="ghost" multiple defaultOpen={days.map(d => `day-${d.day}`)}>
        {days.map(({ day, title, description, sections }) => (
          <Accordion.Item
            key={day}
            id={`day-${day}`}
            className=" mb-2"
          >
            {/* Day Trigger */}
            <Accordion.Trigger className="px-4 py-3.5 border-b border-neutral-100">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="shrink-0 bg-primary-500 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                  Day {day}
                </span>
                <span className="text-[15px] font-bold text-primary truncate">
                  {title}
                </span>
              </div>
              <Accordion.Chevron className="size-5 text-neutral-400 shrink-0" />
            </Accordion.Trigger>

            {/* Day Content */}
            <Accordion.Content className="px-4 pb-2 pt-0">
              {description && (
                <p className="text-[13px] text-muted leading-relaxed py-3 border-b border-neutral-100">
                  {description}
                </p>
              )}
              <div className="flex flex-col divide-y divide-neutral-100">
                {sections.map((section, i) => (
                  <div key={i} className="py-1">
                    <DaySectionBlock
                      section={section}
                      id={`day-${day}-sec-${i}`}
                    />
                  </div>
                ))}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>

    </div>
  );
}