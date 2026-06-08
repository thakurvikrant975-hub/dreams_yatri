'use client'

import React from 'react'
import { motion } from 'framer-motion'
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

// ─── Data ─────────────────────────────────────────────────────────────────────
export type DestinationItem = Omit<DestinationCardProps, 'onClick'> & {
    slug: string
    badge?: string
    region?: string
}

const DOMESTIC: DestinationItem[] = [
    { slug: 'himachal-pradesh', name: 'Himachal Pradesh', packageCount: 32, image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop', icon: IslandIcon, badge: 'Most Popular', region: 'North India' },
    { slug: 'kashmir', name: 'Kashmir', packageCount: 102, image: 'https://images.unsplash.com/photo-1614591276564-7b3e69347a48?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'North India' },
    { slug: 'kerala', name: 'Kerala', packageCount: 25, image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'South India' },
    { slug: 'goa', name: 'Goa', packageCount: 15, image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'West India' },
    { slug: 'rajasthan', name: 'Rajasthan', packageCount: 28, image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'West India' },
    { slug: 'uttarakhand', name: 'Uttarakhand', packageCount: 19, image: 'https://images.unsplash.com/photo-1502786129293-79981df4e689?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'North India' },
]

const INTERNATIONAL: DestinationItem[] = [
    { slug: 'dubai', name: 'Dubai', packageCount: 50, image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'Middle East' },
    { slug: 'switzerland', name: 'Switzerland', packageCount: 99, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'Europe' },
    { slug: 'france', name: 'France', packageCount: 102, image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'Europe' },
    { slug: 'japan', name: 'Japan', packageCount: 55, image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'East Asia' },
    { slug: 'thailand', name: 'Thailand', packageCount: 44, image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'Southeast Asia' },
    { slug: 'maldives', name: 'Maldives', packageCount: 30, image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&auto=format&fit=crop', icon: IslandIcon, region: 'Indian Ocean' },
]

// ─── Props ────────────────────────────────────────────────────────────────────
interface ExploreDestinationsProps {
    domestic?: DestinationItem[]
    international?: DestinationItem[]
    onDestinationClick?: (slug: string) => void
    onViewAllDomestic?: () => void
    onViewAllInternational?: () => void
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function DestinationRow({
    label,
    icon: RowIcon,
    items,
    onViewAll,
    onItemClick,
}: {
    label: string
    icon: React.ElementType
    items: DestinationItem[]
    onViewAll?: () => void
    onItemClick?: (slug: string) => void
}) {
    return (
        <motion.div
            className="mb-10"
            variants={fadeUp}
        >
            {/* Row header — label slides from left, View All slides from right */}
            <div className="flex items-center justify-between mb-4">
                <motion.div
                    className="flex items-center gap-2.5"
                    variants={fadeRight}
                >
                    <RowIcon weight="duotone" className="size-7 duo_icons" />
                    <Heading level={3} className="font-bold">{label}</Heading>
                </motion.div>

                <motion.div variants={fadeLeft}>
                    <Button variant="outline" size="sm" className="flex items-center gap-1.5 font-heading font-medium text-sm sm:gap-2" onClick={onViewAll}>
                        View All
                        <ArrowRightIcon weight="bold" className="size-3.5 text-(--text-muted)" />
                    </Button>
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
                        onClick={() => onItemClick?.(item.slug)}
                    />
                )}
                perView={4}
                gap={24}
                ariaLabel={`${label} destinations`}
            />
        </motion.div>
    )
}

// ─── Main section ─────────────────────────────────────────────────────────────
export default function ExploreDestinations({
    domestic = DOMESTIC,
    international = INTERNATIONAL,
    onDestinationClick,
    onViewAllDomestic,
    onViewAllInternational,
}: ExploreDestinationsProps) {
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
                    items={domestic}
                    onViewAll={onViewAllDomestic}
                    onItemClick={onDestinationClick}
                />

                <DestinationRow
                    label="Beyond Borders"
                    icon={AirplaneTiltIcon}
                    items={international}
                    onViewAll={onViewAllInternational}
                    onItemClick={onDestinationClick}
                />

            </div>
        </section>
    )
}