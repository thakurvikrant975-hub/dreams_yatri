// ItinerarySection.tsx
'use client';

import { useState } from 'react';
import { cn } from '@/app/lib/utils';
import {
  PaperAirplaneIcon,
  TruckIcon,
  HomeIcon,
  ClockIcon,
  ChevronDownIcon,
  CheckIcon,
  XMarkIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/solid';

import { ForkKnifeIcon } from '@phosphor-icons/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner';
type InclusionStatus = 'included' | 'excluded';

interface RouteStop {
  label: string;
  value: string;
  note?: string;
  noteVariant?: 'red' | 'green' | 'blue' | 'gray';
}

interface FlightSection {
  type: 'flight';
  from: RouteStop;
  to: RouteStop;
}

interface CabSection {
  type: 'cab';
  subtitle?: string;
  from: RouteStop;
  to: RouteStop;
}

interface StaySection {
  type: 'stay';
  nights: number;
  hotelName: string;
  stars: number;
  checkIn: string;
  checkOut: string;
  inclusions: { label: string; status: InclusionStatus }[];
  images: string[];
}

interface ActivitySection {
  type: 'activity';
  startTime?: string;
  duration?: string;
  name: string;
  images: { src: string; label: string }[];
}

interface FoodSection {
  type: 'food';
  meals: {
    meal: MealType;
    restaurant: string;
    items: string;
  }[];
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

const noteColor: Record<string, string> = {
  red:  'text-error-500',
  green:'text-success-600',
  blue: 'text-primary-500 cursor-pointer',
  gray: 'text-muted',
};

function RouteBlock({ from, to }: { from: RouteStop; to: RouteStop }) {
  return (
    <div className="border-l-2 border-neutral-200 ml-2 pl-3 mt-2 flex flex-col gap-3">
      {[from, to].map((stop, i) => (
        <div key={i} className="relative">
          <span className="absolute -left-[19px] top-1 size-2 rounded-full bg-neutral-300 border-2 border-neutral-400" />
          <p className="text-[11px] text-muted font-medium mb-0.5">{stop.label}</p>
          <p className="text-[12px] font-medium text-primary">{stop.value}</p>
          {stop.note && (
            <p className={cn('text-[11px] mt-0.5', noteColor[stop.noteVariant ?? 'gray'])}>
              {stop.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  open,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between mb-2"
    >
      <div className="flex items-center gap-1.5">
        <Icon className="size-4 text-muted" />
        <span className="text-[12px] font-semibold text-primary">{title}</span>
        {subtitle && <span className="text-[11px] text-muted">{subtitle}</span>}
      </div>
      <ChevronDownIcon className={cn(
        'size-3.5 text-neutral-400 transition-transform duration-200',
        open && 'rotate-180'
      )} />
    </button>
  );
}

function DaySectionBlock({ section }: { section: DaySection }) {
  const [open, setOpen] = useState(true);

  const header = (icon: React.ElementType, title: string, subtitle?: string) => (
    <SectionHeader icon={icon} title={title} subtitle={subtitle} open={open} onToggle={() => setOpen(o => !o)} />
  );

  if (section.type === 'flight') return (
    <div>
      {header(PaperAirplaneIcon, 'Flight')}
      {open && <RouteBlock from={section.from} to={section.to} />}
    </div>
  );

  if (section.type === 'cab') return (
    <div>
      {header(TruckIcon, 'Cab', section.subtitle ? `• ${section.subtitle}` : undefined)}
      {open && <RouteBlock from={section.from} to={section.to} />}
    </div>
  );

  if (section.type === 'stay') return (
    <div>
      {header(HomeIcon, 'Stay At', `• ${section.nights} days • ${section.hotelName}`)}
      {open && (
        <div>
          <p className="text-[13px] font-semibold text-primary">{section.hotelName}</p>
          <p className="text-warning-400 text-xs tracking-wide mt-0.5">
            {'★'.repeat(section.stars)}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2 mb-3">
            {[
              { label: 'Check In', val: section.checkIn, sub: `${section.nights} Nights 🌙` },
              { label: 'Check Out', val: section.checkOut },
            ].map(({ label, val, sub }) => (
              <div key={label} className="bg-surface-muted border border-neutral-100 rounded-xl p-2.5">
                <p className="text-[10px] text-muted mb-0.5">{label}</p>
                <p className="text-[12px] font-semibold text-primary">{val}</p>
                {sub && <p className="text-[10px] text-error-500 mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mb-2">Inclusion :</p>
          <div className="flex gap-3 flex-wrap mb-3">
            {section.inclusions.map(({ label, status }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-secondary">
                <span className={cn(
                  'size-3.5 rounded-full flex items-center justify-center',
                  status === 'included' ? 'bg-success-100' : 'bg-error-100'
                )}>
                  {status === 'included'
                    ? <CheckIcon className="size-2 text-success-600" />
                    : <XMarkIcon className="size-2 text-error-500" />}
                </span>
                {label}
              </div>
            ))}
          </div>
          {section.images.length > 0 && (
            <div className="grid grid-cols-3 grid-rows-2 gap-1 rounded-xl overflow-hidden h-40">
              {section.images.slice(0, 5).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className={cn(
                    'w-full h-full object-cover',
                    i === 0 && 'row-span-2'
                  )}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (section.type === 'activity') return (
    <div>
      {header(
        ClockIcon,
        'Activity',
        [section.startTime && `• Start At ${section.startTime}`, section.duration && `• For ${section.duration}`]
          .filter(Boolean).join(' ')
      )}
      {open && (
        <div>
          <p className="text-[13px] font-semibold text-primary mb-2">{section.name}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {section.images.map(({ src, label }, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden">
                <img src={src} alt={label} className="w-full h-24 object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white font-medium">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (section.type === 'food') {
    const mealLabel: Record<MealType, string> = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
    };
    return (
      <div>
        {header(ForkKnifeIcon, 'Food')}
        {open && (
          <div className="flex flex-col gap-3">
            {section.meals.map(({ meal, restaurant, items }, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <div className="size-7 rounded-full border-[1.5px] border-primary-400 flex items-center justify-center shrink-0">
                    <ForkKnifeIcon className="size-3 text-primary-500" />
                  </div>
                  {i < section.meals.length - 1 && (
                    <div className="w-px flex-1 mt-1 bg-primary-100" />
                  )}
                </div>
                <div className="pt-1 pb-1">
                  <p className="text-[12px] font-semibold text-primary">
                    {mealLabel[meal]} :{' '}
                    <span className="font-normal text-secondary">{restaurant}</span>
                  </p>
                  <p className="text-[11px] text-muted">{items}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Plan', 'Transfer', 'Hotels', 'Food', 'Activity'] as const;
type Tab = typeof TABS[number];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ItinerarySection({ days }: ItineraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Plan');
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([1, 2]));

  const toggleDay = (day: number) =>
    setOpenDays(prev => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });

  return (
    <div className="flex flex-col gap-3 max-w-lg">

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border-[1.5px] text-xs font-medium whitespace-nowrap transition-all duration-150',
              activeTab === tab
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'bg-surface border-neutral-300 text-secondary hover:border-neutral-400'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Day Accordions */}
      {days.map(({ day, title, description, sections }) => {
        const isOpen = openDays.has(day);
        return (
          <div key={day} className="bg-surface rounded-2xl border border-neutral-200 overflow-hidden">

            {/* Day Header */}
            <button
              type="button"
              onClick={() => toggleDay(day)}
              className="w-full flex items-center justify-between px-4 py-3.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 bg-primary-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  Day {day}
                </span>
                <span className="text-sm font-semibold text-primary truncate text-left">
                  {title}
                </span>
              </div>
              <ChevronDownIcon className={cn(
                'size-4 text-neutral-400 shrink-0 ml-2 transition-transform duration-200',
                isOpen && 'rotate-180'
              )} />
            </button>

            {/* Day Body */}
            {isOpen && (
              <div className="px-4 pb-4 flex flex-col gap-4">
                {description && (
                  <p className="text-[12px] text-muted leading-relaxed">{description}</p>
                )}
                {sections.map((section, i) => (
                  <div key={i}>
                    {i > 0 && <div className="h-px bg-neutral-100 mb-4" />}
                    <DaySectionBlock section={section} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}