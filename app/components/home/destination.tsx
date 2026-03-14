'use client'

import React, { useRef } from 'react'
import { Heading, Text } from '../ui/Typography'
import DestinationCard, { type DestinationCardProps } from '../destinations/Destination'
import Button from '../ui/Button'
import {
    MapPinIcon,
    AirplaneTiltIcon,
    ArrowRightIcon,
    CaretLeftIcon,
    CaretRightIcon,
    IslandIcon,
} from '@phosphor-icons/react'
import SectionHeader from '../ui/SectionHeader'

// ─── Data ─────────────────────────────────────────────────────────────────────
type DestinationItem = Omit<DestinationCardProps, 'onClick'> & {
    slug: string
    badge?: string
}

const DOMESTIC: DestinationItem[] = [
    {
        slug: 'himachal-pradesh',
        name: 'Himachal Pradesh',
        packageCount: 32,
        image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&auto=format&fit=crop',
        icon: IslandIcon,
        badge: 'Most Popular',
    },
    {
        slug: 'kashmir',
        name: 'Kashmir',
        packageCount: 102,
        image: 'https://images.unsplash.com/photo-1614591276564-7b3e69347a48?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'kerala',
        name: 'Kerala',
        packageCount: 25,
        image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'goa',
        name: 'Goa',
        packageCount: 15,
        image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'rajasthan',
        name: 'Rajasthan',
        packageCount: 28,
        image: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'uttarakhand',
        name: 'Uttarakhand',
        packageCount: 19,
        image: 'https://images.unsplash.com/photo-1502786129293-79981df4e689?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
]

const INTERNATIONAL: DestinationItem[] = [
    {
        slug: 'dubai',
        name: 'Dubai',
        packageCount: 50,
        image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'switzerland',
        name: 'Switzerland',
        packageCount: 99,
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'france',
        name: 'France',
        packageCount: 102,
        image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'japan',
        name: 'Japan',
        packageCount: 55,
        image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'thailand',
        name: 'Thailand',
        packageCount: 44,
        image: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
    {
        slug: 'maldives',
        name: 'Maldives',
        packageCount: 30,
        image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&auto=format&fit=crop',
        icon: IslandIcon,
    },
]

// ─── Props ────────────────────────────────────────────────────────────────────
interface ExploreDestinationsProps {
    domestic?: DestinationItem[]
    international?: DestinationItem[]
    onDestinationClick?: (slug: string) => void
    onViewAllDomestic?: () => void
    onViewAllInternational?: () => void
}

// ─── Row with scroll nav ──────────────────────────────────────────────────────
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
    const scrollRef = useRef<HTMLDivElement>(null)

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return
        const amount = scrollRef.current.clientWidth * 0.75
        scrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' })
    }

    return (
        <div className="mb-10">
            {/* Row header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <RowIcon weight="duotone" className="size-7 duo_icons" />
                    <Heading level={3} className="font-bold">
                        {label}
                    </Heading>
                </div>

                <div className="flex items-center gap-2">
                    {/* Prev / Next */}
                    <Button
                        onClick={() => scroll('left')}
                        size='auto'
                        aria-label="Scroll left"
                        variant='outline'
                        className='p-2.5 rounded-full'
                    >
                        <CaretLeftIcon weight="bold" className="size-3.5 text-(--text-secondary)" />
                    </Button>
                    <Button
                        onClick={() => scroll('right')}
                        size='auto'
                        variant='outline'
                        aria-label="Scroll right"
                        className='p-2.5 rounded-full'
                    >
                        <CaretRightIcon weight="bold" className="size-3.5 text-(--text-secondary)" />
                    </Button>

                    {/* View All */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 font-heading font-medium text-sm"
                        onClick={onViewAll}
                    >
                        View All
                        <ArrowRightIcon weight="bold" className="size-3.5 text-(--text-muted)" />
                    </Button>
                </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-(--border-muted) mb-5" />

            <div
                ref={scrollRef}
                className="flex gap-9 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1"
            >
                {items.map((item) => (
                    <div key={item.slug} className="shrink-0 w-80">
                        <DestinationCard
                            name={item.name}
                            packageCount={item.packageCount}
                            image={item.image}
                            icon={item.icon}
                            onClick={() => onItemClick?.(item.slug)}
                        />
                    </div>
                ))}
            </div>
        </div>
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
        <section className="w-full py-section overflow-hidden bg-surface-muted">
            <div className="screen-space">

                {/* ── Section header ── */}
                <SectionHeader
                    tag='India & Beyond'
                    title='Explore By Destinations'
                    subtitle='From Himalayan peaks to tropical shores'
                />

                {/* ── Domestic ── */}
                <DestinationRow
                    label="Domestic"
                    icon={MapPinIcon}
                    items={domestic}
                    onViewAll={onViewAllDomestic}
                    onItemClick={onDestinationClick}
                />

                {/* ── International ── */}
                <DestinationRow
                    label="International"
                    icon={AirplaneTiltIcon}
                    items={international}
                    onViewAll={onViewAllInternational}
                    onItemClick={onDestinationClick}
                />

            </div>
        </section>
    )
}