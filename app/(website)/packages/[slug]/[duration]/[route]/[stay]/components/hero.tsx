'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { ImagesIcon, CarIcon, BedIcon, ForkKnifeIcon, BinocularsIcon } from '@phosphor-icons/react'
import { Heading, Text } from '@/app/components/ui/Typography';
import Breadcrumps from '@/app/components/ui/Breadcrumps';

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
  duration: string
  itinerary: ItineraryStop[]
  inclusions: Inclusion[]
  images: string[]
  region: { label: string; slug: string }
  onViewGallery?: () => void
}

const INCLUSION_ICONS: Record<Inclusion['key'], React.ElementType> = {
  transfer:    CarIcon,
  stay:        BedIcon,
  breakfast:   ForkKnifeIcon,
  meals:       ForkKnifeIcon,
  sightseeing: BinocularsIcon,
  activities:  BinocularsIcon,
}

export default function PackageHero({
  title,
  duration,
  itinerary,
  inclusions,
  images,
  region,
  onViewGallery,
}: PackageHeroProps) {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [stuck, setStuck]           = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const heroImage  = images[0]
  const gridImages = images.slice(1, 6)

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

  return (
    <>
      <Breadcrumps
        cat={{ label: region.label, link: `/region/${region.slug}` }}
        title={title}
      />

      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      {/* ── Sticky info band: title + duration + stops + share ── */}
      <div
        id="package-info-band"
        className="sticky top-0 z-210 bg-white"
        style={{
          marginLeft:  'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
          boxShadow:   stuck ? '0 1px 3px 0 rgba(163,163,163,0.2)' : 'none',
          transition:  'box-shadow 0.2s ease',
        }}
      >
        <div
          className="mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-4"
          style={{ maxWidth: 'var(--max-width-container, 1400px)' }}
        >
          <Heading level={1} weight="semibold">
            {title}
          </Heading>

          {/* Duration + stops */}
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
        </div>
      </div>

      {/* ── Inclusions — normal flow, scrolls away ── */}
      <div className="flex items-center gap-1 flex-wrap mt-3 mb-1">
        <Text size="sm" weight="semibold" className="uppercase mr-2">
          Inclusion
        </Text>
        <div className="h-6 w-px bg-(--border-muted) mr-1" />
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

      {/* ── Photo grid — scrolls under the sticky band ── */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px] md:h-[480px] rounded-2xl overflow-hidden mt-2">

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
