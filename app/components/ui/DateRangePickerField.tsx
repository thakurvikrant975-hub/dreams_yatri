'use client'

import { useState } from 'react'
import { Popover } from 'radix-ui'
import {
    CalendarDotsIcon,
    CaretDownIcon,
    XIcon,
} from '@phosphor-icons/react'
import { cn } from '@/app/lib/utils'
import RangeCalendar, { startOfDay, isSameDay, type DateRangeValue } from './RangeCalendar'

// The calendar body lives in RangeCalendar so this and CheckInOutField render
// the same one. Re-exported because existing callers import the type from here.
export type { DateRangeValue }

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

    const [open, setOpen] = useState(false)

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
                        className={cn(menuZClass, 'w-[min(92vw,640px)] rounded-xl border border-neutral-200 bg-white p-4 shadow-xl shadow-black/10')}
                    >
                        <RangeCalendar
                            value={value}
                            min={min}
                            onPick={pick}
                            footer={value.from && !value.to
                                ? <p className="mt-3 text-center text-xs text-neutral-400">Now pick an end date</p>
                                : null}
                        />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    )
}
