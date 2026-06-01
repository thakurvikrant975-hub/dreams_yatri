'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import LocationSearchSelect, { type LocationValue } from '@/app/components/ui/LocationSearchSelect'
import DatePickerField from '@/app/components/ui/DatePickerField'
import TravellersField, { type TravellersValue } from '@/app/components/ui/TravellersField'
import Button from '@/app/components/ui/Button'

export interface SearchEditBarProps {
    initialFrom: LocationValue | null
    initialTo: LocationValue | null
    initialDate: Date | null
    initialTravellers: TravellersValue
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <span className="pl-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/55">
            {children}
        </span>
    )
}

export default function SearchEditBar({
    initialFrom, initialTo, initialDate, initialTravellers,
}: SearchEditBarProps) {
    const router = useRouter()
    const [fromLoc, setFromLoc] = useState<LocationValue | null>(initialFrom)
    const [toLoc, setToLoc] = useState<LocationValue | null>(initialTo)
    const [departDate, setDepartDate] = useState<Date | null>(initialDate)
    const [travellers, setTravellers] = useState<TravellersValue>(initialTravellers)
    const [error, setError] = useState('')

    function search() {
        if (!toLoc) { setError('Choose where you want to go.'); return }
        setError('')
        const p = new URLSearchParams()
        p.set('to', toLoc.id)
        p.set('toName', toLoc.name)
        p.set('toType', toLoc.type)
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
        router.push(`/search?${p.toString()}`)
    }

    return (
        <div className="bg-neutral-900">
            <div className="screen-space py-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2.5 items-end">

                    <div className="flex flex-col gap-1">
                        <Label>Leaving From</Label>
                        <LocationSearchSelect value={fromLoc} onChange={setFromLoc} placeholder="Origin city" showCurrentLocation />
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label>Going To</Label>
                        <LocationSearchSelect value={toLoc} onChange={setToLoc} placeholder="Destination city" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label>Departure Date</Label>
                        <DatePickerField value={departDate} onChange={setDepartDate} placeholder="Pick a date" />
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label>Travellers</Label>
                        <TravellersField value={travellers} onChange={setTravellers} />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className="hidden lg:block text-[10px] leading-[14px]">&nbsp;</span>
                        <Button
                            variant="premium"
                            onClick={search}
                            className="h-[42px] w-full lg:w-auto rounded-lg px-7 font-bold flex items-center justify-center gap-2"
                        >
                            <MagnifyingGlassIcon weight="bold" className="size-4" />
                            Search
                        </Button>
                    </div>

                    {error && <p className="text-xs text-red-300 sm:col-span-2 lg:col-span-5">{error}</p>}
                </div>
            </div>
        </div>
    )
}
