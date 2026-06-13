'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heading } from '@/app/components/ui/Typography'
import DestinationCard, { type DestinationCardProps } from '@/app/components/destinations/Destination'
import Button from '@/app/components/ui/Button'
import { Carousel } from '@/app/components/ui/Carousel'
import {
    MapPinIcon,
    AirplaneTiltIcon,
    ArrowRightIcon,
    IslandIcon,
} from '@phosphor-icons/react'
import SectionHeader from '@/app/components/ui/SectionHeader'
import { fadeIn, fadeUp, fadeRight, fadeLeft } from '@/app/lib/motionPresets'

// ─── Types ────────────────────────────────────────────────────────────────────
export type DestinationItem = Omit<DestinationCardProps, 'onClick'> & {
    slug: string
    badge?: string
    region?: string
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ExploreDestinationsProps {
    domestic?: DestinationItem[]
    international?: DestinationItem[]
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function DestinationRow({
    label,
    icon: RowIcon,
    items,
    viewAllHref,
    itemBasePath,
}: {
    label: string
    icon: React.ElementType
    items: DestinationItem[]
    viewAllHref: string
    itemBasePath: string
}) {
    const router = useRouter()

    if (items.length === 0) return null

    return (
        <motion.div
            className="mb-10"
            variants={fadeUp}
        >
            {/* Row header */}
            <div className="flex items-center justify-between mb-4">
                <motion.div
                    className="flex items-center gap-2.5"
                    variants={fadeRight}
                >
                    <RowIcon weight="duotone" className="size-7 duo_icons" />
                    <Heading level={3} className="font-bold">{label}</Heading>
                </motion.div>

                <motion.div variants={fadeLeft}>
                    <Link href={viewAllHref}>
                        <Button variant="outline" size="sm" className="flex items-center gap-1.5 font-heading font-medium text-sm sm:gap-2">
                            View All
                            <ArrowRightIcon weight="bold" className="size-3.5 text-(--text-muted)" />
                        </Button>
                    </Link>
                </motion.div>
            </div>

            {/* Divider */}
            <motion.div
                className="h-px bg-(--border-muted) mb-5"
                variants={fadeIn}
            />

            {/* Cards carousel */}
            <Carousel
                items={items}
                renderItem={(item) => (
                    <DestinationCard
                        name={item.name}
                        packageCount={item.packageCount}
                        image={item.image}
                        icon={item.icon}
                        region={item.region}
                        onClick={() => router.push(`${itemBasePath}/${item.slug}`)}
                    />
                )}
                perView={4.5}
                gap={24}
                ariaLabel={`${label} destinations`}
                fadeColor="var(--color-neutral-100)"
            />
        </motion.div>
    )
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function ExploreDestinations({
    domestic,
    international,
}: ExploreDestinationsProps) {
    const domesticData = domestic ?? []
    const internationalData = international ?? []

    if (domesticData.length === 0 && internationalData.length === 0) return null

    return (
        <section className="w-full py-section overflow-hidden bg-surface-muted relative z-10">
            <div className="absolute bottom-0 right-0 -z-20 size-36 sm:size-52">
                <svg
                    viewBox="0 0 800 800"
                    className="opacity-70 scale-75"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <radialGradient id="dest-glow-1" r="0.75" cx="0.5" cy="0.5">
                            <stop offset={0} style={{ stopColor: 'var(--color-primary-50)' }} />
                            <stop offset={1} style={{ stopColor: 'var(--color-primary-200)' }} />
                        </radialGradient>
                    </defs>
                    <circle fill="url(#dest-glow-1)" r={300} cx={400} cy={400} />
                </svg>
            </div>

            <div className="absolute bottom-16 right-6 sm:bottom-24 sm:right-16 -z-20 size-36 sm:size-52 ">
                <svg
                    viewBox="0 0 800 800"
                    className="scale-[40%] opacity-70"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <radialGradient id="dest-glow-2" r="0.75" cx="0.5" cy="0.5">
                            <stop offset={0} style={{ stopColor: 'var(--color-primary-50)' }} />
                            <stop offset={1} style={{ stopColor: 'var(--color-primary-200)' }} />
                        </radialGradient>
                    </defs>
                    <circle fill="url(#dest-glow-2)" r={300} cx={400} cy={400} />
                </svg>
            </div>

            <div className="screen-space">

                <SectionHeader
                    noAnimation
                    tag='India & Beyond'
                    title='Explore By Destinations'
                    subtitle='From Himalayan peaks to tropical shores'
                    className="relative z-10"
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-5 -z-10">
                        <svg width="230" height="180" viewBox="0 0 589 453" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M379.856 262.134C363.93 284.943 350.076 311.938 314.842 320.705C279.23 329.566 234.05 321.609 197.177 307.587C163.491 294.776 151.04 266.762 123.516 247.945C95.1373 228.545 48.5316 220.45 33.6158 195.769C18.5399 170.824 39.2594 146.665 47.7233 122.536C57.0394 95.9776 55.4095 64.0469 85.6492 47.4329C116.302 30.5919 163.451 34.5572 205.764 35.7068C247.54 36.8417 296.035 33.2767 328.819 54.0392C361.924 75.0046 352.488 109.176 366.343 137.401C376.687 158.474 397.59 177.457 399.909 198.867C402.382 221.692 393.424 242.7 379.856 262.134Z" fill="#FFE2E2" />
                            <path d="M254.43 259.754L134.005 414.245L58.5533 261.167L254.43 259.754Z" fill="#CBFBF1" />
                            <circle cx="498.5" cy="109.874" r="90.5" fill="#CBFBF1" />
                        </svg>
                    </div>
                </SectionHeader>

                <DestinationRow
                    label="Domestic"
                    icon={MapPinIcon}
                    items={domesticData}
                    viewAllHref="/destination?type=domestic"
                    itemBasePath="/region"
                />

                <DestinationRow
                    label="Beyond Borders"
                    icon={AirplaneTiltIcon}
                    items={internationalData}
                    viewAllHref="/destination?type=international"
                    itemBasePath="/destination"
                />

            </div>
        </section>
    )
}