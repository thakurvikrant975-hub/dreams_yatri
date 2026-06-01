'use client'

import { useState } from 'react'
import { Popover } from 'radix-ui'
import {
    CalendarBlankIcon,
    CaretLeftIcon,
    CaretRightIcon,
    CaretDownIcon,
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

// ── Single month grid ────────────────────────────────────────────────────────
function MonthGrid({
    month, value, min, onPick,
}: {
    month: Date
    value: Date | null
    min: Date
    onPick: (d: Date) => void
}) {
    const year = month.getFullYear()
    const m = month.getMonth()
    const firstWeekday = new Date(year, m, 1).getDay()
    const daysInMonth = new Date(year, m + 1, 0).getDate()

    const cells: (Date | null)[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d))

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
                    const selected = value ? isSameDay(c, value) : false
                    return (
                        <button
                            key={c.toISOString()}
                            type="button"
                            disabled={disabled}
                            onClick={() => onPick(c)}
                            className={cn(
                                'mx-auto flex size-9 items-center justify-center rounded-lg text-sm transition-colors',
                                disabled && 'text-neutral-300 cursor-not-allowed',
                                !disabled && selected && 'bg-red-500 text-white font-semibold shadow-md shadow-red-300/40',
                                !disabled && !selected && 'text-neutral-700 hover:bg-neutral-100 cursor-pointer',
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
interface DatePickerFieldProps {
    value: Date | null
    onChange: (d: Date | null) => void
    placeholder?: string
    /** Earliest selectable date (defaults to today — no past dates) */
    minDate?: Date
    id?: string
    disabled?: boolean
    className?: string
    /** z-index utility for the calendar popover (default z-100) */
    menuZClass?: string
}

export default function DatePickerField({
    value,
    onChange,
    placeholder = 'Select date',
    minDate,
    id,
    disabled,
    className,
    menuZClass = 'z-100',
}: DatePickerFieldProps) {
    const today = startOfDay(new Date())
    const min = minDate ? startOfDay(minDate) : today
    const minMonth = startOfMonth(min)

    const [open, setOpen] = useState(false)
    const [view, setView] = useState<Date>(() => startOfMonth(value ?? today))

    const canGoPrev = view > minMonth
    const formatted = value
        ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(value)
        : ''

    function pick(d: Date) {
        onChange(d)
        setOpen(false)
    }

    return (
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
                        'focus:outline-none focus:border-red-400 focus:ring-[0.12em] focus:ring-red-100',
                        open && 'border-red-400 ring-[0.12em] ring-red-100',
                        disabled && 'pointer-events-none opacity-50',
                        className,
                    )}
                >
                    <CalendarBlankIcon weight="duotone" className="mr-2 size-4 shrink-0 text-red-500" />
                    {value ? (
                        <span className="flex-1 truncate text-sm text-neutral-800">{formatted}</span>
                    ) : (
                        <span className="flex-1 truncate text-sm text-neutral-400">{placeholder}</span>
                    )}
                    <CaretDownIcon className={cn('ml-2 size-4 shrink-0 text-neutral-400 transition-transform', open && 'rotate-180')} />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
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
                                canGoPrev ? 'text-red-500 hover:bg-red-50 cursor-pointer' : 'text-neutral-300 cursor-not-allowed',
                            )}
                        >
                            <CaretLeftIcon weight="bold" className="size-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setView((v) => addMonths(v, 1))}
                            aria-label="Next month"
                            className="absolute right-0 top-0 flex size-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                            <CaretRightIcon weight="bold" className="size-4" />
                        </button>

                        {/* One month on mobile, two side-by-side on desktop */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-9">
                            <MonthGrid month={view} value={value} min={min} onPick={pick} />
                            <div className="hidden md:block">
                                <MonthGrid month={addMonths(view, 1)} value={value} min={min} onPick={pick} />
                            </div>
                        </div>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
