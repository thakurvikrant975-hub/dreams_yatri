'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { XIcon, ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { Dialog, VisuallyHidden } from 'radix-ui'
import { cn } from '@/app/lib/utils'

export type LightboxImage = { src: string; fullSrc?: string; label: string }

interface Props {
    images: LightboxImage[]
    activeIdx: number
    onClose: () => void
    onNavigate: (idx: number) => void
    /** z-index class — default z-10001 (sits above the full-gallery overlay) */
    zClass?: string
}

export default function ImageLightbox({ images, activeIdx, onClose, onNavigate, zClass = 'z-10001' }: Props) {
    const thumbRef = useRef<HTMLButtonElement>(null)
    const current  = images[activeIdx]

    // Arrow-key navigation (Escape handled by Radix Dialog)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') onNavigate(Math.min(activeIdx + 1, images.length - 1))
            if (e.key === 'ArrowLeft')  onNavigate(Math.max(activeIdx - 1, 0))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [activeIdx, images.length, onNavigate])

    useEffect(() => {
        thumbRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, [activeIdx])

    return (
        <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
            <Dialog.Portal>
                <Dialog.Overlay className={cn('fixed inset-0 bg-black/90', zClass)} />
                <Dialog.Content
                    className={cn('fixed inset-0 flex flex-col outline-none', zClass)}
                    aria-describedby={undefined}
                    onEscapeKeyDown={onClose}
                    onPointerDownOutside={onClose}
                >
                    <VisuallyHidden.Root asChild>
                        <Dialog.Title>
                            {current.label
                                ? `${current.label} — ${activeIdx + 1} of ${images.length}`
                                : `Image ${activeIdx + 1} of ${images.length}`}
                        </Dialog.Title>
                    </VisuallyHidden.Root>

                    {/* Top bar */}
                    <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 bg-black/60 backdrop-blur-sm">
                        <span className="text-white/80 text-sm font-medium truncate max-w-[60vw]">
                            {current.label}
                        </span>
                        <div className="flex items-center gap-4 shrink-0">
                            <span aria-live="polite" aria-atomic="true" className="text-white/50 text-sm tabular-nums">
                                {activeIdx + 1} / {images.length}
                            </span>
                            <Dialog.Close asChild>
                                <button
                                    className="size-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
                                    aria-label="Close gallery"
                                >
                                    <XIcon weight="bold" aria-hidden="true" className="size-4" />
                                </button>
                            </Dialog.Close>
                        </div>
                    </div>

                    {/* Main image */}
                    <div className="flex-1 min-h-0 relative flex items-center justify-center">
                        <div className="absolute inset-0">
                            <Image
                                key={current.fullSrc ?? current.src}
                                src={current.fullSrc ?? current.src}
                                alt={current.label || `Image ${activeIdx + 1}`}
                                fill
                                className="object-contain"
                                sizes="100vw"
                                priority
                            />
                        </div>

                        {activeIdx > 0 && (
                            <button
                                onClick={() => onNavigate(activeIdx - 1)}
                                aria-label="Previous image"
                                className="absolute left-3 sm:left-5 z-10 size-10 sm:size-12 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                            >
                                <ArrowLeftIcon weight="bold" aria-hidden="true" className="size-5" />
                            </button>
                        )}
                        {activeIdx < images.length - 1 && (
                            <button
                                onClick={() => onNavigate(activeIdx + 1)}
                                aria-label="Next image"
                                className="absolute right-3 sm:right-5 z-10 size-10 sm:size-12 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                            >
                                <ArrowRightIcon weight="bold" aria-hidden="true" className="size-5" />
                            </button>
                        )}
                    </div>

                    {/* Thumbnail strip */}
                    {images.length > 1 && (
                        <div
                            role="tablist"
                            aria-label="Image thumbnails"
                            className="shrink-0 flex gap-2 overflow-x-auto px-4 py-3 bg-black/60 backdrop-blur-sm scrollbar-none"
                        >
                            {images.map((img, i) => (
                                <button
                                    key={i}
                                    ref={i === activeIdx ? thumbRef : undefined}
                                    role="tab"
                                    aria-selected={i === activeIdx}
                                    aria-label={img.label || `Image ${i + 1}`}
                                    onClick={() => onNavigate(i)}
                                    className={cn(
                                        'relative shrink-0 size-14 sm:size-16 rounded-lg overflow-hidden transition-all duration-150',
                                        i === activeIdx
                                            ? 'ring-2 ring-white opacity-100'
                                            : 'ring-1 ring-white/20 opacity-50 hover:opacity-80',
                                    )}
                                >
                                    <Image src={img.src} alt="" aria-hidden="true" fill className="object-cover" sizes="80px" />
                                </button>
                            ))}
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
