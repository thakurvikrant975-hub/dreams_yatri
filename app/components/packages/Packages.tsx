'use client'

import React, { useState, useRef, useLayoutEffect } from 'react'
import Image from 'next/image'
import { Card, CardMedia, CardBody } from '../ui/Card'
import { Heading, Text } from '../ui/Typography'
import {
    BedIcon,
    ForkKnifeIcon,
    CarIcon,
    StarIcon,
    CheckIcon,
} from '@phosphor-icons/react'
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid'
import SavingsBadge from './SavingBadge'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Itinerary {
    days: number
    place: string
}

export interface PackageCardProps {
    title: string
    images: string[]
    duration: string
    rating?: number
    reviewCount?: number
    itinerary: Itinerary[]
    originalPrice: number
    /** Per-adult price at `pricedForAdults` occupancy — the highlighted figure. */
    discountedPrice: number
    /** Full trip total at `pricedForAdults` occupancy, shown beneath the per-adult
     *  figure. Omit to show only the per-adult line. */
    totalPrice?: number
    /** How many adults the prices are quoted for (default 2). */
    pricedForAdults?: number
    /** Show the "Starting from" caption — the price is the package's cheapest
     *  duration rather than a fixed one. */
    startingFrom?: boolean
    inclusions?: Array<'hotel' | 'meals' | 'cab' | 'activities'>
    /** Short inclusion lines e.g. "2 Nights Stay", "3 Activities" — the detail
     *  that makes a card feel concrete rather than just a price. */
    highlights?: string[]
    /** Category badge shown top-left on image e.g. "Honeymoon", "Friends" */
    badge?: string
    /** Color theme for the badge */
    badgeColor?: 'teal' | 'blue' | 'orange' | 'green' | 'purple' | 'red'
    /** Secondary offer tag shown below badge e.g. "Best Offer" */
    offerTag?: string
    /** Set true only for cards above the fold (first ~3) so their image gets LCP priority */
    isPriority?: boolean
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
    }).format(Math.ceil(amount))
}

const INCLUSION_ICONS: Record<string, React.ElementType> = {
    hotel: BedIcon,
    meals: ForkKnifeIcon,
    cab: CarIcon,
    activities: StarIcon,
}

const INCLUSION_LABELS: Record<string, string> = {
    hotel: 'Hotel',
    meals: 'Meals',
    cab: 'Transfer',
    activities: 'Activities',
}

// ─── Itinerary tag list ───────────────────────────────────────────────────────
function ItineraryRow({ items }: { items: Itinerary[] }) {
    const outerRef = useRef<HTMLDivElement>(null)
    const [visibleCount, setVisibleCount] = useState(items.length)

    // Measure which items fit in a single row using a hidden ghost row
    useLayoutEffect(() => {
        const outer = outerRef.current
        if (!outer) return

        const calc = () => {
            const W = outer.offsetWidth
            const spans = Array.from(outer.querySelectorAll<HTMLElement>('[data-g]'))
            const badge = outer.querySelector<HTMLElement>('[data-gb]')
            if (!spans.length) return

            const GAP = 4 // gap-x-1 = 4px
            const badgeW = (badge?.offsetWidth ?? 28) + GAP

            let used = 0
            let fit = 0
            for (let i = 0; i < spans.length; i++) {
                const w = spans[i].offsetWidth + (i > 0 ? GAP : 0)
                const hasMore = i < spans.length - 1
                if (used + w + (hasMore ? badgeW : 0) <= W) {
                    used += w
                    fit = i + 1
                } else break
            }
            setVisibleCount(Math.max(fit, 1))
        }

        calc()
        const ro = new ResizeObserver(calc)
        ro.observe(outer)
        return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.length])

    const overflow = items.length - visibleCount

    return (
        <div ref={outerRef} className="relative overflow-hidden">
            {/* Ghost row — all items, invisible, for width measurement */}
            <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 flex items-center gap-x-1 opacity-0 pointer-events-none select-none"
            >
                {items.map((item, i) => (
                    <span key={i} data-g className="shrink-0 whitespace-nowrap text-sm font-semibold font-heading">
                        {item.days}D{' '}
                        <span className="font-normal">{item.place}</span>
                        {i < items.length - 1 && <span className="mx-0.5 text-neutral-400">•</span>}
                    </span>
                ))}
                <span data-gb className="shrink-0 text-xs font-semibold whitespace-nowrap">
                    +{items.length}
                </span>
            </div>

            {/* Visible row */}
            <div className="flex items-center gap-x-1">
                {items.slice(0, visibleCount).map((item, i) => {
                    const showBullet = i < visibleCount - 1 || overflow > 0
                    return (
                        <span key={i} className="shrink-0 whitespace-nowrap">
                            <Text as='span' size='sm' weight='semibold' className='font-heading'>{item.days}D</Text>
                            {' '}
                            <Text as='span' size='sm' intent='secondary'>{item.place}</Text>
                            {showBullet && <span className="mx-0.5 text-neutral-400 select-none">•</span>}
                        </span>
                    )
                })}
                {overflow > 0 && (
                    <span className="shrink-0 text-xs font-semibold text-primary-500 whitespace-nowrap">
                        +{overflow}
                    </span>
                )}
            </div>
        </div>
    )
}

// ─── Dots ─────────────────────────────────────────────────────────────────────
function ImageDots({ total, active, onSelect }: { total: number; active: number; onSelect: (i: number) => void }) {
    return (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 pointer-events-auto" role="tablist" aria-label="Package images">
            {Array.from({ length: total }).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-label={`Image ${i + 1}`}
                    aria-selected={i === active}
                    onClick={e => { e.stopPropagation(); onSelect(i) }}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                        i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
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

// Darker shade for the little folded-corner triangle under each badge.
const BADGE_FOLD: Record<string, string> = {
    teal: 'border-teal-700',
    blue: 'border-blue-700',
    orange: 'border-orange-700',
    green: 'border-emerald-700',
    purple: 'border-purple-700',
    red: 'border-red-700',
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
    totalPrice,
    pricedForAdults = 2,
    startingFrom = true,
    inclusions = [],
    highlights = [],
    isPriority = false,
    badge,
    badgeColor = 'red',
    onRequestCallback,
    onClick,
    className = '',
}: PackageCardProps) {
    const [activeImage, setActiveImage] = useState(0)
    const touchStartX = useRef(0)
    const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
    const savings = originalPrice - discountedPrice
    // Percentage reads better than an absolute amount on a "starting from"
    // figure, where the rupee saving changes with occupancy but the offer doesn't.
    const savingsPct = originalPrice > 0 && savings > 0
        ? Math.round((savings / originalPrice) * 100)
        : 0

    function startAutoSlide() {
        if (images.length <= 1) return
        setActiveImage(i => (i + 1) % images.length)
        intervalRef.current = setInterval(() => {
            setActiveImage(i => (i + 1) % images.length)
        }, 1500)
    }
    function stopAutoSlide() {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }

    function prev(e: React.MouseEvent) {
        e.stopPropagation()
        setActiveImage(i => (i - 1 + images.length) % images.length)
    }
    function next(e: React.MouseEvent) {
        e.stopPropagation()
        setActiveImage(i => (i + 1) % images.length)
    }
    function onTouchStart(e: React.TouchEvent) {
        touchStartX.current = e.touches[0].clientX
    }
    function onTouchEnd(e: React.TouchEvent) {
        const delta = touchStartX.current - e.changedTouches[0].clientX
        if (delta > 40)       setActiveImage(i => (i + 1) % images.length)
        else if (delta < -40) setActiveImage(i => (i - 1 + images.length) % images.length)
    }

    return (
        <div className='relative group' onMouseEnter={startAutoSlide} onMouseLeave={stopAutoSlide}>
            <Card
                asArticle
                variant="elevated"
                radius="xl"
                padding="none"
                className={`group overflow-hidden w-full max-w-sm ${className}`}
                onClick={onClick}
            >
                {/* ── Image slider ── */}
                <CardMedia className="w-full aspect-video rounded-t-xl">
                  <div
                    className="absolute inset-0"
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                  >
                    {/* Slides — each absolutely positioned, shifted by transform */}
                    {images.map((src, i) => (
                        <div
                            key={i}
                            className="absolute inset-0 transition-transform duration-300 ease-out"
                            style={{ transform: `translateX(${(i - activeImage) * 100}%)` }}
                        >
                            <Image
                                src={src}
                                alt={`${title} — image ${i + 1}`}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 384px"
                                priority={i === 0 && isPriority}
                            />
                        </div>
                    ))}

                    {/* Bottom gradient */}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/40 to-transparent pointer-events-none z-10" />

                    {/* Prev / Next arrows — visible on group-hover (desktop) */}
                    {images.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={prev}
                                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 size-7 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
                                aria-label="Previous image"
                            >
                                <ChevronLeftIcon className="size-4" />
                            </button>
                            <button
                                type="button"
                                onClick={next}
                                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 size-7 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/60"
                                aria-label="Next image"
                            >
                                <ChevronRightIcon className="size-4" />
                            </button>
                        </>
                    )}

                    {/* Dots */}
                    {images.length > 1 && (
                        <ImageDots total={images.length} active={activeImage} onSelect={setActiveImage} />
                    )}
                  </div>
                </CardMedia>


                {/* ── Body ── */}
                <CardBody className="py-3.5 pb-6">
                    {/* Title */}
                    <Heading level={3} weight='semibold' truncate={true} className='cursor-pointer hover:text-primary-500!'>
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
                        {rating != null && (
                            <div className="flex items-center gap-1 text-xs font-medium text-neutral-700">
                                <StarIcon weight="fill" className="size-3.5 text-warning-500" />
                                <Text as='span' size='sm' weight='semibold' className='font-heading text-warning-500'>{rating.toFixed(1)}</Text>
                                {reviewCount != null && reviewCount > 0 && (
                                    <Text as='span' size='sm' intent='secondary'>({reviewCount})</Text>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Itinerary */}
                    <div className="bg-linear-to-b from-primary-50 to-transparent rounded-lg px-3 py-2 mb-3">
                        <ItineraryRow items={itinerary} />
                    </div>

                    {/* What's included — short, scannable lines. Only rendered
                        for facts the priced itinerary actually supports.
                        Height is reserved for two lines regardless of content:
                        cards narrow (listing page, which has a filter sidebar)
                        wrap three highlights onto a second line while wider
                        ones don't, and without a fixed height that difference
                        pushes the price row out of alignment across a grid. */}
                    <ul className="flex flex-wrap content-start items-center gap-x-3 gap-y-1 mb-3 min-h-9">
                        {highlights.map((h) => (
                            <li key={h} className="flex items-center gap-1.5">
                                <CheckIcon weight="bold" aria-hidden="true" className="size-3 text-success-600 shrink-0" />
                                <Text as="span" size="xs" intent="secondary">{h}</Text>
                            </li>
                        ))}
                    </ul>

                    {/* Price row */}
                    <div className="flex items-center justify-between">

                        <div className='flex flex-col gap-0.5'>
                            {savingsPct > 0 && (
                                <div className="flex items-center gap-5">
                                    <Text as='span' weight='medium' intent='secondary' className='relative w-max px-1 after:absolute after:top-1/2 after:left-0 after:h-[0.1em] after:w-full after:bg-error-500 after:z-10 after:-translate-y-1/2'>
                                        {formatINR(originalPrice)}
                                    </Text>
                                    <SavingsBadge amount={`${savingsPct}%`} />
                                </div>
                            )}

                            {startingFrom && (
                                <Text as='span' size='xs' intent='muted' className='px-1'>
                                    Starting from
                                </Text>
                            )}

                            <Text as='span' weight='bold' size='xl' className='font-heading px-1 relative z-10 after:absolute after:bottom-0 after:left-0 after:h-1.5  after:w-full after:bg-success-200/80 after:-z-10 w-max'>
                                {formatINR(discountedPrice)}
                                <Text as='span' intent='secondary' className='font-body'>/Adult</Text>
                            </Text>

                            {totalPrice != null && totalPrice > 0 && (
                                <Text as='span' size='xs' intent='secondary' className='px-1'>
                                    {formatINR(totalPrice)} total for {pricedForAdults} adult{pricedForAdults !== 1 ? 's' : ''}
                                </Text>
                            )}

                        </div>


                        {/* Inclusions */}
                        {inclusions.length > 0 && (
                            <div className="flex items-center gap-2" aria-label="Inclusions">
                                {inclusions.map((key) => {
                                    const Icon = INCLUSION_ICONS[key]
                                    const label = INCLUSION_LABELS[key] ?? key
                                    return Icon ? (
                                        <span key={key} title={label} aria-label={label}>
                                            <Icon weight="fill" aria-hidden="true" className="size-4.5 text-(--text-muted)" />
                                        </span>
                                    ) : null
                                })}
                            </div>
                        )}
                    </div>
                </CardBody>

            </Card>

            {badge && (
                <div className="absolute top-7 left-0 z-10 flex flex-col gap-1.5">
                    <div className="relative -translate-x-4 ">
                        <span className={`text-sm font-medium pl-6 px-4 py-2 rounded-e-pill leading-none ${BADGE_COLORS[badgeColor] ?? BADGE_COLORS.red}`}>
                            {badge}
                        </span>
                        <div className="absolute  top-full left-0 translate-y-1.25">
                            <div className={`w-0 h-0 ${BADGE_FOLD[badgeColor] ?? BADGE_FOLD.red} border-l-transparent border-b-transparent border-8`}></div>
                        </div>
                    </div>

                </div>

            )}
        </div>

    )
}