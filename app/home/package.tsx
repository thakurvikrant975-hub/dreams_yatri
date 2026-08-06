'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import PackageCard from '@/app/components/packages/Packages'
import Button from '@/app/components/ui/Button'
import Tabs from '@/app/components/ui/Tabs'
import {
    ArrowRightIcon, TrendUpIcon, SunIcon,
    HeartIcon, UsersThreeIcon, MountainsIcon, WavesIcon,
} from '@phosphor-icons/react'
import PackageGrid from '@/app/components/packages/PackageGrid'
import { Carousel } from '@/app/components/ui/Carousel'
import SectionHeader from '@/app/components/ui/SectionHeader'
import type { RelatedPackageItem } from '@/app/actions/packages/fetch-page-data'

interface TrendingPackagesProps {
    packages: RelatedPackageItem[]
}

// How many cards a tab shows. The section is a teaser — "View All" leads to
// the full listing, where the same themes exist as real filters.
const CARDS_PER_TAB = 6

// Theme tabs, keyed to THEME_RULES slugs so they mean exactly what the
// /packages filter of the same name means. The previous set (Domestic /
// International / Budget / Seasonal) was scaffolding: nothing was wired to it,
// and three of the four had no data behind them — every destination on file is
// domestic, and there's no seasonality or budget-tier field to group by.
// These are matched from each package's own categories and tags.
const THEME_TABS: { id: string; label: string; icon: React.ElementType }[] = [
    { id: 'honeymoon', label: 'Honeymoon',       icon: HeartIcon },
    { id: 'family',    label: 'Family',          icon: UsersThreeIcon },
    { id: 'adventure', label: 'Adventure',       icon: MountainsIcon },
    { id: 'beach',     label: 'Beach & Islands', icon: WavesIcon },
    { id: 'weekend',   label: 'Weekend',         icon: SunIcon },
]

const ALL_TAB = { id: 'all', label: 'Trending', icon: TrendUpIcon }

export default function TrendingPackages({ packages }: TrendingPackagesProps) {
    const [activeTab, setActiveTab] = useState(ALL_TAB.id)

    // Only offer a tab that actually has packages behind it — an empty tab is
    // worse than no tab, and which themes are populated depends on the catalogue.
    const tabs = useMemo(() => [
        ALL_TAB,
        ...THEME_TABS.filter((t) => packages.some((p) => p.themes?.includes(t.id))),
    ], [packages])

    // Guard against the active tab disappearing if `packages` changes.
    const currentTab = tabs.some((t) => t.id === activeTab) ? activeTab : ALL_TAB.id

    const visiblePackages = useMemo(() => (
        currentTab === ALL_TAB.id
            ? packages
            : packages.filter((p) => p.themes?.includes(currentTab))
    ).slice(0, CARDS_PER_TAB), [packages, currentTab])

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
                        tabs={tabs}
                        activeTab={currentTab}
                        onTabChange={setActiveTab}
                        idPrefix="home-pkg"
                        trailing={
                            <Link href="/packages" className="flex items-center gap-1.5 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors">
                                View All
                                <ArrowRightIcon className="size-4" weight="bold" />
                            </Link>
                        }
                    />
                </div>

                {/* ── Packages ──
                    Below sm the grid stacked six full-width cards into a long
                    column that read as the end of the page; the same Carousel
                    the destinations row uses turns it into one swipeable strip.
                    perViewMobile puts the current card at ~80% of the track and
                    leaves the next one peeking, which is what tells a thumb
                    there's more to the right.

                    Rendered as two breakpoint-gated copies rather than swapped
                    on a media-query hook, so the server can commit to a layout
                    and neither viewport hydrates into a jump. Only the first
                    card of each copy is `isPriority`, so the hidden copy costs
                    one eager image, not three — the rest are lazy and a
                    display:none subtree never intersects the viewport. */}
                <div className="sm:hidden">
                    <Carousel
                        items={visiblePackages}
                        renderItem={(pkg, index) => (
                            <Link
                                href={`/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`}
                                className="block"
                            >
                                <PackageCard
                                    title={pkg.title}
                                    images={pkg.images}
                                    duration={pkg.duration}
                                    itinerary={pkg.itinerary}
                                    originalPrice={pkg.originalPrice}
                                    discountedPrice={pkg.discountedPrice}
                                    totalPrice={pkg.totalPrice}
                                    pricedForAdults={pkg.pricedForAdults}
                                    inclusions={pkg.inclusions}
                                    highlights={pkg.highlights}
                                    badge={pkg.badge}
                                    badgeColor={pkg.badgeColor}
                                    isPriority={index === 0}
                                />
                            </Link>
                        )}
                        // 1.22 rather than a round 1.25: the gap is subtracted
                        // from the card, so 1.25 lands at 78% on a 390px phone.
                        perViewMobile={1.22}
                        // The category ribbon hangs 16px past its card's left
                        // edge (-translate-x-4), so a smaller gap puts the next
                        // card's badge right up against the current card.
                        gap={32}
                        showFade={false}
                        showCounter={false}
                        ariaLabel="Trending packages"
                    />
                </div>

                <PackageGrid className="hidden sm:grid">
                    {visiblePackages.map((pkg, index) => (
                        <Link
                            key={pkg.id}
                            href={`/packages/${pkg.slug}/${pkg.durationSlug}/${pkg.routeSlug}/${pkg.staySlug}`}
                            className="block"
                        >
                            <PackageCard
                                title={pkg.title}
                                images={pkg.images}
                                duration={pkg.duration}
                                itinerary={pkg.itinerary}
                                originalPrice={pkg.originalPrice}
                                discountedPrice={pkg.discountedPrice}
                                totalPrice={pkg.totalPrice}
                                pricedForAdults={pkg.pricedForAdults}
                                inclusions={pkg.inclusions}
                                highlights={pkg.highlights}
                                badge={pkg.badge}
                                badgeColor={pkg.badgeColor}
                                isPriority={index === 0}
                            />
                        </Link>
                    ))}
                </PackageGrid>

                {/* ── View All — mobile ── */}
                <div className="flex justify-center mt-8 sm:hidden">
                    <Link
                        href="/packages"
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-button ring-1 ring-inset ring-(--border-default) bg-white text-(--text-secondary) shadow-md shadow-neutral-200 hover:bg-neutral-50"
                    >
                        View All Packages
                        <ArrowRightIcon className="size-4" weight="bold" />
                    </Link>
                </div>

            </div>
        </section>
    )
}
