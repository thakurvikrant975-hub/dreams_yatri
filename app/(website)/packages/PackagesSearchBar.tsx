'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import LocationSearchSelect, { type LocationValue } from '@/app/components/ui/LocationSearchSelect'
import DatePickerField from '@/app/components/ui/DatePickerField'
import TravellersField, { type TravellersValue } from '@/app/components/ui/TravellersField'
import Button from '@/app/components/ui/Button'

export interface PackagesSearchBarProps {
    initialFrom: LocationValue | null
    initialTo: LocationValue | null
    initialDate: Date | null
    initialTravellers: TravellersValue
}

function Label({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <span id={id} className="pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
            {children}
        </span>
    )
}

export default function PackagesSearchBar({
    initialFrom, initialTo, initialDate, initialTravellers,
}: PackagesSearchBarProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [fromLoc, setFromLoc] = useState<LocationValue | null>(initialFrom)
    const [toLoc, setToLoc] = useState<LocationValue | null>(initialTo)
    const [departDate, setDepartDate] = useState<Date | null>(initialDate)
    const [travellers, setTravellers] = useState<TravellersValue>(initialTravellers)

    function search() {
        const p = new URLSearchParams()
        // Destination is optional — without it /packages lists everything.
        if (toLoc) {
            p.set('to', toLoc.id)
            p.set('toName', toLoc.name)
            p.set('toType', toLoc.type)
        }
        if (fromLoc) {
            p.set('from', fromLoc.id)
            p.set('fromName', fromLoc.name)
            p.set('fromType', fromLoc.type)
        }
        if (departDate) {
            const y = departDate.getFullYear()
            const m = String(departDate.getMonth() + 1).padStart(2, '0')
            const d = String(departDate.getDate()).padStart(2, '0')
            p.set('date', `${y}-${m}-${d}`)
        }
        p.set('adults', String(travellers.adults))
        if (travellers.childrenAges.length) p.set('children', travellers.childrenAges.join(','))
        p.set('rooms', String(travellers.rooms ?? 1))
        const qs = p.toString()
        startTransition(() => {
            router.push(qs ? `/packages?${qs}` : '/packages')
        })
    }

    return (
        <div className="bg-neutral-900">
            <div className="screen-space py-3">
                <form
                    role="search"
                    aria-label="Search holiday packages"
                    onSubmit={(e) => { e.preventDefault(); if (!isPending) search() }}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2.5 items-end">

                        <div className="flex flex-col gap-1" role="group" aria-labelledby="label-from">
                            <Label id="label-from">Leaving From</Label>
                            <LocationSearchSelect value={fromLoc} onChange={setFromLoc} placeholder="Origin city" showCurrentLocation />
                        </div>

                        <div className="flex flex-col gap-1" role="group" aria-labelledby="label-to">
                            <Label id="label-to">Going To</Label>
                            <LocationSearchSelect value={toLoc} onChange={setToLoc} placeholder="All destinations" />
                        </div>

                        <div className="flex flex-col gap-1" role="group" aria-labelledby="label-date">
                            <Label id="label-date">Departure Date</Label>
                            <DatePickerField value={departDate} onChange={setDepartDate} placeholder="Pick a date" />
                        </div>

                        <div className="flex flex-col gap-1" role="group" aria-labelledby="label-travellers">
                            <Label id="label-travellers">Travellers</Label>
                            <TravellersField value={travellers} onChange={setTravellers} showRooms />
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className="hidden lg:block text-[10px] leading-3.5" aria-hidden="true">&nbsp;</span>
                            <Button
                                type="submit"
                                variant="premium"
                                loading={isPending}
                                disabled={isPending}
                                className="h-10.5 w-full lg:w-auto rounded-lg px-7 font-bold flex items-center justify-center gap-2"
                            >
                                <MagnifyingGlassIcon weight="bold" className="size-4" aria-hidden="true" />
                                {isPending ? 'Searching…' : 'Search'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
