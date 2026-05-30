'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { XIcon, ImagesIcon } from '@phosphor-icons/react'
import { cn } from '@/app/lib/utils'
import ImageLightbox from './ImageLightbox'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GalleryImg = { src: string; label: string }

export type GalleryCategory = {
    label: string
    images: GalleryImg[]
}

// ─── Image cell ───────────────────────────────────────────────────────────────

function ImageCell({ image, onClick }: { image: GalleryImg; onClick: () => void }) {
    return (
        <div className="relative aspect-4/3 rounded-xl overflow-hidden cursor-pointer group" onClick={onClick}>
            <Image
                src={image.src}
                alt={image.label}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {image.label && (
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2.5 py-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white font-medium leading-tight truncate">{image.label}</p>
                </div>
            )}
        </div>
    )
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

interface FullGalleryProps {
    categories: GalleryCategory[]
    title: string
    initialLightbox?: { catIdx: number; imgIdx: number }
    onClose: () => void
}

export default function FullGallery({ categories, title, initialLightbox, onClose }: FullGalleryProps) {
    const [activeCat, setActiveCat] = useState<number | -1>(-1)
    const [lightbox, setLightbox]   = useState<{ images: GalleryImg[]; idx: number } | null>(
        initialLightbox != null
            ? { images: categories[initialLightbox.catIdx]?.images ?? [], idx: initialLightbox.imgIdx }
            : null,
    )

    const handleNavigate = useCallback((idx: number) => {
        setLightbox(prev => prev ? { ...prev, idx } : null)
    }, [])

    // Lock body scroll for the gallery grid itself
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !lightbox) onClose() }
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = ''
        }
    }, [lightbox, onClose])

    const totalImages = categories.reduce((s, c) => s + c.images.length, 0)

    return (
        <div className="fixed inset-0 z-9999 bg-white flex flex-col">

            {/* Header */}
            <div className="shrink-0 border-b border-neutral-200">
                <div className="screen-space flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <ImagesIcon weight="duotone" className="size-5 text-muted shrink-0" />
                        <span className="text-sm font-semibold text-primary truncate">{title}</span>
                        <span className="text-xs text-muted shrink-0">({totalImages} photos)</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="shrink-0 ml-4 size-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-secondary transition-colors"
                    >
                        <XIcon weight="bold" className="size-4" />
                    </button>
                </div>
            </div>

            {/* Category tabs */}
            <div className="shrink-0 border-b border-neutral-100">
            <div className="screen-space flex gap-1.5 overflow-x-auto py-2.5 scrollbar-none">
                <button
                    onClick={() => setActiveCat(-1)}
                    className={cn(
                        'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                        activeCat === -1
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-100 text-secondary hover:bg-neutral-200',
                    )}
                >
                    All
                    <span className="ml-1 text-[11px] opacity-60">({totalImages})</span>
                </button>
                {categories.map((cat, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveCat(i)}
                        className={cn(
                            'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                            activeCat === i
                                ? 'bg-neutral-900 text-white'
                                : 'bg-neutral-100 text-secondary hover:bg-neutral-200',
                        )}
                    >
                        {cat.label}
                        <span className="ml-1 text-[11px] opacity-60">({cat.images.length})</span>
                    </button>
                ))}
            </div>
            </div>

            {/* Image grid */}
            <div className="flex-1 overflow-y-auto">
                <div className="screen-space py-5">
                    {activeCat === -1 ? (
                        <div className="space-y-8">
                            {categories.map((cat, catIdx) =>
                                cat.images.length > 0 ? (
                                    <div key={catIdx}>
                                        <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-3">
                                            {cat.label}
                                            <span className="font-normal normal-case tracking-normal opacity-70 ml-1">
                                                ({cat.images.length})
                                            </span>
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {cat.images.map((img, imgIdx) => (
                                                <ImageCell
                                                    key={imgIdx}
                                                    image={img}
                                                    onClick={() => setLightbox({ images: cat.images, idx: imgIdx })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : null
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {categories[activeCat].images.map((img, imgIdx) => (
                                <ImageCell
                                    key={imgIdx}
                                    image={img}
                                    onClick={() =>
                                        setLightbox({ images: categories[activeCat].images, idx: imgIdx })
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox (on top of gallery) */}
            {lightbox && (
                <ImageLightbox
                    images={lightbox.images}
                    activeIdx={lightbox.idx}
                    onClose={() => setLightbox(null)}
                    onNavigate={handleNavigate}
                />
            )}
        </div>
    )
}
