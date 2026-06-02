'use client'

import React from 'react'
import Image from 'next/image'
import Card from '../ui/Card'
import { Heading, Text } from '../ui/Typography'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DestinationCardProps {
    name: string
    packageCount: number
    image: string
    region?: string
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
    region,
    icon: Icon,
    onClick,
    className = '',
}: DestinationCardProps) {
    return (
        <div className="w-full relative">
            <div className="absolute h-full w-1/5 right-0 top-0 flex items-center">
              <div className="h-[80%] flex-1 bg-neutral-400/45 rounded-e-xl"></div>
              <div className="h-[60%] flex-1 bg-neutral-300/80 rounded-e-xl"></div>
              <div className="h-[40%] flex-1 bg-neutral-200/75 rounded-e-xl"></div>
            </div>
            <Card
                asArticle
                variant="elevated"
                radius="xl"
                padding="none"
                className={`overflow-hidden w-4/5 aspect-3/4 cursor-pointer group  ${className}`}
                onClick={onClick}
            >

                {/* ── Full-bleed image ── */}
                <div className="absolute inset-0">
                    <Image
                        src={image}
                        alt={name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
                    />
                    {/* Bottom gradient for text legibility */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
                </div>

                {/* ── Icon pill — top right ── */}
                {Icon && (
                    <div className="absolute top-3 right-3 z-10 flex items-center justify-center size-9 rounded-xl bg-neutral-900/20 backdrop-blur-[1px]  text-neutral-100 shadow-sm">
                        <Icon weight="duotone" className="size-5" />
                    </div>
                )}

                {/* ── Text — bottom left ── */}
                <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-4 pt-8">
                    {region && (
                        <span className="inline-flex items-center mb-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-white/15 backdrop-blur-sm text-white/90 border border-white/20">
                            {region}
                        </span>
                    )}
                    <Heading level={3} weight='semibold' intent='inverse'>
                        {name}
                    </Heading>
                    <Text size='sm' intent='muted'>
                        {packageCount} Packages
                    </Text>
                </div>
            </Card>
        </div>
    )
}