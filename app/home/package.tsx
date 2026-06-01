'use client'

import { useRouter } from 'next/navigation'
import PackageCard from '@/app/components/packages/Packages'
import Button from '@/app/components/ui/Button'
import { ArrowRightIcon } from '@phosphor-icons/react'
import PackageGrid from '@/app/components/packages/PackageGrid'
import SectionHeader from '@/app/components/ui/SectionHeader'
import type { RelatedPackageItem } from '@/app/actions/packages/fetch-page-data'

interface TrendingPackagesProps {
    packages: RelatedPackageItem[]
}

export default function TrendingPackages({ packages }: TrendingPackagesProps) {
    const router = useRouter()

    return (
        <section className="w-full py-section">
            <div className="screen-space">

                {/* ── Section header + View All button ── */}
                <div className="flex items-end justify-between mb-6">
                    <SectionHeader
                        noAnimation
                        tag='Handpicked For You'
                        title='Trending Experiences'
                        subtitle='Curated packages designed around your travel style'
                    />

                    <div className="hidden sm:block shrink-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1.5 text-primary-500 hover:text-primary-600 font-semibold"
                            onClick={() => router.push('/packages')}
                        >
                            View All
                            <ArrowRightIcon className="size-4" weight="bold" />
                        </Button>
                    </div>
                </div>

                {/* ── Divider ── */}
                <div className="h-px w-full bg-(--border-muted) mb-8" />

                {/* ── Package grid ── */}
                <PackageGrid>
                    {packages.map((pkg) => (
                        <PackageCard
                            key={pkg.id}
                            title={pkg.title}
                            images={pkg.images}
                            duration={pkg.duration}
                            rating={4.8}
                            reviewCount={0}
                            itinerary={pkg.itinerary}
                            originalPrice={pkg.originalPrice}
                            discountedPrice={pkg.discountedPrice}
                            inclusions={['hotel', 'meals', 'cab']}
                            onClick={() => router.push(
                                `/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`
                            )}
                        />
                    ))}
                </PackageGrid>

                {/* ── View All — mobile ── */}
                <div className="flex justify-center mt-8 sm:hidden">
                    <Button
                        variant="outline"
                        size="md"
                        className="gap-2"
                        onClick={() => router.push('/packages')}
                    >
                        View All Packages
                        <ArrowRightIcon className="size-4" weight="bold" />
                    </Button>
                </div>

            </div>
        </section>
    )
}
