import { NextRequest }      from 'next/server'
import { db }               from '@/app/lib/db'
import { ApiResponse }      from '@/app/lib/api-response'
import { handleApiError }   from '@/app/lib/api-error'

const LIMIT = 4

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) return ApiResponse.ok({ packages: [], hotels: [], blogs: [] })

    const [rawPackages, hotels, blogs] = await Promise.all([
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
          // Resolved into a single default duration/route/stay slug below —
          // lets search results link straight to the full package URL
          // instead of `/packages/[slug]`, which otherwise 307s through
          // `/packages/[slug]/[duration]` and then again to
          // `/packages/[slug]/[duration]/[route]/[stay]` (see those two
          // redirect pages) before the real page ever loads.
          durations: {
            where:   { is_active: true },
            orderBy: { sort_order: 'asc' },
            select: {
              slug:       true,
              is_default: true,
              // package_routes has no is_default flag — sort_order asc's
              // first row is the closest thing (matches how the route
              // picker on the package page itself orders them).
              routes: {
                where:   { is_active: true },
                orderBy: { sort_order: 'asc' },
                select:  { slug: true },
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

    // Same "default, else first" resolution as the /packages/[slug] and
    // /packages/[slug]/[duration] redirect pages — mirrored here so a search
    // result can skip straight past both of those redirects.
    const packages = rawPackages.map(({ durations, stay_categories, ...pkg }) => {
      const defaultDuration = durations.find(d => d.is_default) ?? durations[0]
      const defaultRoute = defaultDuration?.routes[0]
      const defaultStay = stay_categories.find(s => s.is_default) ?? stay_categories[0]
      return {
        ...pkg,
        durationSlug: defaultDuration?.slug ?? null,
        routeSlug:    defaultRoute?.slug ?? null,
        staySlug:     defaultStay?.slug ?? null,
      }
    })

    return ApiResponse.ok({ packages, hotels, blogs })
  } catch (error) {
    return handleApiError(error)
  }
}
