'use client'

import { useState } from 'react'
import { Popover } from 'radix-ui'
import { CalendarDotsIcon } from '@phosphor-icons/react'
import { cn } from '@/app/lib/utils'
import RangeCalendar, { startOfDay, type DateRangeValue } from './RangeCalendar'

/**
 * Paired check-in / check-out fields driven by ONE shared range calendar.
 *
 * Two inputs so a guest still reads "check-in" and "check-out" as distinct
 * things, but a single dropdown: clicking either field opens the same calendar,
 * and picking a range fills both. Which field you clicked decides which end of
 * the range the next click sets, and choosing a check-in advances focus to
 * check-out automatically — so the common case is two clicks, no reopening.
 *
 * The pair renders its own two-column grid and takes the caller's label classes,
 * because the two search bars that use it style labels differently (dark hero vs
 * the hotels bar) but lay fields out the same way.
 */

type Focus = 'start' | 'end'

interface CheckInOutFieldProps {
    value: DateRangeValue
    onChange: (v: DateRangeValue) => void
    /** Earliest selectable date (defaults to today — no past dates) */
    minDate?: Date
    startLabel?: string
    endLabel?: string
    placeholder?: string
    /** Caller's label styling, so the pair matches its surrounding form. */
    labelClassName?: string
    /** Wrapper for the pair — lets a parent grid decide how it spans. */
    className?: string
    /** Per-field wrapper, so label→input spacing matches neighbouring fields. */
    fieldClassName?: string
    triggerClassName?: string
    menuZClass?: string
    disabled?: boolean
}

function fmt(d: Date): string {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

/** One of the two triggers. Module-level so it isn't remade on every render. */
function DateField({
    label, date, placeholder, active, onOpen, disabled,
    labelClassName, fieldClassName, triggerClassName,
}: {
    label: string
    date: Date | undefined
    placeholder: string
    active: boolean
    onOpen: () => void
    disabled?: boolean
    labelClassName?: string
    fieldClassName?: string
    triggerClassName?: string
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', fieldClassName)}>
            <label className={labelClassName}>{label}</label>
            <button
                type="button"
                disabled={disabled}
                onClick={onOpen}
                aria-haspopup="dialog"
                aria-expanded={active}
                className={cn(
                    'flex w-full items-center rounded-input border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors',
                    'focus:outline-none focus:border-primary-400 focus:ring-[0.11em] border-[0.13em] focus:ring-primary-100',
                    active && 'border-primary-400 border-[0.13em] ring-[0.11em] ring-primary-100',
                    disabled && 'pointer-events-none opacity-50',
                    triggerClassName,
                )}
            >
                <CalendarDotsIcon weight="fill" className="mr-2 size-4.5 shrink-0 text-muted" />
                <span className={cn('flex-1 truncate text-sm', date ? 'text-neutral-800' : 'text-neutral-400')}>
                    {date ? fmt(date) : placeholder}
                </span>
            </button>
        </div>
    )
}

export default function CheckInOutField({
    value,
    onChange,
    minDate,
    startLabel = 'Check-in',
    endLabel = 'Check-out',
    placeholder = 'Add date',
    labelClassName,
    className,
    fieldClassName,
    triggerClassName,
    menuZClass = 'z-100',
    disabled,
}: CheckInOutFieldProps) {
    const min = minDate ? startOfDay(minDate) : startOfDay(new Date())

    const [open, setOpen] = useState(false)
    const [focus, setFocus] = useState<Focus>('start')

    function openWith(which: Focus) {
        setFocus(which)
        setOpen(true)
    }

    function pick(d: Date) {
        if (focus === 'start') {
            // Keep an existing check-out only if it still sits after the new
            // check-in; otherwise it's stale and the guest picks it next.
            const keptEnd = value.to && value.to > d ? value.to : undefined
            onChange({ from: d, to: keptEnd })
            if (keptEnd) setOpen(false)
            else setFocus('end')
            return
        }

        // Picking the check-out. A day on or before check-in can't end the stay,
        // so treat it as restarting the range from there.
        if (!value.from || d <= value.from) {
            onChange({ from: d, to: undefined })
            setFocus('end')
            return
        }
        onChange({ from: value.from, to: d })
        setOpen(false)
    }

    function clear() {
        onChange({ from: undefined, to: undefined })
        setFocus('start')
    }

    const nights =
        value.from && value.to && value.to > value.from
            ? Math.round((startOfDay(value.to).getTime() - startOfDay(value.from).getTime()) / 86_400_000)
            : 0

    return (
        <Popover.Root
            open={open}
            onOpenChange={(o) => { setOpen(o); if (!o) setFocus('start') }}
        >
            {/* Anchor the single calendar to the pair, not to one field, so it
                stays put when focus moves from check-in to check-out. */}
            <Popover.Anchor asChild>
                <div className={cn('grid grid-cols-2 gap-2.5', className)}>
                    <DateField
                        label={startLabel} date={value.from} placeholder={placeholder}
                        active={open && focus === 'start'} onOpen={() => openWith('start')}
                        disabled={disabled} labelClassName={labelClassName}
                        fieldClassName={fieldClassName} triggerClassName={triggerClassName}
                    />
                    <DateField
                        label={endLabel} date={value.to} placeholder={placeholder}
                        active={open && focus === 'end'} onOpen={() => openWith('end')}
                        disabled={disabled} labelClassName={labelClassName}
                        fieldClassName={fieldClassName} triggerClassName={triggerClassName}
                    />
                </div>
            </Popover.Anchor>

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
                        footer={
                            <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                                <span className="text-xs text-neutral-500">
                                    {focus === 'start' || !value.from
                                        ? 'Select your check-in date'
                                        : !value.to
                                            ? 'Now select your check-out date'
                                            : `${nights} ${nights === 1 ? 'night' : 'nights'}`}
                                </span>
                                {(value.from || value.to) && (
                                    <button
                                        type="button"
                                        onClick={clear}
                                        className="text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        }
                    />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
