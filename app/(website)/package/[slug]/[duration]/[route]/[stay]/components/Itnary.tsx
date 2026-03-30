// ItinerarySection.tsx
'use client';

import { useState } from 'react';
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
  XMarkIcon
} from '@heroicons/react/24/solid';
import {
  CarIcon,
  BedIcon,
  ClockIcon,
  ForkKnifeIcon,
  ParachuteIcon,
  AirplaneTiltIcon,
  MapPinIcon,
  StarAndCrescentIcon,
  CoffeeIcon,
  BowlSteamIcon,
  CheersIcon
} from '@phosphor-icons/react';
import { div } from 'motion/react-client';
import { CheckInIcon, CheckOutIcon } from '@/app/components/icons/cusomIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner';
type InclusionStatus = 'included' | 'excluded';
type NoteVariant = 'error' | 'success' | 'brand' | 'neutral' | 'warning' | 'info';

interface RouteStop {
  label: string;
  value: string;
  note?: string;
  noteVariant?: NoteVariant;
  notePill?: {
    text: string;
    linkText?: string;
    linkVariant?: 'error' | 'success' | 'brand' | 'neutral' | 'warning' | 'info';
  };
}

interface FlightSection { type: 'flight'; from: RouteStop; to: RouteStop }
interface CabSection { type: 'cab'; subtitle?: string; from: RouteStop; to: RouteStop }
interface StaySection { type: 'stay'; nights: number; hotelName: string; stars: number; checkIn: string; checkOut: string; inclusions: { label: string; status: InclusionStatus }[]; images: string[] }
interface ActivitySection { type: 'activity'; startTime?: string; duration?: string; name: string; images: { src: string; label: string }[] }
interface FoodSection { type: 'food'; meals: { meal: MealType; restaurant: string; items: string }[] }

export type DaySection = FlightSection | CabSection | StaySection | ActivitySection | FoodSection;

export interface ItineraryDay {
  day: number;
  title: string;
  description?: string | null;
  sections: DaySection[];
}

interface ItineraryProps {
  days: ItineraryDay[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TABS = [
  { id: 'Plan', label: 'Plan', icon: CalendarDateRangeIcon },
  { id: 'Transfer', label: 'Transfer', icon: CarIcon },
  { id: 'Hotels', label: 'Hotels', icon: BuildingOffice2Icon },
  { id: 'Food', label: 'Food', icon: ForkKnifeIcon },
  { id: 'Activity', label: 'Activity', icon: ParachuteIcon },
] as const;

type Tab = typeof TABS[number]['id'];

const noteColorMap: Record<NoteVariant, string> = {
  error: 'text-error-700',
  success: 'text-success-700',
  brand: 'text-brand',
  neutral: 'text-muted',
  warning: 'text-warning-700',
  info: 'text-info-700'
};

const mealLabel: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};


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


// ─── Route Stop ───────────────────────────────────────────────────────────────

function TravelTransfer({
  stopFrom,
  stopTo,
}: {
  stopFrom: RouteStop,
  stopTo: RouteStop
}
) {

  return (
    <div className="flex">
      <div className="w-10">
      </div>
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
    <div className="flex items-center gap-5 w-full">
      <div className="flex items-center gap-2">
        <Icon weight='duotone' className="size-7 duo_icons" />
        <Text size='sm' weight='bold' intent='primary' className="font-heading">{title}</Text>
        {subtitle && (
          <Text size='xs' className=" text-secondary">{subtitle}</Text>
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

function CabContent({ section }: { section: CabSection }) {
  return (
    <div className="mt-3">
      <TravelTransfer stopFrom={section.from} stopTo={section.to} />
    </div>
  );
}

// here
function StayContent({ section }: { section: StaySection }) {
  return (
    <div className="mt-2 space-y-0 flex">
      <div className="w-10 shrink-0" />
      <div className='flex-1'>
        <div className="flex items-start justify-between mb-3">
          <div className='flex gap-3 items-center '>
            <Text size='base' weight='semibold' className=" font-heading text-primary leading-tight">
              {section.hotelName}
            </Text>
            <p className="text-warning-500 text-sm tracking-widest mt-0.5">
              {'★'.repeat(section.stars)}
            </p>
          </div>
        </div>

        {/* Check In + Check Out — same TravelTransfer pattern */}
        <div className="flex">
          <div className="w-full border-l-[0.2em] border-l-(--border-default) flex-1 flex flex-col gap-2 mb-3">

            {/* Check In */}
            <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-8 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
              <div className="flex  gap-3">
                <div className="size-7 flex items-center justify-center ml-3 shrink-0">
                  <span className='text-muted size-7'>
                    <CheckInIcon />
                  </span>
                </div>
                <div className="flex gap-3 w-full mt-0.5">
                  <Text size="sm" intent="primary" className="w-max mb-0.5 font-heading shrink-0">
                    Check In:
                  </Text>
                  <Text size="sm" intent="primary" weight="semibold" className="font-heading">
                    {section.checkIn}
                  </Text>
                </div>
              </div>
            </div>

            <div className="h-8 w-full flex items-stretch">
              <div className="w-18" />
              <div className="h-full flex-1 border-l-[0.2em] border-l-(--border-default) px-3 flex items-center gap-0.5">
                <Text as='span' size="sm" weight='medium' intent='secondary'>
                  {section.nights} Night{section.nights !== 1 ? 's' : ''}
                </Text>
                <StarAndCrescentIcon weight='duotone' className="size-5 text-muted ml-2" />
              </div>
            </div>

            {/* Check Out */}
            <div className="relative after:absolute after:w-[0.2em] after:h-full after:max-h-8 after:left-0 after:top-0 after:bg-primary-400 after:-translate-x-[0.2em]">
              <div className="flex gap-3">
                <div className="size-7 flex items-center justify-center ml-3 shrink-0">
                  <span className='text-muted size-7'>
                    <CheckOutIcon />
                  </span>
                </div>
                <div className="flex gap-3 w-full">
                  <Text size="sm" intent="primary" className="w-max mb-0.5 font-heading shrink-0">
                    Check Out:
                  </Text>
                  <div className="flex-1">
                    <Text size="sm" intent="primary" weight="semibold" className="font-heading">
                      {section.checkOut}
                    </Text>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Inclusions */}
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap bg-neutral-50 ring-1 ring-inset ring-neutral-100 shadow-lg shadow-neutral-200/70 rounded-xl px-3.5 py-2.5 ">
          <Text size="xs" intent="primary" weight="semibold" className="font-heading">
            Inclusion :
          </Text>
          <div className='grid grid-cols-3 flex-1'>
            {section.inclusions.map(({ label, status }) => (
              <div key={label} className="flex items-center gap-2 justify-between border-r border-r-(--border-default) px-3">
                <div className='flex gap-1.5 items-center'>
                  <CoffeeIcon className='text-muted size-6' />
                  <Text size="sm" intent="primary">{label}</Text>
                </div>
                <span className={cn(
                  'size-4 rounded-full flex items-center justify-center shrink-0',
                  status === 'included' ? 'bg-success-100' : 'bg-error-100'
                )}>
                  {status === 'included'
                    ? <CheckIcon className="size-2.5 text-success-600" />
                    : <XMarkIcon className="size-2.5 text-error-500" />}
                </span>
              </div>
            ))}
          </div>

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
      {/* Hotel name + stars */}

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

// ─── Day Section Block ────────────────────────────────────────────────────────

const SECTION_CONFIG: {
  [K in DaySection['type']]: {
    icon: React.ElementType;
    title: string;
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
    title: 'Cab',
    subtitle: (s) => s.subtitle ? `• ${s.subtitle}` : undefined,
    content: (s) => <CabContent section={s} />,
  },
  stay: {
    icon: BedIcon,
    title: 'Stay At',
    subtitle: (s) => `• ${s.nights} days • ${s.hotelName}`,
    content: (s) => <StayContent section={s} />,
  },
  activity: {
    icon: ClockIcon,
    title: 'Activity',
    subtitle: (s) => [
      s.startTime && `• Start At ${s.startTime}`,
      s.duration && `• For ${s.duration}`,
    ].filter(Boolean).join(' ') || undefined,
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
    title: string;
    subtitle?: (s: typeof section) => string | undefined;
    content: (s: typeof section) => React.ReactNode;
  };

  return (
    <Accordion variant="ghost" defaultOpen={[id]}>
      <Accordion.Item id={id}>
        <Accordion.Trigger className="py-2">
          <SectionTrigger
            icon={config.icon}
            title={config.title}
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
            <Icon weight='fill' className={cn("shrink-0 size-4 ", activeTab === id ? 'text-primary-50' : 'text-muted')} />
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
            <Accordion.Trigger className="px-4 py-3.5 border-b border-(--border-muted)">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="shrink-0 bg-brand  px-3 py-1 rounded-pill">
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

            {/* Day Content */}
            <Accordion.Content className="px-4 pb-2 pt-0">
              {description && (
                <Text size='sm' intent='secondary' className="py-3 border-b border-(--border-muted)">
                  {description}
                </Text>
              )}
              <div className="flex flex-col divide-y divide-(--border-muted)">
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