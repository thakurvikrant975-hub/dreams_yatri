'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PackageCard from '@/app/components/packages/Packages'
import Button from '@/app/components/ui/Button'
import Tabs from '@/app/components/ui/Tabs'
import {
    ArrowRightIcon, TrendUpIcon, MapPinIcon, AirplaneTiltIcon, CurrencyInrIcon, SunIcon,
} from '@phosphor-icons/react'
import PackageGrid from '@/app/components/packages/PackageGrid'
import SectionHeader from '@/app/components/ui/SectionHeader'
import type { RelatedPackageItem } from '@/app/actions/packages/fetch-page-data'

interface TrendingPackagesProps {
    packages: RelatedPackageItem[]
}

// Category tabs (Figma). Trending is the live default; the rest are scaffolded
// until the packages query returns per-category sets.
const CATEGORY_TABS = [
    { id: 'trending', label: 'Trending', icon: TrendUpIcon },
    { id: 'domestic', label: 'Domestic', icon: MapPinIcon },
    { id: 'international', label: 'International', icon: AirplaneTiltIcon },
    { id: 'budget', label: 'Budget', icon: CurrencyInrIcon },
    { id: 'seasonal', label: 'Seasonal', icon: SunIcon },
]

export default function TrendingPackages({ packages }: TrendingPackagesProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState('trending')

    return (
        <section className="w-full py-section relative overflow-hidden">
            <>
                <div className="absolute h-72 w-full top-0 left-0 bg-gradient-to-b from-secondary-50 to-transparent -z-30" />
                <div className="absolute right-0 top-0 -z-20 -translate-y-1.5">
                    <svg
                        className="w-[254px] h-[212px] sm:w-[508px] sm:h-[424px]"
                        viewBox="0 0 1016 848"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            className="fill-primary-100/40"
                            d="M103.5 0.5C39.3333 17 -27.6 104 12 232C61.5 392 280.5 429 463 444C615.666 456.548 721.5 515.5 773.5 655.5C815.133 767.588 911.5 810.5 1002.5 828L1372 848L1249 0.5L1049.5 -137.5H463L103.5 0.5Z"
                        />
                    </svg>
                </div>

                <div className="absolute right-0 top-0 -z-10 translate-x-8 -translate-y-5 rotate-5">
                    <svg
                        className="w-[254px] h-[212px] sm:w-[508px] sm:h-[424px]"
                        viewBox="0 0 1016 848"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            className="fill-primary-100"
                            d="M103.5 0.5C39.3333 17 -27.6 104 12 232C61.5 392 280.5 429 463 444C615.666 456.548 721.5 515.5 773.5 655.5C815.133 767.588 911.5 810.5 1002.5 828L1372 848L1249 0.5L1049.5 -137.5H463L103.5 0.5Z"
                        />
                    </svg>
                </div>
            </>

            <div className="screen-space">

                {/* ── Section header + View All button ── */}
                <div className="flex items-end justify-between">
                    <SectionHeader
                        noAnimation
                        tag='Handpicked For You'
                        title='Trending Experiences'
                        subtitle='Curated packages designed around your travel style'
                        className="relative z-10"
                    >
                        <div className="absolute top-1/2 -translate-y-1/2 left-0 -translate-x-1/2 -z-10">
                            <svg width="195" height="95" viewBox="0 0 239 129" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g clipPath="url(#clip0_733_334)">
                                    <circle cx="2.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="21.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="32.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="43.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="54.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="65.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="76.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="87.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="98.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="2.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="13.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="24.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="35.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="46.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="57.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="68.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="79.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="90.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="101.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="112.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="123.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="134.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="145.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                    <circle cx="156.5" cy="109.5" r="2.5" fill="#D1D5DC" />
                                </g>
                                <circle cx="174.5" cy="64.5" r="64.5" fill="#FFC9C9" fillOpacity="0.5" />
                                <defs>
                                    <clipPath id="clip0_733_334">
                                        <rect width="165" height="99" fill="white" transform="translate(0 19)" />
                                    </clipPath>
                                </defs>
                            </svg>

                        </div>
                    </SectionHeader>


                </div>

                {/* ── Category tabs ── */}
                <div className="mb-8">
                    <Tabs
                        tabs={CATEGORY_TABS}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        idPrefix="home-pkg"
                        trailing={
                            <Button
                                variant="ghost"
                                size="sm"
                                className="flex items-center gap-1.5 text-primary-500 hover:text-primary-600 font-semibold"
                                onClick={() => router.push('/packages')}
                            >
                                View All
                                <ArrowRightIcon className="size-4" weight="bold" />
                            </Button>
                        }
                    />
                </div>

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
                                `/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`,
                                { scroll: false }
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
