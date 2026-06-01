'use client'

import { useEffect, useRef, useState } from 'react'
import { Popover } from 'radix-ui'
import {
    MapPinIcon,
    MagnifyingGlassIcon,
    XIcon,
    ClockIcon,
    CircleNotchIcon,
    CrosshairIcon,
} from '@phosphor-icons/react'
import { cn } from '@/app/lib/utils'
import {
    DESTINATION_TYPES,
    LOCATION_LABELS,
    LOCATION_COLORS,
    type LocationType,
    type LocationValue,
    type LocalResult,
} from '@/app/(dashboard)/dashboard/(main)/components/location/location.types'

export type { LocationValue } from '@/app/(dashboard)/dashboard/(main)/components/location/location.types'

// ── Recent selections (localStorage) ────────────────────────────────────────
const RECENT_KEY = 'dy_location_recent'
const MAX_RECENT = 5

function readRecent(): LocationValue[] {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function writeRecent(loc: LocationValue) {
    const prev = readRecent().filter((r) => r.id !== loc.id)
    localStorage.setItem(RECENT_KEY, JSON.stringify([loc, ...prev].slice(0, MAX_RECENT)))
}

const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'location'

// ── Type badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: LocationType }) {
    return (
        <span className={cn(
            'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            LOCATION_COLORS[type],
        )}>
            {LOCATION_LABELS[type]}
        </span>
    )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 select-none">
            {children}
        </p>
    )
}

// ── Result row ───────────────────────────────────────────────────────────────
function Row({
    icon, primary, secondary, badge, highlighted, onClick,
}: {
    icon: React.ReactNode
    primary: string
    secondary?: string
    badge?: React.ReactNode
    highlighted: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClick() }}
            className={cn(
                'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                highlighted ? 'bg-primary-50' : 'hover:bg-neutral-50',
            )}
        >
            <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-800">
                    <span className="truncate">{primary}</span>
                    {badge}
                </span>
                {secondary && <span className="truncate text-xs text-neutral-400">{secondary}</span>}
            </span>
        </button>
    )
}

// ── Navigable entry model ─────────────────────────────────────────────────────
type NavEntry = { kind: 'current' } | { kind: 'location'; loc: LocationValue }

// ── Component ────────────────────────────────────────────────────────────────
interface LocationSearchSelectProps {
    value: LocationValue | null
    onChange: (loc: LocationValue | null) => void
    placeholder?: string
    /** Restrict results to specific location types (defaults to destination-level types) */
    types?: LocationType[]
    /** Show a "Use current location" option (geolocation → reverse geocode) */
    showCurrentLocation?: boolean
    id?: string
    disabled?: boolean
    className?: string
    /** z-index utility for the dropdown (default z-100 — below the sticky header) */
    menuZClass?: string
}

export default function LocationSearchSelect({
    value,
    onChange,
    placeholder = 'Search city…',
    types = DESTINATION_TYPES,
    showCurrentLocation = false,
    id,
    disabled,
    className,
    menuZClass = 'z-100',
}: LocationSearchSelectProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<LocalResult[]>([])
    const [loading, setLoading] = useState(false)
    const [recent, setRecent] = useState<LocationValue[]>([])
    const [popular, setPopular] = useState<LocalResult[]>([])
    const [popularLoaded, setPopularLoaded] = useState(false)
    const [geoLoading, setGeoLoading] = useState(false)
    const [geoError, setGeoError] = useState('')
    const [activeIdx, setActiveIdx] = useState(-1)

    const inputRef = useRef<HTMLInputElement>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => { setRecent(readRecent()) }, [])

    // Preload popular destinations on first open (type-only query, no text)
    useEffect(() => {
        if (!open || popularLoaded) return
        let cancelled = false
        ;(async () => {
            try {
                const qs = new URLSearchParams({ destinationsOnly: 'true', limit: '8' })
                if (types?.length) qs.set('types', types.join(','))
                const res = await fetch(`/api/locations/search?${qs}`)
                if (res.ok && !cancelled) setPopular((await res.json()) as LocalResult[])
            } catch { /* ignore */ } finally {
                if (!cancelled) setPopularLoaded(true)
            }
        })()
        return () => { cancelled = true }
    }, [open, popularLoaded, types])

    // Debounced local search
    useEffect(() => {
        if (!open) return
        if (timerRef.current) clearTimeout(timerRef.current)
        if (!query.trim()) { setResults([]); return }

        timerRef.current = setTimeout(async () => {
            try {
                setLoading(true)
                const qs = new URLSearchParams({ q: query.trim(), limit: '8' })
                if (types?.length) qs.set('types', types.join(','))
                const res = await fetch(`/api/locations/search?${qs}`)
                if (res.ok) setResults((await res.json()) as LocalResult[])
            } catch {
                setResults([])
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }, [query, open, types])

    useEffect(() => { setActiveIdx(-1) }, [results, query])

    function pick(loc: LocationValue) {
        onChange(loc)
        writeRecent(loc)
        setRecent(readRecent())
        setOpen(false)
        setQuery('')
        setResults([])
        setGeoError('')
    }

    // ── Current location via geolocation + reverse geocode ────────────────────
    function useCurrentLocation() {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            setGeoError('Location is not supported on this device.')
            return
        }
        setGeoLoading(true)
        setGeoError('')
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const { latitude, longitude } = pos.coords
                    const res = await fetch(`/api/locations/reverse-geocode?lat=${latitude}&lng=${longitude}`)
                    const data = res.ok ? await res.json() : null
                    const name: string = data?.place || data?.name || ''
                    if (!name) { setGeoError("Couldn't detect your city."); return }
                    pick({
                        id: `geo:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
                        name,
                        type: 'CITY',
                        breadcrumb: data.full_name || name,
                        slug: slugify(name),
                        latitude,
                        longitude,
                    })
                } catch {
                    setGeoError("Couldn't detect your location.")
                } finally {
                    setGeoLoading(false)
                }
            },
            () => {
                setGeoLoading(false)
                setGeoError('Location permission denied.')
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        )
    }

    // ── Build navigable list (mirrors render order) ───────────────────────────
    const recentFiltered = types?.length ? recent.filter((r) => types.includes(r.type)) : recent
    const popularFiltered = popular.filter((p) => !recentFiltered.some((r) => r.id === p.id))
    const showCurrentRow = showCurrentLocation && !query.trim()
    const showRecent = !query.trim() && recentFiltered.length > 0
    const showPopular = !query.trim() && popularFiltered.length > 0

    const navList: NavEntry[] = []
    if (showCurrentRow) navList.push({ kind: 'current' })
    if (query.trim()) {
        results.forEach((loc) => navList.push({ kind: 'location', loc }))
    } else {
        recentFiltered.forEach((loc) => navList.push({ kind: 'location', loc }))
        popularFiltered.forEach((loc) => navList.push({ kind: 'location', loc }))
    }

    function activate(entry: NavEntry) {
        if (entry.kind === 'current') useCurrentLocation()
        else pick(entry.loc)
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape') { setOpen(false); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, navList.length - 1)) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
        else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); activate(navList[activeIdx]) }
    }

    // Running index that matches navList order, incremented as rows render
    let navIdx = 0

    return (
        <Popover.Root
            open={open}
            onOpenChange={(o) => {
                setOpen(o)
                if (o) setTimeout(() => inputRef.current?.focus(), 0)
            }}
        >
            <Popover.Trigger asChild>
                <button
                    type="button"
                    id={id}
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={cn(
                        'flex w-full items-center rounded-input border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors',
                        'focus:outline-none focus:border-red-400 focus:ring-[0.12em] focus:ring-red-100',
                        open && 'border-red-400 ring-[0.12em] ring-red-100',
                        disabled && 'pointer-events-none opacity-50',
                        className,
                    )}
                >
                    <MapPinIcon weight="duotone" className="mr-2 size-4 shrink-0 text-red-500" />
                    {value ? (
                        <span className="flex flex-1 min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm text-neutral-800">{value.name}</span>
                            <TypeBadge type={value.type} />
                        </span>
                    ) : (
                        <span className="flex-1 truncate text-sm text-neutral-400">{placeholder}</span>
                    )}
                    {value && (
                        <span
                            role="button"
                            tabIndex={-1}
                            aria-label="Clear selection"
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(null) }}
                            className="ml-1 shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-700"
                        >
                            <XIcon className="size-4" />
                        </span>
                    )}
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    className={cn(menuZClass, 'w-(--radix-popover-trigger-width) overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-black/10')}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    {/* Search input */}
                    <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2.5">
                        <MagnifyingGlassIcon className="size-4 shrink-0 text-neutral-400" />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className="flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
                        />
                        {loading && <CircleNotchIcon className="size-4 animate-spin text-neutral-400" />}
                    </div>

                    {/* Results / suggestions */}
                    <div role="listbox" className="max-h-80 overflow-y-auto py-1">

                        {/* Current location */}
                        {showCurrentRow && (() => {
                            const idx = navIdx++
                            return (
                                <Row
                                    icon={geoLoading
                                        ? <CircleNotchIcon className="size-4 animate-spin" />
                                        : <CrosshairIcon weight="bold" className="size-4 text-red-500" />}
                                    primary={geoLoading ? 'Detecting your location…' : 'Use current location'}
                                    secondary={geoError || undefined}
                                    highlighted={activeIdx === idx}
                                    onClick={useCurrentLocation}
                                />
                            )
                        })()}

                        {/* Recent */}
                        {showRecent && <SectionLabel>Recent searches</SectionLabel>}
                        {showRecent && recentFiltered.map((r) => {
                            const idx = navIdx++
                            return (
                                <Row
                                    key={`recent-${r.id}`}
                                    icon={<ClockIcon className="size-4" />}
                                    primary={r.name}
                                    secondary={r.breadcrumb && r.breadcrumb !== r.name ? r.breadcrumb : undefined}
                                    badge={<TypeBadge type={r.type} />}
                                    highlighted={activeIdx === idx}
                                    onClick={() => pick(r)}
                                />
                            )
                        })}

                        {/* Popular destinations */}
                        {showPopular && <SectionLabel>Popular destinations</SectionLabel>}
                        {showPopular && popularFiltered.map((r) => {
                            const idx = navIdx++
                            return (
                                <Row
                                    key={`popular-${r.id}`}
                                    icon={<MapPinIcon weight="duotone" className="size-4" />}
                                    primary={r.name}
                                    secondary={r.breadcrumb && r.breadcrumb !== r.name ? r.breadcrumb : undefined}
                                    badge={<TypeBadge type={r.type} />}
                                    highlighted={activeIdx === idx}
                                    onClick={() => pick(r)}
                                />
                            )
                        })}

                        {/* Search results */}
                        {query.trim() && results.map((r) => {
                            const idx = navIdx++
                            return (
                                <Row
                                    key={`result-${r.id}`}
                                    icon={<MapPinIcon weight="duotone" className="size-4" />}
                                    primary={r.name}
                                    secondary={r.breadcrumb && r.breadcrumb !== r.name ? r.breadcrumb : undefined}
                                    badge={<TypeBadge type={r.type} />}
                                    highlighted={activeIdx === idx}
                                    onClick={() => pick(r)}
                                />
                            )
                        })}

                        {/* Empty / hint states */}
                        {query.trim() && !loading && results.length === 0 && (
                            <p className="px-3 py-4 text-center text-xs text-neutral-400">No locations found</p>
                        )}
                        {!query.trim() && !showCurrentRow && !showRecent && !showPopular && (
                            <p className="px-3 py-4 text-center text-xs text-neutral-400">Start typing to search cities</p>
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
