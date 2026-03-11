'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Card, CardMedia, CardBody, CardFooter } from '../ui/Card'
import Button from '../ui/Button'
import { Heading } from '../ui/Typography'
import {
    BedIcon,
    ForkKnifeIcon,
    CarIcon,
    StarIcon,
    ArrowsOutIcon,
    PhoneIcon,
} from '@phosphor-icons/react'

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
                        <span className="font-bold text-neutral-900">{item.days}D</span>{' '}
                        {item.place}
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
    badgeColor = 'teal',
    offerTag,
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
                <CardMedia className="w-full aspect-3/2 rounded-t-xl">
                    <Image
                        src={images[activeImage]}
                        alt={title}
                        fill
                        className="object-cover transition-opacity duration-500"
                        sizes="(max-width: 768px) 100vw, 384px"
                    />


                    {/* Expand icon */}
                    <button
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 right-3 z-10 flex items-center justify-center size-8 rounded-lg bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition"
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
                    <Heading level={3} weight='semibold' className='group-hover:text-primary-500'>
                        {title}
                    </Heading>

                    {/* Duration + Rating row */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                            {/* Calendar icon inline SVG — avoids extra import */}
                            <svg className="size-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
                                <path d="M1.5 6.5h13M5 1v3M11 1v3" strokeLinecap="round" />
                            </svg>
                            {duration}
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium text-neutral-700">
                            <StarIcon weight="fill" className="size-3.5 text-amber-400" />
                            <span className="font-bold">{rating.toFixed(1)}</span>
                            <span className="text-neutral-400">({reviewCount})</span>
                        </div>
                    </div>

                    {/* Itinerary */}
                    <div className="bg-linear-to-b from-primary-50 to-transparent rounded-lg px-3 py-2 mb-3">
                        <ItineraryRow items={itinerary} />
                    </div>

                    {/* Price row */}
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-neutral-400 line-through leading-none">
                                {formatINR(originalPrice)}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold font-heading text-neutral-900 leading-none">
                                    {formatINR(discountedPrice)}
                                </span>
                                {savings > 0 && (
                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full leading-none">
                                        Save {formatINR(savings)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Inclusions */}
                        <div className="flex items-center gap-2">
                            {inclusions.map((key) => {
                                const Icon = INCLUSION_ICONS[key]
                                return Icon ? (
                                    <Icon
                                        key={key}
                                        weight="duotone"
                                        className="size-4.5 text-neutral-400"
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
                            className="flex items-center justify-center size-11 rounded-xl border-2 border-primary-500 text-primary-500 hover:bg-primary-50 transition shrink-0"
                            aria-label="Call"
                        >
                            <PhoneIcon weight="fill" className="size-4.5" />
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