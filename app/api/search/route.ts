import { NextRequest }      from 'next/server'
import { db }               from '@/app/lib/db'
import { ApiResponse }      from '@/app/lib/api-response'
import { handleApiError }   from '@/app/lib/api-error'

const LIMIT = 4

type PackageRow = {
  id:          number
  title:       string
  slug:        string
  thumbnail:   string | null
  destination: { name: string } | null
  durations:       { slug: string; is_default: boolean; routes: { slug: string }[] }[]
  stay_categories: { slug: string; is_default: boolean }[]
}

/**
 * The canonical package page lives at /packages/[slug]/[duration]/[route]/[stay];
 * /packages/[slug] only exists to redirect there. Resolving the default combo
 * here saves the dropdown two server round-trips per click — and mirrors the
 * choice those redirect pages make (flagged default, else lowest sort_order).
 */
function packageHref(pkg: PackageRow): string {
  const duration = pkg.durations.find(d => d.is_default) ?? pkg.durations[0]
  const route    = duration?.routes[0]
  const stay     = pkg.stay_categories.find(s => s.is_default) ?? pkg.stay_categories[0]

  return duration && route && stay
    ? `/packages/${pkg.slug}/${duration.slug}/${route.slug}/${stay.slug}`
    : `/packages/${pkg.slug}`
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) return ApiResponse.ok({ packages: [], hotels: [], blogs: [] })

    const [packages, hotels, blogs] = await Promise.all([
      db.packages.findMany({
        where: {
          is_active: true,
          OR: [
            { title:       { contains: q, mode: 'insensitive' } },
            { destination: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id:          true,
          title:       true,
          slug:        true,
          thumbnail:   true,
          destination: { select: { name: true } },
          durations: {
            where:   { is_active: true },
            orderBy: { sort_order: 'asc' },
            select: {
              slug:       true,
              is_default: true,
              routes: {
                where:   { is_active: true },
                orderBy: { sort_order: 'asc' },
                select:  { slug: true },
                take:    1,
              },
            },
          },
          stay_categories: {
            where:   { is_active: true },
            orderBy: { sort_order: 'asc' },
            select:  { slug: true, is_default: true },
          },
        },
        take: LIMIT,
      }),

      db.hotels.findMany({
        where: {
          is_active: true,
          OR: [
            { name:  { contains: q, mode: 'insensitive' } },
            { city:  { contains: q, mode: 'insensitive' } },
            { state: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id:        true,
          name:      true,
          slug:      true,
          thumbnail: true,
          city:      true,
          state:     true,
          category:  true,
        },
        take: LIMIT,
      }),

      db.blog_posts.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title:   { contains: q, mode: 'insensitive' } },
            { excerpt: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id:          true,
          title:       true,
          slug:        true,
          cover_image: true,
          excerpt:     true,
          read_time:   true,
        },
        take: LIMIT,
      }),
    ])

    return ApiResponse.ok({
      packages: (packages as PackageRow[]).map(p => ({
        id:          p.id,
        title:       p.title,
        slug:        p.slug,
        thumbnail:   p.thumbnail,
        destination: p.destination,
        href:        packageHref(p),
      })),
      hotels,
      blogs,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
