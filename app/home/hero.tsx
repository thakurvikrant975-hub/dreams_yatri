'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import Button from '@/app/components/ui/Button';
import Image from 'next/image';
import { IslandIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import LocationSearchSelect, { type LocationValue } from '@/app/components/ui/LocationSearchSelect';
import DatePickerField from '@/app/components/ui/DatePickerField';
import TravellersField, { type TravellersValue } from '@/app/components/ui/TravellersField';

import ShowLogin from '../lib/show-login';


// ─── Default hero images (override via props) ───────────────────────────────
const DEFAULT_IMAGES = [
    'https://images.unsplash.com/photo-1682685797208-c741d58c2eff?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://plus.unsplash.com/premium_photo-1661878091370-4ccb8763756a?q=80&w=3132&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://plus.unsplash.com/premium_photo-1671358446946-8bd43ba08a6a?q=80&w=2832&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
]

// ─── Default titles — map index-for-index with DEFAULT_IMAGES ────────────────
const DEFAULT_TITLES = [
    'Explore the Magic of Kashmir',
    'Discover the Peaks of Himachal',
    'Journey Through Incredible India',
    'Your Perfect Getaway Awaits',
]

const DEFAULT_PARA = [
    'Experience serene lakes, snow-capped mountains, and vibrant valleys that make Kashmir truly unforgettable.',
    'Adventure through scenic hill towns, breathtaking mountain views, and peaceful retreats across beautiful Himachal.',
    'Uncover diverse cultures, historic landmarks, and stunning landscapes that showcase the true spirit of India.',
    'Plan relaxing escapes and exciting adventures with carefully crafted travel experiences designed just for you.'
]

// ─── Types ───────────────────────────────────────────────────────────────────
interface HeroProps {
    images?: string[]
    /**
     * Titles shown in the hero headline, one per image (index-matched).
     * Falls back to DEFAULT_TITLES if not provided.
     */
    titles?: string[]
    slideInterval?: number
}

// ─── Shared field label styling ───────────────────────────────────────────────
const FIELD_LABEL_CLASS = 'text-xs sm:text-sm font-medium font-heading text-inverse pl-1'

// ─── Slideshow dot indicator ──────────────────────────────────────────────────
function SlideDots({ total, active }: { total: number; active: number }) {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {Array.from({ length: total }).map((_, i) => (
                <motion.span
                    key={i}
                    animate={{
                        width: i === active ? 24 : 8,
                        opacity: i === active ? 1 : 0.45,
                    }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    className="h-2 rounded-full bg-white block"
                />
            ))}
        </div>
    )
}

// ─── Component ───────────────────────────────────────────────────────────────
function Hero({ images, titles, slideInterval = 5000 }: HeroProps) {

    ShowLogin();
    const router = useRouter()

    const [currentIndex, setCurrentIndex] = useState(0)
    const [prevIndex, setPrevIndex] = useState<number | null>(null)

    // Search form state
    const [fromLoc, setFromLoc] = useState<LocationValue | null>(null)
    const [toLoc, setToLoc] = useState<LocationValue | null>(null)
    const [departDate, setDepartDate] = useState<Date | null>(null)
    const [travellers, setTravellers] = useState<TravellersValue>({ adults: 2, childrenAges: [] })
    const [searchError, setSearchError] = useState('')

    function handleSearch() {
        if (!toLoc) { setSearchError('Please choose where you want to go.'); return }
        setSearchError('')
        const params = new URLSearchParams()
        params.set('to', toLoc.id)
        params.set('toName', toLoc.name)
        params.set('toType', toLoc.type)
        if (fromLoc) { params.set('from', fromLoc.id); params.set('fromName', fromLoc.name); params.set('fromType', fromLoc.type) }
        if (departDate) {
            // Local YYYY-MM-DD (avoid UTC shift from toISOString)
            const y = departDate.getFullYear()
            const m = String(departDate.getMonth() + 1).padStart(2, '0')
            const d = String(departDate.getDate()).padStart(2, '0')
            params.set('date', `${y}-${m}-${d}`)
        }
        params.set('adults', String(travellers.adults))
        if (travellers.childrenAges.length) params.set('children', travellers.childrenAges.join(','))
        router.push(`/search?${params.toString()}`)
    }

    const bgImages = images && images.length > 0 ? images : DEFAULT_IMAGES
    const bgTitles = titles && titles.length > 0 ? titles : DEFAULT_TITLES
    const bgParas = titles && titles.length > 0 ? titles : DEFAULT_PARA

    // Scroll-driven scale: tracks scroll progress within the hero section only.
    // scale goes 1.0 → 1.12 as user scrolls down through the hero, back to 1.0 on scroll up.
    const sectionRef = useRef<HTMLElement>(null)
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ['start start', 'end start'], // active only while hero is in viewport
    })
    const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.6])

    // Auto-advance slideshow
    useEffect(() => {
        if (bgImages.length <= 1) return

        const timer = setInterval(() => {
            setPrevIndex(currentIndex)
            setCurrentIndex((prev) => (prev + 1) % bgImages.length)
        }, slideInterval)

        return () => clearInterval(timer)
    }, [bgImages.length, currentIndex, slideInterval])

    return (
        <>
            <section ref={sectionRef} >
                <div className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-12  sm:pb-22 -mt-header-height">

                    {/* ── Background image stack ── */}
                    {/* motion.div carries the scroll-driven scale — wraps ALL slides so the
                scale applies uniformly regardless of which image is active.
                overflow-hidden on the parent section clips the scaled overflow. */}
                    <motion.div
                        className="absolute inset-0 overflow-hidden"
                        style={{ scale: bgScale }}
                    >
                        {bgImages.map((src, i) => (
                            <motion.div
                                key={src}
                                className="absolute inset-0"
                                initial={false}
                                animate={{ opacity: i === currentIndex ? 1 : 0 }}
                                transition={{ duration: 1.4, ease: 'easeInOut' }}
                            >
                                <Image
                                    src={src}
                                    alt={`Hero background ${i + 1}`}
                                    fill
                                    className="object-cover"
                                    priority={i === 0}
                                    style={{
                                        // Ken Burns (slow zoom while slide is active) — independent of scroll scale
                                        transform: i === currentIndex ? 'scale(1.04)' : 'scale(1)',
                                        transition: `transform ${slideInterval}ms ease-in-out`,
                                    }}
                                />
                            </motion.div>
                        ))}
                    </motion.div>



                    {/* Overlay — sits above scaled image stack, does not scale with it */}
                    <div className="absolute inset-0 bg-linear-to-b from-neutral-950/55 via-neutral-900/40 to-neutral-950/65 z-10 pointer-events-none" />

                    {/* Slide dots */}
                    {bgImages.length > 1 && (
                        <SlideDots total={bgImages.length} active={currentIndex} />
                    )}

                    {/* Spacer to push content below sticky header */}
                    <div className="h-header-height relative z-10" />

                    {/* ── Hero headline ── */}
                    <div className="relative z-10 text-center mb-8 sm:mb-10 px-2">
                        <AnimatePresence mode="wait">
                            <motion.h1
                                key={currentIndex}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg leading-tight tracking-tight font-heading"
                            >
                                {bgTitles[currentIndex % bgTitles.length]}
                            </motion.h1>
                        </AnimatePresence>
                        <motion.p
                            key={currentIndex}
                            initial={{ opacity: 0, x: 14 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="mt-3 text-sm sm:text-base text-neutral-300 max-w-xl mx-auto leading-relaxed">
                            {bgParas[currentIndex % bgParas.length]}
                        </motion.p>
                    </div>

                    {/* ── Holiday packages search card ── */}
                    <div className="relative z-10 w-full screen-space mt-12 sm:mt-16">
                        <div className="rounded-3xl bg-white/20 backdrop-blur-[2px] shadow-2xl shadow-black/30 ring-[0.1em] ring-inset ring-white/30 px-4 sm:px-8 pt-6 ">

                            {/* Header pill — floats slightly above the card */}
                            <div className="flex justify-center  -mt-11 mb-6">
                                <span className="inline-flex items-center gap-2 bg-white rounded-full pl-4 pr-5 py-2.5 shadow-xl shadow-black/15">
                                    <IslandIcon weight="duotone" className="size-7 duo_icons" />
                                    <span className="font-heading font-semibold text-neutral-900">Holiday Packages</span>
                                </span>
                            </div>

                            {/* Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">

                                {/* Leaving From */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={FIELD_LABEL_CLASS}>Leaving From</label>
                                    <LocationSearchSelect
                                        value={fromLoc}
                                        onChange={setFromLoc}
                                        placeholder="Your origin city"
                                        showCurrentLocation
                                    />
                                </div>

                                {/* Going To */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={FIELD_LABEL_CLASS}>Going To</label>
                                    <LocationSearchSelect
                                        value={toLoc}
                                        onChange={setToLoc}
                                        placeholder="Your destination city"
                                    />
                                </div>

                                {/* Departure Date */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={FIELD_LABEL_CLASS}>Departure Date</label>
                                    <DatePickerField
                                        value={departDate}
                                        onChange={setDepartDate}
                                        placeholder="Pick a date"
                                    />
                                </div>

                                {/* Travellers */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={FIELD_LABEL_CLASS}>Travellers</label>
                                    <TravellersField value={travellers} onChange={setTravellers} />
                                </div>

                            </div>

                            {/* Search */}
                            <div className="flex flex-col items-center mt-7 translate-y-1/2">
                                {searchError && (
                                    <p className="mb-2 text-xs font-medium text-white bg-red-500/90 rounded-full px-3 py-1 shadow">
                                        {searchError}
                                    </p>
                                )}
                                <Button
                                    variant="premium"
                                    size="lg"
                                    onClick={handleSearch}
                                    className="rounded-pill px-12 font-bold text-base shadow-lg shadow-red-400/40 hover:shadow-red-400/60 hover:scale-105 flex items-center gap-2"
                                >
                                    <MagnifyingGlassIcon weight="bold" className="size-5" />
                                    Search Packages
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

            </section>

        </>


    )
}

export default Hero