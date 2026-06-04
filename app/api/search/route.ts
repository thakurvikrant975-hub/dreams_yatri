import { NextRequest }      from 'next/server'
import { db }               from '@/app/lib/db'
import { ApiResponse }      from '@/app/lib/api-response'
import { handleApiError }   from '@/app/lib/api-error'

const LIMIT = 4

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

    return ApiResponse.ok({ packages, hotels, blogs })
  } catch (error) {
    return handleApiError(error)
  }
}
