'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ImagesIcon, CarIcon, BedIcon, ForkKnifeIcon, BinocularsIcon } from '@phosphor-icons/react'
import { Heading, Text } from '@/app/components/ui/Typography'
import Breadcrumps from '@/app/components/ui/Breadcrumps'
import FullGallery, { type GalleryCategory } from './FullGallery'

interface ItineraryStop {
  days: number
  place: string
}

interface Inclusion {
  key: 'transfer' | 'stay' | 'breakfast' | 'sightseeing' | 'meals' | 'activities'
  label: string
}

interface GalleryImage {
  src: string
  fullSrc?: string
  label: string
}

interface PackageHeroProps {
  title: string
  duration: string
  itinerary: ItineraryStop[]
  inclusions: Inclusion[]
  images: GalleryImage[]
  fullGallery: GalleryCategory[]
  region: { label: string; slug: string }
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
  fullGallery,
  region,
}: PackageHeroProps) {
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [stuck, setStuck]           = useState(false)
  const [galleryOpen, setGalleryOpen]       = useState(false)
  const [initialLightbox, setInitialLightbox] = useState<{ catIdx: number; imgIdx: number } | undefined>()
  const sentinelRef = useRef<HTMLDivElement>(null)

  const heroImage  = images[0]
  const gridImages = images.slice(1, 5)

  // catIdx 0 = first category (always "Gallery" / overview images)
  const openGallery = useCallback((lightbox?: { catIdx: number; imgIdx: number }) => {
    setInitialLightbox(lightbox)
    setGalleryOpen(true)
  }, [])

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
      {galleryOpen && (
        <FullGallery
          categories={fullGallery}
          title={title}
          initialLightbox={initialLightbox}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      <Breadcrumps
        cat={{ label: region.label, link: `/region/${region.slug}` }}
        title={title}
      />

      <div ref={sentinelRef} className="h-0" aria-hidden="true" />

      {/* ── Sticky info band ── */}
      <div
        id="package-info-band"
        className="sticky top-0 z-205 bg-white"
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

          <div className="flex items-center gap-3 sm:gap-4 mt-2 overflow-x-auto scrollbar-none">
            <span className="inline-flex shrink-0 items-center px-3 py-1.5 rounded-pill bg-white border border-neutral-200">
              <Text as="span" size="sm" weight="bold" intent="secondary">
                {duration}
              </Text>
            </span>

            <div className="h-6 w-px shrink-0 bg-(--border-muted)" />

            <div className="flex items-center gap-3 sm:gap-4">
              {itinerary.map((stop, i) => (
                <div key={i} className="flex items-center gap-1.5 shrink-0">
                  <Text as="span" intent="muted" weight="bold" className="leading-none font-heading text-xl sm:text-3xl">
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
                    <div className="ml-2 h-6 w-px shrink-0 bg-(--border-default)" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Inclusions ── */}
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

      {/* ── Mobile photo layout ── */}
      <div className="md:hidden mt-2 flex flex-col gap-2">
        <div
          className="relative w-full aspect-4/3 rounded-2xl overflow-hidden group cursor-pointer"
          onClick={() => openGallery()}
        >
          <Image
            src={heroImage.src}
            alt={heroImage.label || title}
            fill
            className={[
              'object-cover transition-all duration-500',
              heroLoaded ? 'opacity-100' : 'opacity-0',
              'group-hover:scale-[1.02]',
            ].join(' ')}
            onLoad={() => setHeroLoaded(true)}
            priority
            sizes="100vw"
          />
          {!heroLoaded && <div className="skeleton-box absolute inset-0" />}
          <button
            onClick={e => { e.stopPropagation(); openGallery() }}
            className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/75 transition-colors"
          >
            <ImagesIcon weight="duotone" className="size-5" />
            View Gallery
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => {
            const img = gridImages[i]
            return (
              <div
                key={i}
                className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
                onClick={() => img && openGallery({ catIdx: 0, imgIdx: i + 1 })}
              >
                {img ? (
                  <>
                    <Image
                      src={img.src}
                      alt={img.label || `${title} photo ${i + 2}`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      sizes="50vw"
                    />
                    {img.label && (
                      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-neutral-900 via-neutral-900/60 to-transparent px-2.5 py-2 pt-5">
                        <p className="text-sm text-white font-medium leading-tight truncate">{img.label}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="skeleton-box absolute inset-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Desktop photo grid ── */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-120 rounded-2xl overflow-hidden mt-2">

        <div
          className="col-span-2 row-span-2 relative group cursor-pointer"
          onClick={() => openGallery()}
        >
          <Image
            src={heroImage.src}
            alt={heroImage.label || title}
            fill
            className={[
              'object-cover transition-all duration-500',
              heroLoaded ? 'opacity-100' : 'opacity-0',
              'group-hover:scale-[1.02]',
            ].join(' ')}
            onLoad={() => setHeroLoaded(true)}
            priority
            sizes="50vw"
          />
          {!heroLoaded && <div className="skeleton-box absolute inset-0" />}

          <button
            onClick={e => { e.stopPropagation(); openGallery() }}
            className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/75 transition-colors"
          >
            <ImagesIcon weight="duotone" className="size-5" />
            View Gallery
          </button>
        </div>

        {Array.from({ length: 4 }).map((_, i) => {
          const img = gridImages[i]
          return (
            <div
              key={i}
              className="relative group cursor-pointer overflow-hidden"
              onClick={() => img && openGallery({ catIdx: 0, imgIdx: i + 1 })}
            >
              {img ? (
                <>
                  <Image
                    src={img.src}
                    alt={img.label || `${title} photo ${i + 2}`}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    sizes="25vw"
                  />
                  {img.label && (
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2.5 py-2 pt-6">
                      <p className="text-sm text-white font-medium leading-tight truncate">{img.label}</p>
                    </div>
                  )}
                </>
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
