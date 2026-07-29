'use client'

import { MinusIcon, PlusIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { toast } from 'react-toastify'

// A restriction/limit was just hit on a stepper — one consistent, branded
// look for all of them (room/adult/child caps and floors). Card styling
// itself lives on the shared <ToastContainer> in the website layout.
export function notifyLimit(message: string) {
    toast(message, {
        icon: (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <WarningCircleIcon weight="fill" className="size-4.5 text-amber-600" />
            </span>
        ),
    })
}

export function Stepper({
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
