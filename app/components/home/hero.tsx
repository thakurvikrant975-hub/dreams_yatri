'use client'

// hero section 

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import Button from '../ui/Button';
import Image from 'next/image';
import {
    AirplaneTiltIcon,
    IslandIcon,
    BuildingIcon,
    BusIcon,
    TrainIcon,
    CarIcon,
    CableCarIcon,
    BoatIcon,
} from '@phosphor-icons/react';
import { HelicopterIcon } from '../icons/cusomIcon';

import { EngineKeys } from '@/app/types/engine';
import { HeroTab, HeroField } from '@/app/types/home';

// ─── Default hero images (override via props) ───────────────────────────────
const DEFAULT_IMAGES = [
    'https://images.unsplash.com/photo-1614591276564-7b3e69347a48?q=80&w=2074&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://plus.unsplash.com/premium_photo-1697729953469-10f2ab30e20a?q=80&w=1975&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=2071&auto=format&fit=crop',
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

// ─── Tab / Field config (unchanged) ─────────────────────────────────────────
const heroTabsPremium: HeroTab[] = [
    { key: 'flights', label: 'Flights', icon: AirplaneTiltIcon, badge: 'Offer' },
    { key: 'holidays', label: 'Holidays', icon: IslandIcon },
    { key: 'hotels', label: 'Hotels', icon: BuildingIcon },
]

const heroTabs: HeroTab[] = [
    { key: 'bus', label: 'Bus', icon: BusIcon },
    { key: 'train', label: 'Train', icon: TrainIcon },
    { key: 'cab', label: 'Cab', icon: CarIcon },
    { key: 'heliride', label: 'Heli Ride', icon: HelicopterIcon },
    { key: 'cablecar', label: 'Cable Car', icon: CableCarIcon },
    { key: 'cruise', label: 'Cruise', icon: BoatIcon },
]

type FieldConfig = HeroField[]

const fieldMap: Record<EngineKeys, FieldConfig> = {
    flights: [
        { label: 'Departure From', placeholder: 'City or Airport' },
        { label: 'Going To', placeholder: 'City or Airport' },
        { label: 'Departure Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Going Date', placeholder: 'DD / MM / YYYY', type: 'date' },
    ],
    holidays: [
        { label: 'Destination', placeholder: 'Where do you want to go?' },
        { label: 'Departure From', placeholder: 'Your city' },
        { label: 'Travel Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Travellers', placeholder: 'Adults, Children' },
    ],
    hotels: [
        { label: 'City / Area', placeholder: 'Where to stay?' },
        { label: 'Check In', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Check Out', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Rooms & Guests', placeholder: '1 Room, 2 Adults' },
    ],
    bus: [
        { label: 'From', placeholder: 'Boarding city' },
        { label: 'To', placeholder: 'Destination city' },
        { label: 'Travel Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Passengers', placeholder: 'No. of seats' },
    ],
    train: [
        { label: 'From Station', placeholder: 'Origin station' },
        { label: 'To Station', placeholder: 'Destination station' },
        { label: 'Journey Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Class', placeholder: 'Sleeper, 3A, 2A…' },
    ],
    cab: [
        { label: 'Pickup Location', placeholder: 'Enter pickup point' },
        { label: 'Drop Location', placeholder: 'Enter drop point' },
        { label: 'Pickup Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Pickup Time', placeholder: 'HH : MM', type: 'time' },
    ],
    heliride: [
        { label: 'From', placeholder: 'Helipad / location' },
        { label: 'To', placeholder: 'Destination' },
        { label: 'Travel Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Passengers', placeholder: 'No. of seats' },
    ],
    cablecar: [
        { label: 'Location', placeholder: 'Cable car destination' },
        { label: 'Visit Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Tickets', placeholder: 'No. of tickets' },
        { label: 'Timeslot', placeholder: 'Morning / Evening' },
    ],
    cruise: [
        { label: 'Departure Port', placeholder: 'Port city' },
        { label: 'Destination', placeholder: 'Cruise route' },
        { label: 'Departure Date', placeholder: 'DD / MM / YYYY', type: 'date' },
        { label: 'Guests', placeholder: 'Adults, Children' },
    ],
}

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
    const [activeTab, setActiveTab] = useState<EngineKeys>('flights')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [prevIndex, setPrevIndex] = useState<number | null>(null)

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

    const fields = fieldMap[activeTab]

    return (
        <section ref={sectionRef} className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-10 sm:pt-12 sm:pb-22 -mt-(--header-height)">

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
            <div className="h-(--header-height) relative z-10" />

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
                    className="mt-3 text-sm sm:text-base text-white/80 max-w-xl mx-auto leading-relaxed">
                    {bgParas[currentIndex % bgParas.length]}
                </motion.p>
            </div>

            {/* ── Search engine card ── */}
            <div className="relative z-10 w-full max-w-container px-4 sm:px-6 lg:px-8 mt-16">
                <div className="rounded-3xl bg-white/20 backdrop-blur-[2px] shadow-2xl shadow-black/30 ring-[0.1em] ring-inset ring-white/30 ">

                    {/* Tab row */}
                    <div className="overflow-x-auto scrollbar-none border-b border-neutral-100 bg-white w-max m-auto -translate-y-1/2 py-3 px-5 rounded-2xl flex items-center divide-x divide-(--border-muted) shadow-xl shadow-gray-600">
                        <div className="flex items-center gap-4 pr-3">
                            {heroTabsPremium.map((tab) => {
                                const isActive = activeTab === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`relative flex flex-col items-center gap-2 px-3 sm:px-4 py-2.5 min-w-16 sm:min-w-18 transition-all rounded-xl shrink-0 ${isActive
                                            ? 'bg-red-500 text-white shadow-md shadow-red-300/40'
                                            : 'text-neutral-900 hover:text-neutral-800 hover:bg-neutral-100'
                                            }`}
                                    >
                                        <span className={isActive ? 'text-white' : 'text-neutral-900'}>
                                            <tab.icon
                                                className={`size-9 ${isActive ? 'duo_icons_active' : 'duo_icons'}`}
                                                weight="duotone"
                                            />
                                        </span>
                                        <span className="whitespace-nowrap leading-none font-heading text-sm font-semibold">
                                            {tab.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex items-center gap-3 pl-3">
                            {heroTabs.map((tab) => {
                                const isActive = activeTab === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`relative flex flex-col items-center gap-2 px-3 sm:px-4 py-2.5 min-w-16 sm:min-w-18 text-sm font-medium transition-all rounded-xl shrink-0 ${isActive
                                            ? 'bg-red-500 text-white shadow-md shadow-red-300/40'
                                            : 'text-neutral-900 hover:text-neutral-800 hover:bg-neutral-100'
                                            }`}
                                    >
                                        <span className={isActive ? 'text-white' : 'text-neutral-900'}>
                                            <tab.icon
                                                className={`size-9 ${isActive ? 'duo_icons_active' : 'duo_icons'}`}
                                                weight="duotone"
                                            />
                                        </span>
                                        <span className="whitespace-nowrap leading-none font-heading">
                                            {tab.label}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Fields */}
                    <div className="px-4 sm:px-6 pt-5">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 9 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
                        >
                            {fields.map((field) => (
                                <div key={field.label} className="flex flex-col gap-1.5">
                                    <label className="text-xs sm:text-sm font-medium text-inverse pl-1">
                                        {field.label}
                                    </label>
                                    <input
                                        type={field.type ?? 'text'}
                                        placeholder={field.placeholder}
                                        className="w-full rounded-(--radius-input) border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 placeholder-color shadow-sm outline-none focus:border-red-400 focus:border-[0.13em] focus:ring-[0.12em] focus:ring-red-100 transition"
                                    />
                                </div>
                            ))}
                        </motion.div>

                        <div className="flex justify-center mt-6 translate-y-1/2">
                            <Button
                                variant="premium"
                                size="lg"
                                className="rounded-full px-12 font-bold text-base shadow-lg shadow-red-400/40 hover:shadow-red-400/60"
                            >
                                Search
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Hero