'use client'

import { useEffect, useState } from 'react'
import { Popover } from 'radix-ui'
import { MinusIcon, PlusIcon, UsersFourIcon, CaretDownIcon } from '@phosphor-icons/react'
import Button from './Button'
import { cn } from '@/app/lib/utils'

// childrenAges holds one entry per child; -1 means "age not yet selected".
export type TravellersValue = { adults: number; childrenAges: number[] }

const MAX_ADULTS = 20
const MAX_CHILDREN = 10
const CHILD_AGE_MAX = 11 // children = below 12 years

export function summarizeTravellers(v: TravellersValue): string {
    const parts = [`${v.adults} Adult${v.adults > 1 ? 's' : ''}`]
    if (v.childrenAges.length) {
        parts.push(`${v.childrenAges.length} Child${v.childrenAges.length > 1 ? 'ren' : ''}`)
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
}

export default function TravellersField({
    value, onChange, id, disabled, className, menuZClass = 'z-100',
}: TravellersFieldProps) {
    const [open, setOpen] = useState(false)

    // Draft edited inside the popover; committed on Apply (mirrors MMT).
    const [adults, setAdults] = useState(value.adults)
    const [childrenAges, setChildrenAges] = useState<number[]>(value.childrenAges)

    // Sync draft from the committed value whenever the popover opens
    useEffect(() => {
        if (open) {
            setAdults(value.adults)
            setChildrenAges(value.childrenAges)
        }
    }, [open, value.adults, value.childrenAges])

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
        onChange({ adults, childrenAges })
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
                    {/* Adults */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-neutral-800">Adults</p>
                            <p className="text-xs text-neutral-400">Above 12 years</p>
                        </div>
                        <Stepper value={adults} min={1} max={MAX_ADULTS} onChange={setAdults} />
                    </div>

                    <div className="my-3 h-px bg-neutral-100" />

                    {/* Children */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-neutral-800">Children</p>
                            <p className="text-xs text-neutral-400">Below 12 years</p>
                        </div>
                        <Stepper value={childrenAges.length} min={0} max={MAX_CHILDREN} onChange={setChildrenCount} />
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
