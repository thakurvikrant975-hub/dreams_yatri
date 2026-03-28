// components/packages/PackageHero.tsx
// Package detail page — hero section with title, meta, inclusions, and photo grid
'use client'

import { useState } from 'react'
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

  const heroImage = images[0]
  const gridImages = images.slice(1, 6) // up to 5 grid images

  return (
    <div className="w-full ">
      <Breadcrumps
        cat={{ label: region.label , link: `/region/${region.slug}` }}
        title={title}
      />

      {/* ── Title ── */}
      <Heading level={1} weight='semibold'>
        {title}
      </Heading>

      {/* ── Meta row: duration + itinerary stops ── */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {/* Duration pill */}
        <span className="inline-flex items-center px-3 py-1.5 rounded-pill bg-white border border-neutral-200">
          <Text as='span' size='sm' weight='bold' intent='secondary'>
            {duration}
          </Text>
        </span>

        {/* Divider */}
        <div className="h-6 w-px bg-(--border-muted)" />

        {/* Itinerary stops */}
        <div className="flex items-center gap-4 flex-wrap">
          {itinerary.map((stop, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Text as='span' size='3xl' intent='muted' weight='bold' className=" leading-none font-heading">
                {stop.days}
              </Text>
              <div className="flex flex-col leading-tight">
                <Text as='span' size='xss' intent='secondary' weight='medium' className="font-medium font-heading tracking-wide">
                  Days in
                </Text>
                <Text as='span' size='sm' intent='primary' weight='semibold' className="font-heading">
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
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3 mt-4">
        <div className="flex items-center gap-1 flex-wrap">
          <Text size='sm' weight='semibold' className="uppercase mr-2">
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
                <Icon weight='fill' className="size-5 text-muted shrink-0" />
                <Text as='span' size='sm' intent='secondary' >{inc.label}</Text>
              </div>
            )
          })}
        </div>

        {/* Share button */}
        <Button
          onClick={onShare}
          variant='outline'
          size='sm'
        >
          Share
          <ShareNetworkIcon weight="bold" className="size-4 text-muted" />
        </Button>
      </div>

      {/* ── Photo grid ── */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] md:h-[480px] rounded-2xl overflow-hidden">

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

          {/* View Gallery overlay */}
          <button
            onClick={onViewGallery}
            className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/75 transition-colors"
          >
            <ImagesIcon weight="bold" className="size-4" />
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

    </div>
  )
}


