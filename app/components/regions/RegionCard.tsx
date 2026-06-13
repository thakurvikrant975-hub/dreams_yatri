'use client'

import Image from 'next/image'
import { MapPinIcon, ArrowRightIcon } from '@phosphor-icons/react'

export interface RegionCardProps {
  name: string
  packageCount: number
  image: string
  country?: string
  className?: string
}

export default function RegionCard({
  name,
  packageCount,
  image,
  country,
  className = '',
}: RegionCardProps) {
  return (
    <article
      className={`group rounded-2xl overflow-hidden bg-white border border-neutral-100 shadow-sm hover:shadow-lg transition-all duration-300 ${className}`}
    >
      {/* Landscape image */}
      <div className="relative w-full aspect-video overflow-hidden">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
        />

        {/* Top-right scrim so the badge stays readable */}
        <div className="absolute inset-0 bg-linear-to-bl from-black/30 via-transparent to-transparent" />

        {/* Package count badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-sm text-white text-xs font-semibold tracking-wide">
          {packageCount}
          <span className="font-normal opacity-80">pkg{packageCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Info panel */}
      <div className="px-4 py-3.5 flex items-center gap-3">
        {/* Pin icon */}
        <div className="shrink-0 size-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <MapPinIcon weight="duotone" className="size-4 text-primary" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-neutral-800 text-sm leading-snug truncate">{name}</p>
          {country && country !== 'India' ? (
            <p className="text-xs text-neutral-400 mt-0.5 truncate">{country}</p>
          ) : (
            <p className="text-xs text-neutral-400 mt-0.5">{packageCount} package{packageCount !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Arrow */}
        <div className="shrink-0 size-7 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 group-hover:border-primary group-hover:text-primary group-hover:bg-primary/5 transition-all duration-200 group-hover:translate-x-0.5">
          <ArrowRightIcon className="size-3.5" />
        </div>
      </div>
    </article>
  )
}
