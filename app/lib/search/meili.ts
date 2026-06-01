import { Meilisearch, type Index } from 'meilisearch'

// ── Config ───────────────────────────────────────────────────────────────────
// MEILI_HOST / MEILI_MASTER_KEY come from .env. When unset (e.g. Meili not yet
// running), every helper degrades gracefully so callers can fall back to Postgres.
const HOST = process.env.MEILI_HOST ?? process.env.NEXT_PUBLIC_MEILI_HOST ?? ''
const KEY  = process.env.MEILI_MASTER_KEY ?? process.env.MEILI_API_KEY ?? ''

export const LOCATIONS_INDEX = 'locations'

export const isMeiliConfigured = Boolean(HOST)

let _client: Meilisearch | null = null

export function getMeili(): Meilisearch | null {
    if (!isMeiliConfigured) return null
    if (!_client) _client = new Meilisearch({ host: HOST, apiKey: KEY || undefined })
    return _client
}

// ── Document shape stored in the locations index ─────────────────────────────
export type MeiliLocationDoc = {
    id: string            // location id (BigInt → string), used as Meili primary key
    name: string
    official_name: string | null
    type: string
    slug: string
    breadcrumb: string
    state: string | null
    country: string | null
    latitude: number | null
    longitude: number | null
    is_featured: boolean
    is_popular: boolean
    is_active: boolean
    is_searchable: boolean
}

// ── Index settings — applied by the reindex script ───────────────────────────
export const LOCATIONS_SETTINGS = {
    searchableAttributes: ['name', 'official_name', 'breadcrumb', 'state', 'country'],
    filterableAttributes: ['type', 'is_active', 'is_searchable'],
    sortableAttributes: ['is_featured', 'is_popular'],
    // Featured/popular float to the top; then Meili's relevance rules.
    rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
        'is_featured:desc',
        'is_popular:desc',
    ],
    // Slightly stricter than default so short city names don't over-match,
    // but still tolerant: 1 typo from 4 chars, 2 typos from 8 chars.
    typoTolerance: {
        enabled: true,
        minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
} as const

export async function getLocationsIndex(): Promise<Index | null> {
    const client = getMeili()
    if (!client) return null
    return client.index(LOCATIONS_INDEX)
}

// ── Incremental sync helpers (call from server actions after DB writes) ───────
export async function upsertLocationDoc(doc: MeiliLocationDoc): Promise<void> {
    const idx = await getLocationsIndex()
    if (!idx) return
    await idx.addDocuments([doc], { primaryKey: 'id' })
}

export async function removeLocationDoc(id: string | number): Promise<void> {
    const idx = await getLocationsIndex()
    if (!idx) return
    await idx.deleteDocument(String(id))
}
