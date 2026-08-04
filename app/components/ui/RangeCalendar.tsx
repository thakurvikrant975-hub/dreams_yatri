'use client'

import { useState } from 'react'
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { cn } from '@/app/lib/utils'

/**
 * The two-month range calendar body, without any trigger of its own.
 *
 * Extracted so the single-field picker (DateRangePickerField) and the paired
 * check-in/check-out fields (CheckInOutField) render the identical calendar
 * from one implementation — the two differ only in what they show above it and
 * in how a click maps onto the range, which stays with the parent via `onPick`.
 *
 * The calendar owns only presentational state: which month is in view and which
 * day is hovered. The range itself lives with the caller.
 */

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Date helpers (no external lib) ───────────────────────────────────────────
export function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
export function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
export function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export type DateRangeValue = { from: Date | undefined; to: Date | undefined }

// ── Single month grid ────────────────────────────────────────────────────────
function MonthGrid({
    month, value, min, hoverDate, onHover, onPick,
}: {
    month: Date
    value: DateRangeValue
    min: Date
    hoverDate: Date | null
    onHover: (d: Date | null) => void
    onPick: (d: Date) => void
}) {
    const year = month.getFullYear()
    const m = month.getMonth()
    const firstWeekday = new Date(year, m, 1).getDay()
    const daysInMonth = new Date(year, m + 1, 0).getDate()

    const cells: (Date | null)[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d))

    // While only `from` is picked, preview the range up to the hovered day.
    const previewTo = value.from && !value.to ? hoverDate : null

    return (
        <div className="w-full">
            <p className="text-center text-sm font-semibold text-neutral-800 mb-3 font-heading">
                {MONTHS[m]} {year}
            </p>
            <div className="grid grid-cols-7 gap-y-1">
                {WEEKDAYS.map((w) => (
                    <span key={w} className="text-center text-[11px] font-medium text-neutral-400 pb-1">{w}</span>
                ))}
                {cells.map((c, i) => {
                    if (!c) return <span key={`e-${i}`} />
                    const disabled = c < min
                    const isStart = value.from ? isSameDay(c, value.from) : false
                    const isEnd = value.to ? isSameDay(c, value.to) : false
                    const rangeEnd = value.to ?? previewTo ?? undefined
                    const inRange = value.from && rangeEnd && c > value.from && c < rangeEnd
                    const isEdge = isStart || isEnd
                    return (
                        <button
                            key={c.toISOString()}
                            type="button"
                            disabled={disabled}
                            onClick={() => onPick(c)}
                            onMouseEnter={() => onHover(c)}
                            className={cn(
                                'relative mx-auto flex size-9 items-center justify-center text-sm transition-colors',
                                disabled && 'text-neutral-300 cursor-not-allowed',
                                !disabled && isEdge && 'z-10 rounded-lg bg-primary-500 text-white font-semibold shadow-md shadow-primary-300/40',
                                !disabled && !isEdge && inRange && 'rounded-none bg-primary-50 text-primary-700',
                                !disabled && !isEdge && !inRange && 'rounded-lg text-neutral-700 hover:bg-neutral-100 cursor-pointer',
                            )}
                        >
                            {c.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ── Calendar body ────────────────────────────────────────────────────────────
export default function RangeCalendar({
    value, min, onPick, footer,
}: {
    value: DateRangeValue
    /** Earliest selectable day, already normalised to start-of-day. */
    min: Date
    onPick: (d: Date) => void
    footer?: React.ReactNode
}) {
    const minMonth = startOfMonth(min)
    const [view, setView] = useState<Date>(() => startOfMonth(value.from ?? min))
    const [hoverDate, setHoverDate] = useState<Date | null>(null)

    const canGoPrev = view > minMonth

    return (
        <div className="relative" onMouseLeave={() => setHoverDate(null)}>
            {/* Prev / Next */}
            <button
                type="button"
                onClick={() => canGoPrev && setView((v) => addMonths(v, -1))}
                disabled={!canGoPrev}
                aria-label="Previous month"
                className={cn(
                    'absolute left-0 top-0 flex size-8 items-center justify-center rounded-full transition-colors',
                    canGoPrev ? 'text-primary-500 hover:bg-primary-50 cursor-pointer' : 'text-neutral-300 cursor-not-allowed',
                )}
            >
                <CaretLeftIcon weight="bold" className="size-4.5" />
            </button>
            <button
                type="button"
                onClick={() => setView((v) => addMonths(v, 1))}
                aria-label="Next month"
                className="absolute right-0 top-0 flex size-8 items-center justify-center rounded-full text-primary-500 hover:bg-primary-50 transition-colors cursor-pointer"
            >
                <CaretRightIcon weight="bold" className="size-4.5" />
            </button>

            {/* One month on mobile, two side-by-side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-9">
                <MonthGrid month={view} value={value} min={min} hoverDate={hoverDate} onHover={setHoverDate} onPick={onPick} />
                <div className="hidden md:block">
                    <MonthGrid month={addMonths(view, 1)} value={value} min={min} hoverDate={hoverDate} onHover={setHoverDate} onPick={onPick} />
                </div>
            </div>

            {footer}
        </div>
    )
}
