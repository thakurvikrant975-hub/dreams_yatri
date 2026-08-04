import type { LocalResult, LocationType } from '@/app/(dashboard)/dashboard/(main)/components/location/location.types'

/**
 * Shared cache for the "Popular destinations" list every LocationSearchSelect
 * shows before the guest types anything.
 *
 * Why this isn't component state: the list is identical for every picker, but
 * it used to be fetched per instance on first open. The home hero alone mounts
 * three pickers, the dashboard's itinerary sidebar four — so opening them meant
 * three or four identical round trips, repeated on every remount and every page
 * load, for a list that changes about never.
 *
 * Three layers, cheapest first:
 *   1. module memory  — instant, shared by every picker in the tab
 *   2. localStorage   — survives reloads and new tabs, TTL-bounded
 *   3. network        — de-duplicated, so N pickers opening at once issue one
 *                       request and all await the same promise
 *
 * Keyed by the `types` filter, since a picker restricted to CITY must not read
 * a cache populated by one allowing REGION.
 */

const STORAGE_PREFIX = 'dy_location_popular_v1'

/** Popular destinations are editorial and change rarely; a day is conservative. */
const TTL_MS = 24 * 60 * 60 * 1000

type CacheEntry = { at: number; items: LocalResult[] }

const memory = new Map<string, LocalResult[]>()
const inFlight = new Map<string, Promise<LocalResult[]>>()

/** Stable key regardless of the order `types` happens to be declared in. */
export function suggestionsCacheKey(types?: LocationType[]): string {
    return types?.length ? [...types].sort().join(',') : 'default'
}

function storageKey(key: string): string {
    return `${STORAGE_PREFIX}:${key}`
}

function readStorage(key: string): LocalResult[] | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(storageKey(key))
        if (!raw) return null
        const entry = JSON.parse(raw) as CacheEntry
        if (!entry?.at || !Array.isArray(entry.items)) return null
        if (Date.now() - entry.at > TTL_MS) {
            window.localStorage.removeItem(storageKey(key))
            return null
        }
        return entry.items
    } catch {
        // Corrupt or unavailable (private mode, quota) — treat as a miss.
        return null
    }
}

function writeStorage(key: string, items: LocalResult[]): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(storageKey(key), JSON.stringify({ at: Date.now(), items } satisfies CacheEntry))
    } catch {
        // Quota or private mode — memory cache still applies for this tab.
    }
}

/**
 * Cached popular destinations, or null when nothing is warm yet. Synchronous so
 * a picker can render real rows on its very first paint instead of flashing
 * skeletons for data it already has.
 */
export function getCachedSuggestions(types?: LocationType[]): LocalResult[] | null {
    const key = suggestionsCacheKey(types)
    const hit = memory.get(key)
    if (hit) return hit

    const stored = readStorage(key)
    if (stored) {
        memory.set(key, stored)
        return stored
    }
    return null
}

/**
 * Fetch (or join an in-flight fetch for) the popular destinations. Resolves to
 * `[]` on failure rather than throwing — the picker still works by typing, so a
 * dead suggestions endpoint should degrade, not break the field.
 */
export function fetchSuggestions(types?: LocationType[], limit = 8): Promise<LocalResult[]> {
    const key = suggestionsCacheKey(types)

    const cached = getCachedSuggestions(types)
    if (cached) return Promise.resolve(cached)

    const pending = inFlight.get(key)
    if (pending) return pending

    const request = (async () => {
        try {
            const qs = new URLSearchParams({ destinationsOnly: 'true', limit: String(limit) })
            if (types?.length) qs.set('types', types.join(','))
            const res = await fetch(`/api/locations/search?${qs}`)
            if (!res.ok) return []
            const items = (await res.json()) as LocalResult[]
            if (Array.isArray(items) && items.length > 0) {
                memory.set(key, items)
                writeStorage(key, items)
            }
            return Array.isArray(items) ? items : []
        } catch {
            return []
        } finally {
            // Cleared regardless of outcome so a failed fetch can be retried on
            // the next open instead of permanently resolving to [].
            inFlight.delete(key)
        }
    })()

    inFlight.set(key, request)
    return request
}
