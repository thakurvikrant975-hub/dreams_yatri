// components/packages/PackageHero.tsx
// Package detail page — hero section with title, meta, inclusions, and photo grid
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ShareNetworkIcon, ImagesIcon, CarIcon, BedIcon, ForkKnifeIcon, BinocularsIcon } from '@phosphor-icons/react'
import { Heading, Text } from '@/app/components/ui/Typography'

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
  onShare?: () => void
  onViewGallery?: () => void
}

// ─── Inclusion icon map ───────────────────────────────────────

const INCLUSION_ICONS: Record<Inclusion['key'], React.ElementType> = {
  transfer:    CarIcon,
  stay:        BedIcon,
  breakfast:   ForkKnifeIcon,
  meals:       ForkKnifeIcon,
  sightseeing: BinocularsIcon,
  activities:  BinocularsIcon,
}

// ─── Component ────────────────────────────────────────────────

export default function PackageHero({
  title,
  duration,
  itinerary,
  inclusions,
  images,
  onShare,
  onViewGallery,
}: PackageHeroProps) {
  const [heroLoaded, setHeroLoaded] = useState(false)

  const heroImage = images[0]
  const gridImages = images.slice(1, 6) // up to 5 grid images

  return (
    <div className="w-full screen-space py-10">

      {/* ── Title ── */}
      <Heading level={1}>
        {title}
      </Heading>

      {/* ── Meta row: duration + itinerary stops ── */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {/* Duration pill */}
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-800 text-sm font-bold font-heading border border-neutral-200">
          {duration}
        </span>

        {/* Divider */}
        <div className="h-5 w-px bg-neutral-200" />

        {/* Itinerary stops */}
        <div className="flex items-center gap-4 flex-wrap">
          {itinerary.map((stop, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold text-neutral-900 leading-none font-heading">
                {stop.days}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">
                  Days in
                </span>
                <span className="text-sm font-semibold text-neutral-700">
                  {stop.place}
                </span>
              </div>
              {i < itinerary.length - 1 && (
                <div className="ml-2 h-4 w-px bg-neutral-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Inclusions + Share row ── */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mr-2">
            Inclusion
          </span>
          {inclusions.map((inc) => {
            const Icon = INCLUSION_ICONS[inc.key]
            return (
              <div
                key={inc.key}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-neutral-600 text-sm"
              >
                <Icon weight="duotone" className="size-4 text-neutral-500 shrink-0" />
                <span className="font-medium">{inc.label}</span>
              </div>
            )
          })}
        </div>

        {/* Share button */}
        <button
          onClick={onShare}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-neutral-200 bg-white text-neutral-700 text-sm font-medium hover:border-primary-300 hover:text-primary-600 transition-colors shadow-sm"
        >
          Share
          <ShareNetworkIcon weight="bold" className="size-4" />
        </button>
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


