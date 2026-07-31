'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import PackageCard from '@/app/components/packages/Packages'
import PackageGrid from '@/app/components/packages/PackageGrid'
import type { SearchPackageItem } from '@/app/actions/search/search-packages'
import { ROOM_GUEST_PARAM_KEYS } from '@/app/lib/packages/roomGuests'

export default function PackagesList({ items }: { items: SearchPackageItem[] }) {
    const params = useSearchParams()

    // Carry leaving-from, date and the room/guest split into the package page so
    // it pre-fills. `pax` (and `rooms`) used to be dropped here, so a two-room
    // search silently landed on the package page as a single room.
    function packageHref(pkg: SearchPackageItem) {
        const q = new URLSearchParams()
        for (const k of ['from', 'fromName', 'fromType', 'date', ...ROOM_GUEST_PARAM_KEYS]) {
            const v = params.get(k)
            if (v) q.set(k, v)
        }
        const base = `/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`
        const qs = q.toString()
        return qs ? `${base}?${qs}` : base
    }

    // Two-up from lg — the filter sidebar takes the width a third column would
    // need — and back to three once there's room at xl.
    return (
        <PackageGrid className="lg:grid-cols-2 xl:grid-cols-3">
            {items.map((pkg, index) => (
                <Link key={pkg.id} href={packageHref(pkg)} className="block">
                    <PackageCard
                        title={pkg.title}
                        images={pkg.images}
                        duration={pkg.duration}
                        itinerary={pkg.itinerary}
                        originalPrice={pkg.originalPerPerson}
                        discountedPrice={pkg.perPerson}
                        totalPrice={pkg.total}
                        pricedForAdults={pkg.pricedForAdults}
                        inclusions={pkg.inclusions}
                        highlights={pkg.highlights}
                        badge={pkg.badge}
                        badgeColor={pkg.badgeColor}
                        isPriority={index < 3}
                    />
                </Link>
            ))}
        </PackageGrid>
    )
}
