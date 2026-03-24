// PackageHighlights.tsx
'use client';

import { cn } from '@/app/lib/utils';
import { TruckIcon, BuildingOfficeIcon } from '@heroicons/react/24/solid';
import { ForkKnife } from '@phosphor-icons/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CellType = 'checkin' | 'checkout' | 'meal' | 'transfer' | 'custom';

interface DayCell {
    type: CellType;
    text: React.ReactNode;
}

interface HighlightDay {
    day: number;
    date: string;           // e.g. "Apr 5, Sun"
    cells: DayCell[];       // 1 or 2 content cells
}

interface StayBlock {
    destination: string;    // e.g. "Goa"
    nights: number;
    days: HighlightDay[];
}

interface TransferRow {
    label: string;
}

type HighlightItem =
    | { kind: 'transfer'; data: TransferRow }
    | { kind: 'stay'; data: StayBlock };

interface PackageHighlightsProps {
    items: HighlightItem[];
    className?: string;
}

// ─── Cell Icon map ────────────────────────────────────────────────────────────

function CellIcon({ type }: { type: CellType }) {
    const cls = 'size-[18px] text-neutral-500 shrink-0 mt-0.5';
    if (type === 'checkin' || type === 'checkout')
        return <BuildingOfficeIcon className={cls} />;
    if (type === 'meal')
        return <ForkKnife size={18} className={cls} />;
    if (type === 'transfer')
        return <TruckIcon className={cls} />;
    return null;
}

// ─── Transfer Row ─────────────────────────────────────────────────────────────

function TransferItem({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-2.5 py-1.5 px-1">
            <span className="size-2 rounded-full bg-neutral-400 shrink-0" />
            <TruckIcon className="size-4.5 text-neutral-500" />
            <span className="text-[13px] text-secondary font-medium">{label}</span>
        </div>
    );
}

// ─── Day Row ──────────────────────────────────────────────────────────────────

function DayRow({ day }: { day: HighlightDay }) {
    // grid: day-label col + 1 or 2 content cells
    const colsClass = day.cells.length === 2
        ? 'grid-cols-[160px_1fr_1fr]'
        : 'grid-cols-[160px_1fr]';

    return (
        <div className={cn('grid border-t border-neutral-100', colsClass)}>
            {/* Day label */}
            <div className="px-4 py-4 border-r border-neutral-100">
                <p className="text-[14px] font-bold text-primary">Day {day.day}</p>
                <p className="text-[11px] text-muted mt-0.5">{day.date}</p>
            </div>

            {/* Content cells */}
            {day.cells.map((cell, i) => (
                <div
                    key={i}
                    className={cn(
                        'px-4 py-4 flex items-start gap-2.5',
                        i < day.cells.length - 1 && 'border-r border-neutral-100'
                    )}
                >
                    <CellIcon type={cell.type} />
                    <p className="text-[13px] text-secondary leading-relaxed">{cell.text}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Stay Block ───────────────────────────────────────────────────────────────

function StayItem({ data }: { data: StayBlock }) {
    return (
        <div className="border border-neutral-200 rounded-2xl overflow-hidden">
            {/* Header — gradient matching screenshot */}
            <div
                className="px-5 py-4 bg-neutral-200/80"
            >
                <h3 className="text-[18px] font-bold text-primary">
                    {data.destination}{' '}
                    <span className="font-normal text-secondary">
                        - {data.nights} Night{data.nights !== 1 ? 's' : ''} Stay
                    </span>
                </h3>
            </div>

            {/* Day rows */}
            <div className="bg-surface">
                {data.days.map(day => (
                    <DayRow key={day.day} day={day} />
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PackageHighlights({ items, className }: PackageHighlightsProps) {
    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {items.map((item, i) => {
                if (item.kind === 'transfer')
                    return <TransferItem key={i} label={item.data.label} />;
                if (item.kind === 'stay')
                    return <StayItem key={i} data={item.data} />;
                return null;
            })}
        </div>
    );
}