'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Card, CardMedia, CardBody, CardFooter } from '../ui/Card'
import Button from '../ui/Button'
import { Heading, Text } from '../ui/Typography'
import {
    BedIcon,
    ForkKnifeIcon,
    CarIcon,
    StarIcon,
    ArrowsOutIcon,
} from '@phosphor-icons/react'

import { CalendarDaysIcon, PhoneIcon } from '@heroicons/react/24/solid'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Itinerary {
    days: number
    place: string
}

export interface PackageCardProps {
    title: string
    images: string[]
    duration: string
    rating: number
    reviewCount: number
    itinerary: Itinerary[]
    originalPrice: number
    discountedPrice: number
    inclusions?: Array<'hotel' | 'meals' | 'cab' | 'activities'>
    /** Category badge shown top-left on image e.g. "Honeymoon", "Friends" */
    badge?: string
    /** Color theme for the badge */
    badgeColor?: 'teal' | 'blue' | 'orange' | 'green' | 'purple' | 'red'
    /** Secondary offer tag shown below badge e.g. "Best Offer" */
    offerTag?: string
    onRequestCallback?: () => void
    onClick?: () => void
    className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatINR(amount: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount)
}

const INCLUSION_ICONS: Record<string, React.ElementType> = {
    hotel: BedIcon,
    meals: ForkKnifeIcon,
    cab: CarIcon,
    activities: StarIcon,
}

// ─── Itinerary tag list ───────────────────────────────────────────────────────
function ItineraryRow({ items }: { items: Itinerary[] }) {
    const MAX_VISIBLE = 4
    const visible = items.slice(0, MAX_VISIBLE)
    const overflow = items.length - MAX_VISIBLE

    return (
        <div className="flex items-center flex-wrap gap-x-1 gap-y-1 text-xs text-neutral-600 line-clamp-1">
            {visible.map((item, i) => (
                <React.Fragment key={i}>
                    <span>
                        <Text as='span' size='sm' weight='semibold' className='font-heading'>{item.days}D</Text>{' '}
                        <Text as='span' size='sm' intent='secondary'>{item.place}</Text>

                    </span>
                    {(i < visible.length - 1 || overflow > 0) && (
                        <span className="text-neutral-400 select-none">•</span>
                    )}
                </React.Fragment>
            ))}
            {overflow > 0 && (
                <span className="font-semibold text-primary-500">+{overflow}</span>
            )}
        </div>
    )
}

// ─── Image slideshow dots ─────────────────────────────────────────────────────
function ImageDots({
    total,
    active,
    onSelect,
}: {
    total: number
    active: number
    onSelect: (i: number) => void
}) {
    return (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {Array.from({ length: total }).map((_, i) => (
                <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); onSelect(i) }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${i === active
                        ? 'w-5 bg-white'
                        : 'w-1.5 bg-white/50 hover:bg-white/75'
                        }`}
                />
            ))}
        </div>
    )
}

// ─── Badge color map ──────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
    teal: 'bg-teal-500 text-white',
    blue: 'bg-blue-500 text-white',
    orange: 'bg-orange-500 text-white',
    green: 'bg-emerald-500 text-white',
    purple: 'bg-purple-500 text-white',
    red: 'bg-red-500 text-white',
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PackageCard({
    title,
    images,
    duration,
    rating,
    reviewCount,
    itinerary,
    originalPrice,
    discountedPrice,
    inclusions = ['hotel', 'meals', 'cab', 'activities'],
    badge,
    onRequestCallback,
    onClick,
    className = '',
}: PackageCardProps) {
    const [activeImage, setActiveImage] = useState(0)
    const savings = originalPrice - discountedPrice

    return (
        <div className='relative group'>
            <Card
                asArticle
                variant="elevated"
                radius="xl"
                padding="none"
                className={`overflow-hidden w-full max-w-sm ${className}`}
                onClick={onClick}
            >
                {/* ── Image ── */}
                <CardMedia className="w-full aspect-3/2 rounded-t-xl ">
                    <Image
                        src={images[activeImage]}
                        alt={title}
                        fill
                        className="object-cover transition-opacity duration-500"
                        sizes="(max-width: 768px) 100vw, 384px "
                    />


                    {/* Expand icon */}
                    <button
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 z-10 flex items-center justify-center size-8 rounded-lg bg-neutral-900/20 text-white backdrop-blur-[1px] group-hover:bg-primary-500 transition"
                        aria-label="Expand image"
                    >
                        <ArrowsOutIcon weight="bold" className="size-4" />
                    </button>

                    {/* Image dots */}
                    {images.length > 1 && (
                        <ImageDots
                            total={images.length}
                            active={activeImage}
                            onSelect={setActiveImage}
                        />
                    )}

                    {/* Bottom gradient for dot readability */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
                </CardMedia>


                {/* ── Body ── */}
                <CardBody className="pt-3.5 pb-2">
                    {/* Title */}
                    <Heading level={3} weight='semibold' truncate={true}>
                        {title}
                    </Heading>

                    {/* Duration + Rating row */}
                    <div className="flex items-center justify-between mb-3 mt-1">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                            <CalendarDaysIcon className='size-4 text-(--text-muted)' />
                            <Text as='span' size='sm' intent='secondary' >
                                {duration}
                            </Text>

                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium text-neutral-700">
                            <StarIcon weight="fill" className="size-3.5 text-warning-500" />
                            <Text as='span' size='sm' weight='semibold' className='font-heading text-warning-500'>{rating.toFixed(1)}</Text>
                            <Text as='span' size='sm' intent='secondary'>({reviewCount})</Text>
                        </div>
                    </div>

                    {/* Itinerary */}
                    <div className="bg-linear-to-b from-primary-50 to-transparent rounded-lg px-3 py-2 mb-3">
                        <ItineraryRow items={itinerary} />
                    </div>

                    {/* Price row */}
                    <div className="flex items-center justify-between">

                        <div className='flex flex-col gap-0.5'>
                            <div className="flex items-center gap-5">
                                <Text as='span' weight='medium' intent='secondary' className='relative w-max px-1 after:absolute after:top-1/2 after:left-0 after:h-[0.1em] after:w-full after:bg-error-500 after:z-10 after:-translate-y-1/2'>
                                    {formatINR(originalPrice)}
                                </Text>

                                {savings > 0 && (
                                    <div className=" bg-success-200/80 px-1.5 py-2 leading-none relative">
                                        <div className="absolute h-full right-full top-0 translate-x-0.75">
                                            <svg width="8" className='h-full' viewBox="0 0 8 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M0.122702 2.76817L5.30177 0.391188L5.24993 5.18586L0.122702 2.76817Z" fill="#C8F9D8" />
                                                <path d="M0.0687989 7.97813L5.2477 5.60128L5.19619 10.3959L0.0687989 7.97813Z" fill="#C8F9D8" />
                                                <path d="M0.0168407 13.2093L5.15504 10.8L5.18508 15.5947L0.0168407 13.2093Z" fill="#C8F9D8" />
                                                <path d="M0.0687989 18.4127L5.2477 16.0358L5.19619 20.8305L0.0687989 18.4127Z" fill="#C8F9D8" />
                                                <path d="M0.0687989 23.63L5.2477 21.2531L5.19619 26.0478L0.0687989 23.63Z" fill="#C8F9D8" />
                                                <path d="M0.0687989 28.8473L5.2477 26.4704L5.19619 31.2651L0.0687989 28.8473Z" fill="#C8F9D8" />
                                            </svg>

                                        </div>
                                        <div className='absolute h-full left-full top-0 -translate-x-0.75'>
                                            <svg width="9" className='h-full' viewBox="0 0 9 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M7.96176 2.73853L1.9868 0.387159L2.04623 5.13042L7.96176 2.73853Z" fill="#C8F9D8" />
                                                <path d="M8.02133 7.89331L2.04637 5.54194L2.1058 10.2852L8.02133 7.89331Z" fill="#C8F9D8" />
                                                <path d="M8.08053 13.0683L2.15252 10.6849L2.11787 15.4282L8.08053 13.0683Z" fill="#C8F9D8" />
                                                <path d="M8.02133 18.2161L2.04637 15.8647L2.1058 20.608L8.02133 18.2161Z" fill="#C8F9D8" />
                                                <path d="M8.02133 23.3774L2.04637 21.0261L2.1058 25.7693L8.02133 23.3774Z" fill="#C8F9D8" />
                                                <path d="M8.02133 28.5386L2.04637 26.1872L2.1058 30.9305L8.02133 28.5386Z" fill="#C8F9D8" />
                                            </svg>

                                        </div>
                                        <span className='text-[11px] font-heading font-semibold text-success-600 h-max block'>Save {formatINR(savings)}</span>

                                    </div>
                                )}
                            </div>

                            <Text as='span' weight='bold' size='xl' className='font-heading px-1 relative z-10 after:absolute after:bottom-0 after:left-0 after:h-1.5  after:w-full after:bg-success-200/80 after:-z-10 w-max'>
                                {formatINR(discountedPrice)} 
                                <Text as='span' intent='secondary' className='font-body'>/Adult</Text>
                            </Text>

                        </div>


                        {/* Inclusions */}
                        <div className="flex items-center gap-2">
                            {inclusions.map((key) => {
                                const Icon = INCLUSION_ICONS[key]
                                return Icon ? (
                                    <Icon
                                        key={key}
                                        weight="fill"
                                        className="size-4.5 text-(--text-muted)"
                                        title={key}
                                    />
                                ) : null
                            })}
                        </div>
                    </div>
                </CardBody>

                {/* ── Footer: CTA ── */}
                <CardFooter className="pt-3 pb-4 px-4">
                    <div className="flex items-center gap-2">
                        {/* Phone icon button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onRequestCallback?.() }}
                            className="flex items-center justify-center size-11 rounded-xl border-[0.12em] border-primary-500 text-primary-500 hover:bg-primary-50 transition shrink-0"
                            aria-label="Call"
                        >
                            <PhoneIcon  className="size-4.5" />
                        </button>

                        {/* Request Callback */}
                        <Button
                            variant="premium"
                            size="md"
                            className="flex-1 rounded-xl font-bold text-sm py-3"
                            onClick={(e) => { e.stopPropagation(); onRequestCallback?.() }}
                        >
                            Request Callback
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            {badge && (
                <div className="absolute top-7 left-0 z-10 flex flex-col gap-1.5">
                    <div className="relative -translate-x-4 ">
                        <span className={`text-sm font-medium pl-6 px-4 py-2 rounded-e-pill leading-none bg-primary-500 text-white`}>
                            {badge}
                        </span>
                        <div className="absolute  top-full left-0 translate-y-1.25">
                            <div className="w-0 h-0 border-primary-800 border-l-transparent border-b-transparent border-8"></div>
                        </div>
                    </div>

                </div>

            )}
        </div>

    )
}