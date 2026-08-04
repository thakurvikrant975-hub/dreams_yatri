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
import {
    getCachedSuggestions,
    fetchSuggestions,
    suggestionsCacheKey,
} from '@/app/lib/locationSuggestions'

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
        <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-primary select-none">
            {children}
        </p>
    )
}

// ── Loading placeholders ─────────────────────────────────────────────────────

/** Mirrors Row's geometry (icon, two text lines, badge) so the list doesn't
 *  shift when real rows replace it. */
function RowSkeleton({ withBadge = true }: { withBadge?: boolean }) {
    return (
        <div className="flex w-full items-start gap-2.5 px-3 py-2.5" aria-hidden="true">
            <span className="skeleton-box mt-0.5 size-4.5 shrink-0 rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-center gap-1.5">
                    <span className="skeleton-box h-3.5 w-2/5 rounded" />
                    {withBadge && <span className="skeleton-box h-3 w-10 rounded" />}
                </span>
                <span className="skeleton-box h-2.5 w-3/5 rounded" />
            </span>
        </div>
    )
}

function ResultsSkeleton({ rows = 5, label }: { rows?: number; label: string }) {
    return (
        <div role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">{label}</span>
            <SectionLabel>{label}</SectionLabel>
            {Array.from({ length: rows }).map((_, i) => (
                <RowSkeleton key={i} />
            ))}
        </div>
    )
}

/** Centres short content (empty states) inside the fixed-height list. */
function CenteredNote({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-full items-center justify-center px-3 py-6">
            <p className="text-center text-xs text-neutral-400">{children}</p>
        </div>
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
           data-layout="website"
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
                {secondary && <span className="truncate text-xs text-secondary">{secondary}</span>}
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

    // `types` is almost always an inline array literal at the call site, so it
    // is a new reference every render. Depending on it directly would re-run
    // the effects below forever; the key is a stable string for the same set.
    const typesKey = suggestionsCacheKey(types)

    useEffect(() => { setRecent(readRecent()) }, [])

    // Popular destinations, warmed on first open. Reads the shared cache
    // synchronously first so a repeat open (or a second picker on the same
    // page) paints real rows immediately instead of flashing skeletons.
    useEffect(() => {
        if (!open || popularLoaded) return

        const cachedHit = getCachedSuggestions(types)
        if (cachedHit) {
            setPopular(cachedHit)
            setPopularLoaded(true)
            return
        }

        let cancelled = false
        fetchSuggestions(types).then((items) => {
            if (cancelled) return
            setPopular(items)
            setPopularLoaded(true)
        })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, popularLoaded, typesKey])

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, open, typesKey])

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
    function detectCurrentLocation() {
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
    const recentFilteprimary = types?.length ? recent.filter((r) => types.includes(r.type)) : recent
    const popularFilteprimary = popular.filter((p) => !recentFilteprimary.some((r) => r.id === p.id))
    const showCurrentRow = showCurrentLocation && !query.trim()
    const showRecent = !query.trim() && recentFilteprimary.length > 0
    const showPopular = !query.trim() && popularFilteprimary.length > 0

    // Placeholder rows stand in for the two lists that can be mid-flight.
    const showPopularSkeleton = !query.trim() && !popularLoaded
    const showSearchSkeleton = Boolean(query.trim()) && loading && results.length === 0
    // True only when there is genuinely nothing to show and nothing pending —
    // otherwise the hint would flash under the skeletons.
    const showIdleHint =
        !query.trim() && !showCurrentRow && !showRecent && !showPopular && !showPopularSkeleton

    const navList: NavEntry[] = []
    if (showCurrentRow) navList.push({ kind: 'current' })
    if (query.trim()) {
        results.forEach((loc) => navList.push({ kind: 'location', loc }))
    } else {
        recentFilteprimary.forEach((loc) => navList.push({ kind: 'location', loc }))
        popularFilteprimary.forEach((loc) => navList.push({ kind: 'location', loc }))
    }

    function activate(entry: NavEntry) {
        if (entry.kind === 'current') detectCurrentLocation()
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
                        'focus:outline-none focus:border-primary-400 focus:ring-[0.12em] border-[0.13em] focus:ring-primary-100',
                        open && 'border-primary-400 border-[0.13em] ring-[0.11em] ring-primary-100',
                        disabled && 'pointer-events-none opacity-50',
                        className,
                    )}
                >
                    <MapPinIcon weight="fill" className="mr-2 size-5 shrink-0 text-muted" />
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

                    {/* Results / suggestions.
                        Fixed height, not max-height: the panel used to grow and
                        shrink as results arrived, so the dropdown jumped under
                        the cursor on every keystroke. A constant box means rows
                        only ever scroll inside it. */}
                    <div role="listbox" className="scrollbar-slim h-80 overflow-y-auto py-1">

                        {/* Current location */}
                        {showCurrentRow && (() => {
                            const idx = navIdx++
                            return (
                                <Row
                                    icon={geoLoading
                                        ? <CircleNotchIcon className="size-4.5 animate-spin" />
                                        : <CrosshairIcon weight="bold" className="size-4.5 text-primary-500" />}
                                    primary={geoLoading ? 'Detecting your location…' : 'Use current location'}
                                    secondary={geoError || undefined}
                                    highlighted={activeIdx === idx}
                                    onClick={detectCurrentLocation}
                                />
                            )
                        })()}

                        {/* Recent */}
                        {showRecent && <SectionLabel>Recent searches</SectionLabel>}
                        {showRecent && recentFilteprimary.map((r) => {
                            const idx = navIdx++
                            return (
                                <Row
                                    key={`recent-${r.id}`}
                                    icon={<ClockIcon weight="duotone" className="size-4.5" />}
                                    primary={r.name}
                                    secondary={r.breadcrumb && r.breadcrumb !== r.name ? r.breadcrumb : undefined}
                                    badge={<TypeBadge type={r.type} />}
                                    highlighted={activeIdx === idx}
                                    onClick={() => pick(r)}
                                />
                            )
                        })}

                        {/* Popular destinations — skeletons only on a genuinely
                            cold cache, so the common case paints real rows. */}
                        {showPopularSkeleton && <ResultsSkeleton label="Popular destinations" rows={6} />}
                        {showPopular && <SectionLabel>Popular destinations</SectionLabel>}
                        {showPopular && popularFilteprimary.map((r) => {
                            const idx = navIdx++
                            return (
                                <Row
                                    key={`popular-${r.id}`}
                                    icon={<MapPinIcon weight="duotone" className="size-4.5" />}
                                    primary={r.name}
                                    secondary={r.breadcrumb && r.breadcrumb !== r.name ? r.breadcrumb : undefined}
                                    badge={<TypeBadge type={r.type} />}
                                    highlighted={activeIdx === idx}
                                    onClick={() => pick(r)}
                                />
                            )
                        })}

                        {/* Search results. Skeletons show only while the first
                            page of results for a query is in flight — on later
                            keystrokes the previous matches stay put rather than
                            strobing between rows and placeholders. */}
                        {showSearchSkeleton && <ResultsSkeleton label="Searching" rows={5} />}
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
                            <CenteredNote>
                                No locations found for &ldquo;{query.trim()}&rdquo;
                            </CenteredNote>
                        )}
                        {showIdleHint && <CenteredNote>Start typing to search cities</CenteredNote>}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}
