'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { XIcon, ImagesIcon } from '@phosphor-icons/react'
import { Dialog, VisuallyHidden } from 'radix-ui'
import { cn } from '@/app/lib/utils'
import { Card } from '@/app/components/ui/Card'
import ImageLightbox from './ImageLightbox'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GalleryImg = { src: string; fullSrc?: string; label: string }

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
        <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
        <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-9998 bg-black/20" />
        <Dialog.Content
            data-layout="website"
            className="fixed inset-0 z-9999 bg-white flex flex-col outline-none"
            aria-describedby={undefined}
            onEscapeKeyDown={onClose}
        >
            <VisuallyHidden.Root asChild>
                <Dialog.Title>Photo gallery — {title}</Dialog.Title>
            </VisuallyHidden.Root>

            {/* Header */}
            <div className="shrink-0 border-b border-neutral-200">
                <div className="screen-space flex items-center justify-between py-3.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <ImagesIcon aria-hidden="true" weight="duotone" className="size-5 text-muted shrink-0" />
                        <span className="text-sm font-semibold text-primary truncate">{title}</span>
                        <span className="text-xs text-muted shrink-0">({totalImages} photos)</span>
                    </div>
                    <Dialog.Close asChild>
                        <button
                            aria-label="Close gallery"
                            className="shrink-0 ml-4 size-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-secondary transition-colors"
                        >
                            <XIcon weight="bold" aria-hidden="true" className="size-4" />
                        </button>
                    </Dialog.Close>
                </div>
            </div>

            {/* Category tabs */}
            <div className="shrink-0 border-b border-neutral-100">
            <div
                role="tablist"
                aria-label="Photo categories"
                className="screen-space flex gap-1.5 overflow-x-auto py-2.5 scrollbar-none"
            >
                <button
                    role="tab"
                    aria-selected={activeCat === -1}
                    tabIndex={activeCat === -1 ? 0 : -1}
                    onClick={() => setActiveCat(-1)}
                    className={cn(
                        'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                        activeCat === -1
                            ? 'bg-neutral-900 text-white'
                            : 'bg-neutral-100 text-secondary hover:bg-neutral-200',
                    )}
                >
                    All
                    <span aria-hidden="true" className="ml-1 text-[11px] opacity-60">({totalImages})</span>
                </button>
                {categories.map((cat, i) => (
                    <button
                        key={i}
                        role="tab"
                        aria-selected={activeCat === i}
                        tabIndex={activeCat === i ? 0 : -1}
                        onClick={() => setActiveCat(i)}
                        className={cn(
                            'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all',
                            activeCat === i
                                ? 'bg-neutral-900 text-white'
                                : 'bg-neutral-100 text-secondary hover:bg-neutral-200',
                        )}
                    >
                        {cat.label}
                        <span aria-hidden="true" className="ml-1 text-[11px] opacity-60">({cat.images.length})</span>
                    </button>
                ))}
            </div>
            </div>

            {/* Image grid — boxed card per category, on a light gray page background */}
            <div className="flex-1 overflow-y-auto bg-neutral-100" role="tabpanel" aria-label={activeCat === -1 ? 'All photos' : categories[activeCat]?.label}>
                <div className="screen-space py-5 space-y-4">
                    {activeCat === -1 ? (
                        categories.map((cat, catIdx) =>
                            cat.images.length > 0 ? (
                                <Card key={catIdx} variant="elevated" radius="lg" padding="lg" aria-label={cat.label}>
                                    <p className="text-sm font-bold text-primary mb-3">
                                        {cat.label}
                                        <span className="font-normal text-muted ml-1.5">({cat.images.length})</span>
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
                                </Card>
                            ) : null
                        )
                    ) : (
                        <Card variant="elevated" radius="lg" padding="lg">
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
                        </Card>
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
        </Dialog.Content>
        </Dialog.Portal>
        </Dialog.Root>
    )
}
