/**
 * Backfill / rebuild the Meilisearch `locations` index from Postgres.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/reindex-locations.ts
 *
 * Requires MEILI_HOST (+ MEILI_MASTER_KEY) and DATABASE_URL in the environment.
 * Safe to re-run — documents are upserted by id, so it's idempotent.
 */
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { Meilisearch } from 'meilisearch'
import { LOCATIONS_INDEX, LOCATIONS_SETTINGS, type MeiliLocationDoc } from '../app/lib/search/meili'

const HOST = process.env.MEILI_HOST ?? ''
const KEY = process.env.MEILI_MASTER_KEY ?? process.env.MEILI_API_KEY ?? ''
const BATCH = 2000

async function main() {
    if (!HOST) throw new Error('MEILI_HOST is not set. Add it to .env first.')
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.')

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const db = new PrismaClient({ adapter: new PrismaPg(pool) })
    const meili = new Meilisearch({ host: HOST, apiKey: KEY || undefined })

    // Ensure index exists, then apply settings (typo tolerance, ranking, etc.)
    await meili.createIndex(LOCATIONS_INDEX, { primaryKey: 'id' }).catch(() => { /* already exists */ })
    const index = meili.index(LOCATIONS_INDEX)
    await index.updateSettings(LOCATIONS_SETTINGS as unknown as Record<string, unknown>)
    console.log('Applied index settings.')

    let cursor: bigint | undefined
    let total = 0

    for (;;) {
        const rows = await db.location.findMany({
            where: { is_active: true, is_searchable: true },
            orderBy: { id: 'asc' },
            take: BATCH,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            select: {
                id: true, name: true, official_name: true, type: true, slug: true,
                latitude: true, longitude: true,
                is_featured: true, is_popular: true, is_active: true, is_searchable: true,
                state: { select: { name: true } },
                country: { select: { name: true } },
            },
        })
        if (rows.length === 0) break

        const docs: MeiliLocationDoc[] = rows.map((r) => {
            const parts = [r.name]
            if (r.state?.name && r.state.name !== r.name) parts.push(r.state.name)
            if (r.country?.name && r.country.name !== r.name) parts.push(r.country.name)
            return {
                id: r.id.toString(),
                name: r.name,
                official_name: r.official_name,
                type: r.type,
                slug: r.slug,
                breadcrumb: parts.join(', '),
                state: r.state?.name ?? null,
                country: r.country?.name ?? null,
                latitude: r.latitude != null ? Number(r.latitude) : null,
                longitude: r.longitude != null ? Number(r.longitude) : null,
                is_featured: r.is_featured,
                is_popular: r.is_popular,
                is_active: r.is_active,
                is_searchable: r.is_searchable,
            }
        })

        await index.addDocuments(docs, { primaryKey: 'id' })
        total += docs.length
        cursor = rows[rows.length - 1].id
        console.log(`Queued ${total} locations…`)
    }

    console.log(`\nDone — ${total} locations sent to Meilisearch (indexing finishes asynchronously).`)
    await pool.end()
    process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
