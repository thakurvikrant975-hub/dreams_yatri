// components/packages/PackageHero.tsx
// Package detail page — hero section with title, meta, inclusions, and photo grid
'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import Image from 'next/image'
import { ShareNetworkIcon, ImagesIcon, CarIcon, BedIcon, ForkKnifeIcon, BinocularsIcon } from '@phosphor-icons/react'
import { Heading, Text } from '@/app/components/ui/Typography';
import Breadcrumps from '@/app/components/ui/Breadcrumps';
import Button from '@/app/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────

interface ItineraryStop {
  days: number
  place: string
}

interface Inclusion {
  key: 'transfer' | 'stay' | 'breakfast' | 'sightseeing' | 'meals' | 'activities'
  label: string
}

interface PackageHeroProps {
  title: string
  duration: string           // e.g. "7D/6N"
  itinerary: ItineraryStop[]
  inclusions: Inclusion[]
  images: string[]           // first image = large hero, rest = grid
  region: { label: string, slug: string }
  onShare?: () => void
  onViewGallery?: () => void
}

// ─── Inclusion icon map ───────────────────────────────────────

const INCLUSION_ICONS: Record<Inclusion['key'], React.ElementType> = {
  transfer: CarIcon,
  stay: BedIcon,
  breakfast: ForkKnifeIcon,
  meals: ForkKnifeIcon,
  sightseeing: BinocularsIcon,
  activities: BinocularsIcon,
}

// ─── Component ────────────────────────────────────────────────

export default function PackageHero({
  title,
  duration,
  itinerary,
  inclusions,
  images,
  onShare,
  region,
  onViewGallery,
}: PackageHeroProps) {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [stuck, setStuck]           = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const infoRef     = useRef<HTMLDivElement>(null)

  const heroImage  = images[0]
  const gridImages = images.slice(1, 6)

  // Shadow: only while the info band is stuck at top
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const ob = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 },
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  // Publish info-band height so PackageTab can position itself below it
  useLayoutEffect(() => {
    const el = infoRef.current
    if (!el) return
    const update = () =>
      document.documentElement.style.setProperty(
        '--package-info-height',
        `${el.offsetHeight}px`,
      )
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <Breadcrumps
        cat={{ label: region.label, link: `/region/${region.slug}` }}
        title={title}
      />

      {/* Sentinel: exits viewport top exactly when the info band snaps sticky */}
      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      {/*
       * Sticky info band — title + duration + stops + inclusions.
       * Full-viewport-width background via the centered-container margin trick:
       *   calc(50% - 50vw) = -container-padding when inside a centered max-width block.
       */}
      <div
        ref={infoRef}
        className="sticky top-0 z-[210] bg-white"
        style={{
          marginLeft:  'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          boxShadow:   stuck ? '0 1px 3px 0 rgba(163,163,163,0.2)' : 'none',
          transition:  'box-shadow 0.2s ease',
        }}
      >
        {/* Re-constrain to container width */}
        <div
          className="mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-4"
          style={{ maxWidth: 'var(--max-width-container, 1400px)' }}
        >

          {/* ── Title ── */}
          <Heading level={1} weight="semibold">
            {title}
          </Heading>

          {/* ── Meta row: duration + itinerary stops ── */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="inline-flex items-center px-3 py-1.5 rounded-pill bg-white border border-neutral-200">
              <Text as="span" size="sm" weight="bold" intent="secondary">
                {duration}
              </Text>
            </span>

            <div className="h-6 w-px bg-(--border-muted)" />

            <div className="flex items-center gap-4 flex-wrap">
              {itinerary.map((stop, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Text as="span" size="3xl" intent="muted" weight="bold" className="leading-none font-heading">
                    {stop.days}
                  </Text>
                  <div className="flex flex-col leading-tight">
                    <Text as="span" size="xss" intent="secondary" weight="medium" className="font-medium font-heading tracking-wide">
                      Days in
                    </Text>
                    <Text as="span" size="sm" intent="primary" weight="semibold" className="font-heading">
                      {stop.place}
                    </Text>
                  </div>
                  {i < itinerary.length - 1 && (
                    <div className="ml-2 h-6 w-px bg-(--border-default)" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Inclusions + Share row ── */}
          <div className="flex items-center justify-between flex-wrap gap-3 mt-4">
            <div className="flex items-center gap-1 flex-wrap">
              <Text size="sm" weight="semibold" className="uppercase mr-2">
                Inclusion
              </Text>
              <div className="h-6 w-px bg-(--border-muted)" />
              {inclusions.map((inc) => {
                const Icon = INCLUSION_ICONS[inc.key]
                return (
                  <div
                    key={inc.key}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 text-sm"
                  >
                    <Icon weight="fill" className="size-5 text-muted shrink-0" />
                    <Text as="span" size="sm" intent="secondary">{inc.label}</Text>
                  </div>
                )
              })}
            </div>

            <Button onClick={onShare} variant="outline" size="sm">
              Share
              <ShareNetworkIcon weight="bold" className="size-4 text-muted" />
            </Button>
          </div>

        </div>
      </div>

      {/* ── Photo grid — not sticky, scrolls under the info band ── */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] md:h-[480px] rounded-2xl overflow-hidden mt-4">

        {/* Hero image — spans 2 rows on left */}
        <div className="col-span-2 row-span-2 relative group cursor-pointer">
          <Image
            src={heroImage}
            alt={title}
            fill
            className={[
              'object-cover transition-all duration-500',
              heroLoaded ? 'opacity-100' : 'opacity-0',
              'group-hover:scale-[1.02]',
            ].join(' ')}
            onLoad={() => setHeroLoaded(true)}
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {!heroLoaded && <div className="skeleton-box absolute inset-0" />}

          <button
            onClick={onViewGallery}
            className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/75 transition-colors"
          >
            <ImagesIcon weight="duotone" className="size-5" />
            View Gallery
          </button>
        </div>

        {/* Grid images — 2×2 on right */}
        {Array.from({ length: 4 }).map((_, i) => {
          const src = gridImages[i]
          return (
            <div key={i} className="relative group cursor-pointer overflow-hidden">
              {src ? (
                <Image
                  src={src}
                  alt={`${title} photo ${i + 2}`}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              ) : (
                <div className="skeleton-box absolute inset-0" />
              )}
            </div>
          )
        })}
      </div>

    </>
  )
}
