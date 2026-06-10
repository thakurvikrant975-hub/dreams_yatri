'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PackageCard from '@/app/components/packages/Packages'
import PackageGrid from '@/app/components/packages/PackageGrid'
import Button from '@/app/components/ui/Button'
import { fetchDestinationPackages, type DestinationPackageItem, type DestinationPackagesPage } from '@/app/actions/destinations/fetch-destination-page'

interface Props {
    destinationId: number
    initial: DestinationPackagesPage
}

export default function DestinationPackagesList({ destinationId, initial }: Props) {
    const router = useRouter()

    const [items, setItems]     = useState<DestinationPackageItem[]>(initial.items)
    const [page, setPage]       = useState(initial.page)
    const [hasMore, setHasMore] = useState(initial.hasMore)
    const [loading, setLoading] = useState(false)
    const [error, setError]     = useState(false)

    const sentinelRef = useRef<HTMLDivElement>(null)
    const seenIds     = useRef<Set<number>>(new Set(initial.items.map(i => i.id)))

    const loadMore = useCallback(async () => {
        if (loading || !hasMore) return
        setLoading(true)
        setError(false)
        try {
            const next = await fetchDestinationPackages(destinationId, page + 1, initial.pageSize)
            const fresh = next.items.filter(i => !seenIds.current.has(i.id))
            fresh.forEach(i => seenIds.current.add(i.id))
            setItems(prev => [...prev, ...fresh])
            setPage(next.page)
            setHasMore(next.hasMore)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [loading, hasMore, destinationId, page, initial.pageSize])

    useEffect(() => {
        if (!hasMore || error) return
        const el = sentinelRef.current
        if (!el) return
        const ob = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) loadMore() },
            { rootMargin: '400px' },
        )
        ob.observe(el)
        return () => ob.disconnect()
    }, [hasMore, error, loadMore])

    if (items.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-base font-semibold text-primary">No packages here yet</p>
                <p className="text-sm text-secondary mt-1">
                    We&apos;re still curating trips for this destination. Check back soon.
                </p>
            </div>
        )
    }

    return (
        <div>
            <PackageGrid>
                {items.map((pkg) => (
                    <PackageCard
                        key={pkg.id}
                        title={pkg.title}
                        images={pkg.images}
                        duration={pkg.duration}
                        rating={4.5}
                        reviewCount={0}
                        itinerary={pkg.itinerary}
                        originalPrice={pkg.originalPrice}
                        discountedPrice={pkg.discountedPrice}
                        inclusions={['hotel', 'meals', 'cab', 'activities']}
                        onClick={() => router.push(`/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`, { scroll: false })}
                    />
                ))}
            </PackageGrid>

            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden border border-neutral-100">
                            <div className="skeleton-box aspect-3/2 w-full" />
                            <div className="p-4 space-y-3">
                                <div className="skeleton-box h-5 w-3/4 rounded" />
                                <div className="skeleton-box h-4 w-1/2 rounded" />
                                <div className="skeleton-box h-8 w-full rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="py-8 text-center">
                    <p className="text-sm text-secondary mb-3">Couldn&apos;t load more packages.</p>
                    <Button variant="outline" size="sm" onClick={loadMore}>Try again</Button>
                </div>
            )}

            {hasMore && !error && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}

            {!hasMore && !loading && items.length > initial.pageSize && (
                <p className="py-8 text-center text-xs text-muted">You&apos;ve reached the end.</p>
            )}
        </div>
    )
}
