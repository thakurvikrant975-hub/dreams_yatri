'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import PackageCard from '@/app/components/packages/Packages'
import PackageGrid from '@/app/components/packages/PackageGrid'
import { Text } from '@/app/components/ui/Typography'
import type { SearchPackageItem } from '@/app/actions/search/search-packages'

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function PackagesList({ items }: { items: SearchPackageItem[] }) {
    const router = useRouter()
    const params = useSearchParams()

    // Carry leaving-from, date and travellers into the package page so it pre-fills.
    function packageHref(pkg: SearchPackageItem) {
        const q = new URLSearchParams()
        for (const k of ['from', 'fromName', 'fromType', 'date', 'adults', 'children']) {
            const v = params.get(k)
            if (v) q.set(k, v)
        }
        const base = `/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`
        const qs = q.toString()
        return qs ? `${base}?${qs}` : base
    }

    return (
        <PackageGrid>
            {items.map((pkg) => (
                <div key={pkg.id} className="flex flex-col">
                    <PackageCard
                        title={pkg.title}
                        images={pkg.images}
                        duration={pkg.duration}
                        itinerary={pkg.itinerary}
                        originalPrice={pkg.originalPerPerson}
                        discountedPrice={pkg.perPerson}
                        onClick={() => router.push(packageHref(pkg), { scroll: false })}
                    />
                    {pkg.total > 0 && (
                        <Text size="xs" intent="muted" className="mt-1.5 pl-1">
                            Total {fmt(pkg.total)} for all travellers
                        </Text>
                    )}
                </div>
            ))}
        </PackageGrid>
    )
}
