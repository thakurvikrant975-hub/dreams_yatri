'use client'

import { useEffect, useRef, useState } from 'react'
import { Popover } from 'radix-ui'
import { MinusIcon, PlusIcon, UsersFourIcon, CaretDownIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { toast } from 'react-toastify'
import Button from './Button'
import { cn } from '@/app/lib/utils'

// A restriction/limit was just hit on a stepper — one consistent, branded
// look for all of them (room/adult/child caps and floors).
function notifyLimit(message: string) {
    toast(message, {
        icon: <WarningCircleIcon weight="fill" className="size-5 text-amber-500" />,
    })
}

// childrenAges holds one entry per child; -1 means "age not yet selected".
// rooms is optional — only meaningful where the caller opts in via showRooms.
export type TravellersValue = { adults: number; childrenAges: number[]; rooms?: number }

const MAX_ADULTS = 20
const MAX_CHILDREN = 10
export const MAX_ROOMS = 8
const CHILD_AGE_MAX = 11 // children = below 12 years

export function summarizeTravellers(v: TravellersValue): string {
    const parts = [`${v.adults} Adult${v.adults > 1 ? 's' : ''}`]
    if (v.childrenAges.length) {
        parts.push(`${v.childrenAges.length} Child${v.childrenAges.length > 1 ? 'ren' : ''}`)
    }
    if (v.rooms) {
        parts.push(`${v.rooms} Room${v.rooms > 1 ? 's' : ''}`)
    }
    return parts.join(', ')
}

// ── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({
    value, min, max, onChange,
}: {
    value: number
    min: number
    max: number
    onChange: (n: number) => void
}) {
    const btn = 'flex size-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer'
    return (
        <div className="flex items-center gap-2.5">
            <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(value - 1)} className={btn}>
                <MinusIcon weight="bold" className="size-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums text-neutral-800">
                {String(value).padStart(2, '0')}
            </span>
            <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(value + 1)} className={btn}>
                <PlusIcon weight="bold" className="size-3.5" />
            </button>
        </div>
    )
}

// ── Component ────────────────────────────────────────────────────────────────
interface TravellersFieldProps {
    value: TravellersValue
    onChange: (v: TravellersValue) => void
    id?: string
    disabled?: boolean
    className?: string
    /** z-index utility for the popover (default z-100) */
    menuZClass?: string
    /** Show a Rooms stepper above Adults — opt in for hotel/package search filters */
    showRooms?: boolean
    /** Upper bound for the Rooms stepper — defaults to MAX_ROOMS. Callers with
     *  a real inventory ceiling (e.g. a package's hotel availability) can pass
     *  a tighter value; the stepper clamps down to it on open. */
    maxRooms?: number
    /** How many people one room currently sleeps (max_occupancy + extra beds).
     *  Drives the Rooms stepper's live lower bound: as Adults/Children grow
     *  past this, a room is auto-added. Defaults to "no constraint". */
    personsPerRoom?: number
}

export default function TravellersField({
    value, onChange, id, disabled, className, menuZClass = 'z-100', showRooms = false, maxRooms = MAX_ROOMS,
    personsPerRoom = Infinity,
}: TravellersFieldProps) {
    const [open, setOpen] = useState(false)

    // Draft edited inside the popover; committed on Apply (mirrors MMT).
    const [adults, setAdults] = useState(value.adults)
    const [childrenAges, setChildrenAges] = useState<number[]>(value.childrenAges)
    const [rooms, setRooms] = useState(value.rooms ?? 1)

    // Sync draft from the committed value whenever the popover opens
    useEffect(() => {
        if (open) {
            setAdults(value.adults)
            setChildrenAges(value.childrenAges)
            setRooms(Math.min(value.rooms ?? 1, maxRooms))
        }
    }, [open, value.adults, value.childrenAges, value.rooms, maxRooms])

    // Lowest room count the party in the draft actually needs right now —
    // recomputes live as Adults/Children are stepped, before Apply.
    const liveMinRooms = showRooms
        ? Math.min(Math.max(1, Math.ceil((adults + childrenAges.length) / personsPerRoom)), maxRooms)
        : 1

    // Auto-add a room the moment the party outgrows the current count; never
    // auto-remove one the traveller picked manually.
    useEffect(() => {
        if (!showRooms) return
        setRooms((r) => Math.min(Math.max(r, liveMinRooms), maxRooms))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveMinRooms, maxRooms, showRooms])

    // A room needs at least one adult in it — 2 rooms can't be booked for a
    // single adult, so raising Rooms (manually or via the floor above) pulls
    // Adults up to match if it's now short.
    useEffect(() => {
        if (!showRooms) return
        setAdults((a) => Math.max(a, rooms))
    }, [rooms, showRooms])

    // Toast whenever a restriction/limit actually moves the numbers — either
    // a direct click hitting a stepper's boundary, or one of the coupling
    // effects above silently adjusting the *other* field. `*ClickRef` marks a
    // change as user-initiated on that field so the "silent" toast doesn't
    // also fire right after the click's own boundary toast.
    const interactedRef = useRef(false)
    const roomsClickRef  = useRef(false)
    const adultsClickRef = useRef(false)
    const prevRoomsRef  = useRef(rooms)
    const prevAdultsRef = useRef(adults)

    useEffect(() => {
        if (interactedRef.current && !roomsClickRef.current && rooms > prevRoomsRef.current) {
            notifyLimit(`Room count increased to ${rooms} for ${adults + childrenAges.length} travellers`)
        }
        prevRoomsRef.current = rooms
        roomsClickRef.current = false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms])

    useEffect(() => {
        if (interactedRef.current && !adultsClickRef.current && adults > prevAdultsRef.current) {
            notifyLimit(`Adult count increased to ${adults} — each room needs at least one adult`)
        }
        prevAdultsRef.current = adults
        adultsClickRef.current = false
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adults])

    function setChildrenCount(next: number) {
        setChildrenAges((prev) => {
            if (next > prev.length) return [...prev, ...Array(next - prev.length).fill(-1)]
            return prev.slice(0, next)
        })
    }

    function setChildAge(idx: number, age: number) {
        setChildrenAges((prev) => prev.map((a, i) => (i === idx ? age : a)))
    }

    const hasUnsetAge = childrenAges.some((a) => a < 0)

    function apply() {
        if (hasUnsetAge) return
        onChange(showRooms ? { adults, childrenAges, rooms } : { adults, childrenAges, rooms: value.rooms })
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
                        'focus:outline-none focus:border-primary-400 border-[0.13em] focus:ring-[0.11em] focus:ring-primary-100',
                        open && 'border-primary-400 border-[0.13em] ring-[0.11em] ring-primary-100',
                        disabled && 'pointer-events-none opacity-50',
                        className,
                    )}
                >
                    <UsersFourIcon weight="fill" className="mr-2 size-4.5 shrink-0 text-muted" />
                    <span className="flex-1 truncate text-sm text-neutral-800">{summarizeTravellers(value)}</span>
                    <CaretDownIcon className={cn('ml-2 size-4 shrink-0 text-neutral-400 transition-transform', open && 'rotate-180')} />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    className={cn(menuZClass, 'w-[min(92vw,340px)] rounded-xl border border-neutral-200 bg-white p-4 shadow-xl shadow-black/10')}
                >
                    {/* Rooms */}
                    {showRooms && (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-neutral-800">Rooms</p>
                                    {liveMinRooms > 1 ? (
                                        <p className="text-[11px] text-neutral-400">Minimum {liveMinRooms} rooms for {adults + childrenAges.length} travellers</p>
                                    ) : maxRooms < MAX_ROOMS && (
                                        <p className="text-[11px] text-neutral-400">Limited by availability at this trip&apos;s hotels</p>
                                    )}
                                </div>
                                <Stepper value={rooms} min={liveMinRooms} max={maxRooms} onChange={(n) => {
                                    const wasIncrease = n > rooms
                                    interactedRef.current = true
                                    roomsClickRef.current = true
                                    setRooms(n)
                                    if (wasIncrease && n >= maxRooms) {
                                        notifyLimit(maxRooms < MAX_ROOMS
                                            ? `Only ${maxRooms} room${maxRooms > 1 ? 's' : ''} available across this trip's hotels`
                                            : `Maximum ${MAX_ROOMS} rooms per booking`)
                                    } else if (!wasIncrease && liveMinRooms > 1 && n <= liveMinRooms) {
                                        notifyLimit(`Minimum ${liveMinRooms} rooms needed for ${adults + childrenAges.length} travellers`)
                                    }
                                }} />
                            </div>
                            <div className="my-3 h-px bg-neutral-100" />
                        </>
                    )}

                    {/* Adults */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-neutral-800">Adults</p>
                            <p className="text-xs text-neutral-400">Above 12 years</p>
                        </div>
                        <Stepper value={adults} min={showRooms ? Math.max(1, rooms) : 1} max={MAX_ADULTS} onChange={(n) => {
                            const wasIncrease = n > adults
                            interactedRef.current = true
                            adultsClickRef.current = true
                            setAdults(n)
                            if (wasIncrease && n >= MAX_ADULTS) {
                                notifyLimit(`Maximum ${MAX_ADULTS} adults per booking`)
                            } else if (!wasIncrease && showRooms && rooms > 1 && n <= rooms) {
                                notifyLimit(`Minimum ${rooms} adults needed — each room needs at least one adult`)
                            }
                        }} />
                    </div>

                    <div className="my-3 h-px bg-neutral-100" />

                    {/* Children */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-neutral-800">Children</p>
                            <p className="text-xs text-neutral-400">Below 12 years</p>
                        </div>
                        <Stepper value={childrenAges.length} min={0} max={MAX_CHILDREN} onChange={(n) => {
                            const wasIncrease = n > childrenAges.length
                            interactedRef.current = true
                            setChildrenCount(n)
                            if (wasIncrease && n >= MAX_CHILDREN) {
                                notifyLimit(`Maximum ${MAX_CHILDREN} children per booking`)
                            }
                        }} />
                    </div>

                    {/* Per-child age — requiprimary */}
                    {childrenAges.length > 0 && (
                        <div className="mt-3 rounded-lg bg-neutral-50 p-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                                Age of each child <span className="text-primary-500">*</span>
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {childrenAges.map((age, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="shrink-0 text-xs text-neutral-500">Child {i + 1}</span>
                                        <select
                                            value={age}
                                            onChange={(e) => setChildAge(i, Number(e.target.value))}
                                            className={cn(
                                                'flex-1 rounded-md border bg-white px-2 py-1.5 text-xs text-neutral-800 outline-none transition-colors',
                                                age < 0 ? 'border-primary-300 text-neutral-400' : 'border-neutral-200',
                                            )}
                                        >
                                            <option value={-1} disabled>Age</option>
                                            {Array.from({ length: CHILD_AGE_MAX + 1 }).map((_, a) => (
                                                <option key={a} value={a}>{a === 0 ? '< 1 yr' : `${a} yr`}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            {hasUnsetAge && (
                                <p className="mt-2 text-[11px] text-primary-500">Select an age for each child.</p>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-neutral-400">
                            {adults + childrenAges.length} traveller{adults + childrenAges.length !== 1 ? 's' : ''}
                            {showRooms ? `, ${rooms} room${rooms !== 1 ? 's' : ''}` : ''}
                        </span>
                        <Button variant="premium" size="sm" disabled={hasUnsetAge} onClick={apply} className="rounded-lg px-6">
                            Apply
                        </Button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
