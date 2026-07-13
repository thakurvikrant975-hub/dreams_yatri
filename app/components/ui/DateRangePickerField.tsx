'use client'

import { useState } from 'react'
import { Popover } from 'radix-ui'
import {
    CalendarDotsIcon,
    CaretLeftIcon,
    CaretRightIcon,
    CaretDownIcon,
    XIcon,
} from '@phosphor-icons/react'
import { cn } from '@/app/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Date helpers (no external lib) ───────────────────────────────────────────
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
function isSameDay(a: Date, b: Date) {
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

// ── Component ────────────────────────────────────────────────────────────────
interface DateRangePickerFieldProps {
    value: DateRangeValue
    onChange: (range: DateRangeValue) => void
    placeholder?: string
    /** Earliest selectable date (defaults to today — no past dates) */
    minDate?: Date
    id?: string
    disabled?: boolean
    error?: boolean
    className?: string
    triggerClassName?: string
    /** z-index utility for the calendar popover (default z-100) */
    menuZClass?: string
}

export default function DateRangePickerField({
    value,
    onChange,
    placeholder = 'Select start & end date',
    minDate,
    id,
    disabled,
    error,
    className,
    triggerClassName,
    menuZClass = 'z-100',
}: DateRangePickerFieldProps) {
    const today = startOfDay(new Date())
    const min = minDate ? startOfDay(minDate) : today
    const minMonth = startOfMonth(min)

    const [open, setOpen] = useState(false)
    const [view, setView] = useState<Date>(() => startOfMonth(value.from ?? today))
    const [hoverDate, setHoverDate] = useState<Date | null>(null)

    const canGoPrev = view > minMonth

    function pick(d: Date) {
        if (!value.from || value.to || d < value.from) {
            // Starting a fresh range (nothing picked yet, a previous range was
            // already complete, or the click is before the current start).
            onChange({ from: d, to: undefined })
            return
        }
        if (isSameDay(d, value.from)) return // needs a genuinely later day for the end
        onChange({ from: value.from, to: d })
        setOpen(false)
    }

    function clear(e: React.MouseEvent) {
        e.stopPropagation()
        onChange({ from: undefined, to: undefined })
    }

    const fmt = (d: Date) =>
        new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
    const formatted = value.from
        ? value.to
            ? `${fmt(value.from)}  →  ${fmt(value.to)}`
            : `${fmt(value.from)}  →  …`
        : ''

    return (
        <div className={cn('relative', className)}>
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Trigger asChild>
                    <button
                        type="button"
                        id={id}
                        disabled={disabled}
                        aria-haspopup="dialog"
                        aria-expanded={open}
                        className={cn(
                            'flex w-full items-center rounded-input border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors',
                            'focus:outline-none focus:border-primary-400 focus:ring-[0.11em] border-[0.13em] focus:ring-primary-100',
                            open && 'border-primary-400 border-[0.13em] ring-[0.11em] ring-primary-100',
                            error && !open && 'border-red-400',
                            disabled && 'pointer-events-none opacity-50',
                            triggerClassName,
                        )}
                    >
                        <CalendarDotsIcon weight="fill" className="mr-2 size-4.5 shrink-0 text-muted" />
                        {value.from ? (
                            <span className="flex-1 truncate text-sm text-neutral-800">{formatted}</span>
                        ) : (
                            <span className="flex-1 truncate text-sm text-neutral-400">{placeholder}</span>
                        )}
                        {value.from && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={clear}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') clear(e as unknown as React.MouseEvent) }}
                                aria-label="Clear dates"
                                className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                            >
                                <XIcon className="size-3" />
                            </span>
                        )}
                        <CaretDownIcon className={cn('ml-1 size-4 shrink-0 text-neutral-400 transition-transform', open && 'rotate-180')} />
                    </button>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        align="start"
                        sideOffset={6}
                        onMouseLeave={() => setHoverDate(null)}
                        className={cn(menuZClass, 'w-[min(92vw,640px)] rounded-xl border border-neutral-200 bg-white p-4 shadow-xl shadow-black/10')}
                    >
                        <div className="relative">
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
                                <MonthGrid month={view} value={value} min={min} hoverDate={hoverDate} onHover={setHoverDate} onPick={pick} />
                                <div className="hidden md:block">
                                    <MonthGrid month={addMonths(view, 1)} value={value} min={min} hoverDate={hoverDate} onHover={setHoverDate} onPick={pick} />
                                </div>
                            </div>

                            {value.from && !value.to && (
                                <p className="mt-3 text-center text-xs text-neutral-400">Now pick an end date</p>
                            )}
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    )
}
