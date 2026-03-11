'use client'

import React from 'react'
import Image from 'next/image'
import Card from '../ui/Card'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DestinationCardProps {
    name: string
    packageCount: number
    image: string
    /** Phosphor icon component — shown top-right */
    icon?: React.ElementType
    onClick?: () => void
    className?: string
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function DestinationCard({
    name,
    packageCount,
    image,
    icon: Icon,
    onClick,
    className = '',
}: DestinationCardProps) {
    return (
        <Card
            asArticle
            variant="elevated"
            radius="xl"
            padding="none"
            hoverable
            className={`overflow-hidden w-full aspect-3/4 cursor-pointer group ${className}`}
            onClick={onClick}
        >
            {/* ── Full-bleed image ── */}
            <div className="absolute inset-0">
                <Image
                    src={image}
                    alt={name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                />
                {/* Bottom gradient for text legibility */}
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
            </div>

            {/* ── Icon pill — top right ── */}
            {Icon && (
                <div className="absolute top-3 right-3 z-10 flex items-center justify-center size-9 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-sm">
                    <Icon weight="duotone" className="size-5" />
                </div>
            )}

            {/* ── Text — bottom left ── */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-8">
                <h3 className="font-heading font-bold text-white text-xl leading-tight">
                    {name}
                </h3>
                <p className="text-white/75 text-sm mt-0.5 font-medium">
                    {packageCount} Packages
                </p>
            </div>
        </Card>
    )
}