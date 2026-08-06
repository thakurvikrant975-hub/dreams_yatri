'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import Button from '@/app/components/ui/Button';
import Image from 'next/image';
import { IslandIcon, MagnifyingGlassIcon, BedIcon, CarProfileIcon, RocketLaunchIcon, XIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';
import LocationSearchSelect, { type LocationValue } from '@/app/components/ui/LocationSearchSelect';
import DatePickerField from '@/app/components/ui/DatePickerField';
import CheckInOutField from '@/app/components/ui/CheckInOutField';
import RoomsGuestsField from '@/app/components/ui/RoomsGuestsField';
import { DEFAULT_ROOM_GUESTS, writeRoomGuests, type RoomGuests } from '@/app/lib/packages/roomGuests';

import ShowLogin from '../lib/show-login';


// ─── Default hero images (override via props) ───────────────────────────────
const DEFAULT_IMAGES = [
    // Santorini, Greece — iconic blue domes overlooking the Aegean
    'https://plus.unsplash.com/premium_photo-1661964068107-6d7f6f4fea51?q=80&w=2074&auto=format&fit=crop',
    // Eiffel Tower, Paris — golden hour over the city of lights
    'https://plus.unsplash.com/premium_photo-1661919210043-fd847a58522d?q=80&w=2070&auto=format&fit=crop',
    // Machu Picchu, Peru — ancient citadel wrapped in clouds
    'https://images.unsplash.com/photo-1526392060635-9d6019884377?q=80&w=2070&auto=format&fit=crop',
    // Bali, Indonesia — tropical temple at sunrise
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?q=80&w=2038&auto=format&fit=crop',
    // Dubai, UAE — futuristic skyline at dusk
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=2070&auto=format&fit=crop',
    // Amalfi Coast, Italy — colourful cliffside villages above turquoise sea
    'https://images.unsplash.com/photo-1591014979485-08d0b2946bc3?q=80&w=2076&auto=format&fit=crop',
    // Tokyo, Japan — neon-lit streets in the heart of the city
    'https://plus.unsplash.com/premium_photo-1661878589476-bcad7fe1b8c5?q=80&w=2094&auto=format&fit=crop',
    // Maldives — overwater bungalows on a crystal lagoon
    'https://images.unsplash.com/photo-1602002418679-43121356bf41?q=80&w=2065&auto=format&fit=crop',
    // Swiss Alps — snow-capped peaks and a mirror-calm lake
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop',
]

// ─── Default titles — map index-for-index with DEFAULT_IMAGES ────────────────
const DEFAULT_TITLES = [
    'Discover the Beauty of Greece',
    'Fall in Love with Paris',
    'Explore the Wonders of Peru',
    'Experience the Magic of Bali',
    'Marvel at the Future in Dubai',
    'Escape to the Amalfi Coast',
    'Dive into the Energy of Tokyo',
    'Unwind in the Maldives',
    'Find Peace in the Swiss Alps',
]

const DEFAULT_PARA = [
    'Sail through crystal-clear Aegean waters, stroll cobbled alleys, and watch the sun melt into the horizon from breathtaking clifftop villages.',
    'Wander iconic boulevards, savour world-class cuisine, and soak in the romance of a city that has inspired travellers for centuries.',
    'Trek through ancient cloud-kissed ruins, discover vibrant markets, and immerse yourself in a civilisation that shaped the world.',
    'Unwind on lush terraced rice fields, visit sacred temples at sunrise, and let the island\'s warm spirit restore your soul.',
    'Gaze at a glittering skyline rising from the desert, indulge in luxury shopping, and discover a city that never stops reinventing itself.',
    'Wind along dramatic coastal roads, savour fresh seafood with sea views, and lose yourself in the timeless charm of Italian villages.',
    'Wander neon-lit alleys, discover ancient shrines between soaring skyscrapers, and taste a cuisine that has perfected every bite.',
    'Wake up above a turquoise lagoon, snorkel among coral gardens, and let the gentle pace of island life melt every worry away.',
    'Breathe crisp mountain air, cruise across glassy lakes, and stand in silence before peaks that make the rest of the world feel small.',
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


// ─── Hero search tabs (Holidays & Hotels live; Cabs coming soon) ──────────────
const HERO_TABS = [
    { key: 'holidays', label: 'Holidays', Icon: IslandIcon, soon: false },
    { key: 'hotels', label: 'Hotels', Icon: BedIcon, soon: false },
    { key: 'cabs', label: 'Cabs', Icon: CarProfileIcon, soon: true },
] as const

type HeroTabKey = (typeof HERO_TABS)[number]['key']

// Branded "coming soon" toast card
function comingSoonToast(label: string) {
    toast.custom((id) => (
        <div className="flex w-[min(92vw,380px)] items-center gap-3 rounded-2xl border border-neutral-200/70 bg-white/95 px-4 py-3.5 shadow-2xl shadow-black/15 backdrop-blur-md">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/30">
                <RocketLaunchIcon weight="duotone" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold text-neutral-900">{label} — coming soon</p>
                <p className="text-xs text-neutral-500">We&apos;re putting the finishing touches on it. Stay tuned!</p>
            </div>
            <button
                onClick={() => toast.dismiss(id)}
                aria-label="Dismiss"
                className="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
                <XIcon weight="bold" className="size-4" />
            </button>
        </div>
    ))
}

// ─── Slideshow dot indicator ──────────────────────────────────────────────────
function SlideDots({ total, active }: { total: number; active: number }) {
    return (
        <div className="absolute bottom-3.5 sm:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 ">
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
    const [isPending, startTransition] = useTransition()

    const [currentIndex, setCurrentIndex] = useState(0)
    const [prevIndex, setPrevIndex] = useState<number | null>(null)

    // Active hero search tab
    const [activeTab, setActiveTab] = useState<HeroTabKey>('holidays')

    // Holidays search form state
    const [fromLoc, setFromLoc] = useState<LocationValue | null>(null)
    const [toLoc, setToLoc] = useState<LocationValue | null>(null)
    const [departDate, setDepartDate] = useState<Date | null>(null)
    // Per-room split (not a flat total) so the package page receives exactly
    // the rooms the guest configured here — see lib/packages/roomGuests.
    const [roomGuests, setRoomGuests] = useState<RoomGuests[]>(DEFAULT_ROOM_GUESTS)

    function handleSearch() {
        if (!toLoc) { toast.error('Please choose where you want to go.'); return }
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
        writeRoomGuests(params, roomGuests)
        startTransition(() => { router.push(`/packages?${params.toString()}`) })
    }

    // Hotels search form state
    const [hotelCity, setHotelCity] = useState<LocationValue | null>(null)
    const [checkIn, setCheckIn] = useState<Date | null>(null)
    const [checkOut, setCheckOut] = useState<Date | null>(null)
    // Same per-room picker the packages tab above uses, so a stay configured
    // here survives the hop to /hotels intact rather than collapsing to a flat
    // adults/children/rooms trio.
    const [hotelRoomGuests, setHotelRoomGuests] = useState<RoomGuests[]>(DEFAULT_ROOM_GUESTS)

    function ymd(d: Date): string {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    }

    function handleHotelSearch() {
        if (!hotelCity) { toast.error('Please choose a city to search hotels in.'); return }
        const params = new URLSearchParams()
        params.set('city', hotelCity.name)
        // Carry the picked location's identity too — /hotels resolves a state or
        // region through the location hierarchy, which a bare name can't express.
        if (hotelCity.id) params.set('locId', hotelCity.id)
        if (hotelCity.type) params.set('locType', hotelCity.type)
        if (checkIn) params.set('in', ymd(checkIn))
        if (checkOut && (!checkIn || checkOut > checkIn)) params.set('out', ymd(checkOut))
        writeRoomGuests(params, hotelRoomGuests)
        startTransition(() => { router.push(`/hotels?${params.toString()}`) })
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
                <div className="relative flex flex-col items-center justify-center overflow-hidden sm:px-4 py-12 pb-18  sm:pb-22 -mt-header-height">

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

                            {/* Tabs — Holidays is live; Hotels & Cabs are coming soon. Floats above the card. */}
                            <div className="flex justify-center -mt-12 mb-6">
                                <div role="tablist" aria-label="Search type" className="inline-flex items-stretch gap-1 rounded-2xl bg-white p-1.5 shadow-xl shadow-black/15">
                                    {HERO_TABS.map(({ key, label, Icon, soon }) => {
                                        const active = key === activeTab
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                role="tab"
                                                aria-selected={active}
                                                onClick={() => { if (soon) comingSoonToast(label); else setActiveTab(key) }}
                                                className={`flex flex-col items-center justify-center gap-1 rounded-xl px-5 sm:px-7 py-2 transition-colors cursor-pointer ${active
                                                    ? 'bg-primary-500 text-white'
                                                    : 'text-neutral-700 hover:bg-neutral-100'
                                                    }`}
                                            >
                                                <Icon weight="duotone" className="size-6" />
                                                <span className="text-xs font-semibold">{label}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {activeTab === 'holidays' && (
                            <form
                                role="search"
                                aria-label="Search holiday packages"
                                onSubmit={(e) => { e.preventDefault(); if (!isPending) handleSearch() }}
                            >
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
                                        className='cursor-pointer'
                                        value={departDate}
                                        onChange={setDepartDate}
                                        placeholder="Pick a date"
                                    />
                                </div>

                                {/* Travellers */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={FIELD_LABEL_CLASS}>Travellers</label>
                                    <RoomsGuestsField value={roomGuests} onChange={setRoomGuests} />
                                </div>

                            </div>

                            {/* Search */}
                            <div className="flex flex-col items-center mt-7 translate-y-1/2">
                                <Button
                                    type="submit"
                                    variant="premium"
                                    size="lg"
                                    loading={isPending}
                                    disabled={isPending}
                                    className="rounded-pill  font-bold text-base shadow-lg shadow-red-400/40 hover:shadow-red-400/60 hover:scale-105 flex items-center gap-2"
                                >
                                    <MagnifyingGlassIcon weight="bold" className="size-5" />
                                    {isPending ? 'Searching…' : 'Search Packages'}
                                </Button>
                            </div>
                            </form>
                            )}

                            {activeTab === 'hotels' && (
                            <form
                                role="search"
                                aria-label="Search hotels"
                                onSubmit={(e) => { e.preventDefault(); if (!isPending) handleHotelSearch() }}
                            >
                            {/* Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">

                                {/* City */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={FIELD_LABEL_CLASS}>City / Destination</label>
                                    <LocationSearchSelect
                                        value={hotelCity}
                                        onChange={setHotelCity}
                                        placeholder="Where are you going?"
                                        showCurrentLocation
                                    />
                                </div>

                                {/* Check-in / Check-out — two fields, one shared calendar.
                                    Still two dates in state, so handleHotelSearch's
                                    `in`/`out` params are untouched. */}
                                <CheckInOutField
                                    className="sm:col-span-2 gap-3 sm:gap-4"
                                    triggerClassName="cursor-pointer"
                                    labelClassName={FIELD_LABEL_CLASS}
                                    value={{ from: checkIn ?? undefined, to: checkOut ?? undefined }}
                                    onChange={({ from, to }) => { setCheckIn(from ?? null); setCheckOut(to ?? null) }}
                                />

                                {/* Guests */}
                                <div className="flex flex-col gap-1.5">
                                    <label className={FIELD_LABEL_CLASS}>Guests</label>
                                    <RoomsGuestsField value={hotelRoomGuests} onChange={setHotelRoomGuests} />
                                </div>

                            </div>

                            {/* Search */}
                            <div className="flex flex-col items-center mt-7 translate-y-1/2">
                                <Button
                                    type="submit"
                                    variant="premium"
                                    size="lg"
                                    loading={isPending}
                                    disabled={isPending}
                                    className="rounded-pill  font-bold text-base shadow-lg shadow-red-400/40 hover:shadow-red-400/60 hover:scale-105 flex items-center gap-2"
                                >
                                    <MagnifyingGlassIcon weight="bold" className="size-5" />
                                    {isPending ? 'Searching…' : 'Search Hotels'}
                                </Button>
                            </div>
                            </form>
                            )}
                        </div>
                    </div>
                </div>

            </section>

        </>


    )
}

export default Hero