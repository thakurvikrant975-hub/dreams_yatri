// app/repositories/packages.repository.ts
import { db } from "../lib/db";
import { Ok, Result } from "../lib/result";
import type {
  PackagePageData,
  RouteOption,
  Activity,
  ItineraryDay,
} from "@/app/types/package-page.types";

export const packagesRepository = {

  // ── List packages ─────────────────────────────────────────────────────────
  findMany: async ({ page, limit }: { page: number; limit: number }) => {
    const [data, total] = await Promise.all([
      db.packages.findMany({
        where: { is_active: true },
        orderBy: { created_at: "desc" },
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnail: true,
          description: true,
          destination: {
            select: {
              name: true,
              slug: true,
              region: { select: { name: true } },
            },
          },
          durations: {
            where: { is_active: true },
            orderBy: { sort_order: "asc" },
            take: 1,
            select: {
              days: true,
              nights: true,
              pricing: {
                where: { is_active: true },
                orderBy: { price: "asc" },
                take: 1,
                select: { price: true, original_price: true },
              },
            },
          },
        },
      }),
      db.packages.count({ where: { is_active: true } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  findPageData: async (
    packageSlug: string,
    durationSlug: string,
    routeSlug: string,
    staySlug: string,
  ): Promise<Result<PackagePageData>> => {
    try {
      const [pkg, currentDuration] = await Promise.all([
        db.packages.findUnique({
          where: { slug: packageSlug },
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnail: true,
            cover_image: true,
            description: true,
            meta_title: true,
            meta_desc: true,
            destination: {
              select: {
                name: true,
                slug: true,
                region: { select: { name: true, slug: true } },
              },
            },
            images: {
              orderBy: { sort_order: "asc" },
              select: { url: true, thumbnail: true, blur_base64: true, alt: true, is_primary: true },
            },
            durations: {
              where: { is_active: true },
              orderBy: { sort_order: "asc" },
              select: {
                id: true,
                slug: true,
                label: true,
                days: true,
                nights: true,
                is_default: true,
                routes: true,
                meta_title: true,
                meta_desc: true,
                pricing: {
                  where: { is_active: true },
                  orderBy: { price: "asc" },
                  take: 1,
                  select: { price: true, original_price: true },
                },
              },
            },
            stay_categories: {
              where: { is_active: true },
              orderBy: { sort_order: "asc" },
              select: {
                id: true,
                slug: true,
                label: true,
                description: true,
                is_default: true,
                min_duration_days: true,
                sort_order: true,
              },
            },
            tags: { select: { tag: { select: { name: true, slug: true } } } },
            categories: { select: { category: { select: { name: true, slug: true } } } },
          },
        }),
        db.package_durations.findFirst({
          where: {
            slug: durationSlug,
            package: { slug: packageSlug },
          },
          select: {
            id: true,
            slug: true,
            label: true,
            days: true,
            nights: true,
            routes: true,
            is_default: true,
            meta_title: true,
            meta_desc: true,
            pricing: {
              where: { is_active: true },
              select: {
                route_index: true,
                stay_category_id: true,
                price: true,
                original_price: true,
              },
            },
            itineraries: {
              orderBy: { day: "asc" },
              select: {
                id: true,
                day: true,
                title: true,
                description: true,
                activity_ids: true,
                meals: true,
                route_index: true,
                hotel_days: true,
                hotel: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    star_rating: true,
                    category: true,
                    check_in_time: true,
                    check_out_time: true,
                    images: {
                      where: { is_primary: true },
                      take: 1,
                      select: { url: true, thumbnail: true, blur_base64: true, alt: true },
                    },
                    room_pricing: {
                      where: { is_active: true, season: "all" },
                      orderBy: { sort_order: "asc" },
                      select: {
                        room_type: true,
                        description: true,
                        occupancy: true,
                        price_per_night: true,
                        original_price: true,
                        amenities: true,
                        margin_percentage: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);

      if (!pkg) return Result.notFound("Package");
      if (!currentDuration) return Result.notFound("Duration");

      // ── Resolve route + stay ──────────────────────────────────────────────
      const routes = currentDuration.routes as RouteOption[];
      const routeIndex =
        routes.find(r => r.slug === routeSlug)?.id ??
        routes.find(r => r.is_default)?.id ??
        0;

      const selectedStayCategory =
        pkg.stay_categories.find(s => s.slug === staySlug) ??
        pkg.stay_categories.find(s => s.is_default) ??
        pkg.stay_categories[0];

      // ── Filter itinerary ──────────────────────────────────────────────────
      const filteredItinerary = currentDuration.itineraries.filter(
        day => day.route_index === null || day.route_index === routeIndex
      );

      // ── Batch fetch activities ─────────────────────────────────────────────────
      const allActivityIds = [
        ...new Set(
          filteredItinerary
            .flatMap(day => (day.activity_ids as number[] | null) ?? [])
            .filter((id): id is number => typeof id === "number")
        ),
      ];

      const activitiesRaw = allActivityIds.length > 0
        ? await db.activities.findMany({
          where: { id: { in: allActivityIds }, is_active: true },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            duration_hours: true,
            difficulty: true,
            category: true,
            price: true,
            original_price: true,
            margin_percentage: true,
            pricing_type: true,
            min_persons: true,
            max_persons: true,
            images: {
              orderBy: { sort_order: "asc" },
              take: 3,
              select: {
                url: true,
                thumbnail: true,
                blur_base64: true,
                alt: true,
                is_primary: true,
              },
            },
          },
        })
        : [];

      // ── Activity map — explicitly typed as Activity ───────────────────────
      const activityMap = new Map<number, Activity>(
        activitiesRaw.map(act => [
          act.id,
          {
            id: act.id,
            name: act.name,
            slug: act.slug,
            description: act.description,
            duration_hours: act.duration_hours ? Number(act.duration_hours) : null,
            difficulty: act.difficulty,
            category: act.category,
            price: act.price ? Number(act.price) : null,
            original_price: act.original_price ? Number(act.original_price) : null,
            margin_percentage: Number(act.margin_percentage),
            pricing_type: act.pricing_type ?? null,
            min_persons: act.min_persons ?? null,
            max_persons: act.max_persons ?? null,
            images: act.images,
          },
        ])
      );

      const filteredItineraryForClient: ItineraryDay[] = filteredItinerary.map(day => ({
        id: day.id,
        day: day.day,
        title: day.title,
        description: day.description,
        meals: day.meals as string[] | null,
        route_index: day.route_index,
        activity_details: ((day.activity_ids as number[] | null) ?? [])
          .map(id => activityMap.get(id))
          .filter((act): act is Activity => act !== undefined),
        hotel: day.hotel
          ? {
            id: day.hotel.id,
            name: day.hotel.name,
            slug: day.hotel.slug,
            star_rating: day.hotel.star_rating,
            category: day.hotel.category,
            check_in_time: day.hotel.check_in_time,
            check_out_time: day.hotel.check_out_time,
            images: day.hotel.images, 
            room_pricing: day.hotel.room_pricing.map(r => ({
              room_type: r.room_type,
              description: r.description,
              occupancy: r.occupancy,
              amenities: r.amenities as unknown,
              price_per_night: Number(r.price_per_night),
              original_price: r.original_price ? Number(r.original_price) : null,
              margin_percentage: r.margin_percentage ? Number(r.margin_percentage) : null,
            })),
          }
          : null,
          hotel_days: day.hotel_days as number[] | null, 
      }));

      // ── Pricing ───────────────────────────────────────────────────────────
      const currentPricing = currentDuration.pricing
        .filter(p => p.route_index === null || p.route_index === routeIndex)
        .map(p => ({
          route_index: p.route_index,
          stay_category_id: p.stay_category_id,
          price: Number(p.price),
          original_price: p.original_price ? Number(p.original_price) : null,
        }));

      // ── Durations for selector ────────────────────────────────────────────
      const durationsForClient = pkg.durations.map(d => ({
        id: d.id,
        slug: d.slug,
        label: d.label,
        days: d.days,
        nights: d.nights,
        is_default: d.is_default,
        routes: d.routes as RouteOption[],
        meta_title: d.meta_title,
        meta_desc: d.meta_desc,
        startingPrice: d.pricing[0]?.price ? Number(d.pricing[0].price) : null,
        originalPrice: d.pricing[0]?.original_price ? Number(d.pricing[0].original_price) : null,
      }));

      return Ok({
        id: pkg.id,
        title: pkg.title,
        slug: pkg.slug,
        thumbnail: pkg.thumbnail,
        cover_image: pkg.cover_image,
        description: pkg.description,
        meta_title: pkg.meta_title,
        meta_desc: pkg.meta_desc,
        destination: pkg.destination,
        images: pkg.images,
        tags: pkg.tags.map(t => t.tag),
        categories: pkg.categories.map(c => c.category),
        stay_categories: pkg.stay_categories,
        durations: durationsForClient,
        currentDuration: {
          id: currentDuration.id,
          slug: currentDuration.slug,
          label: currentDuration.label,
          days: currentDuration.days,
          nights: currentDuration.nights,
          is_default: currentDuration.is_default,
          routes,
          meta_title: currentDuration.meta_title,
          meta_desc: currentDuration.meta_desc,
          filteredItinerary: filteredItineraryForClient,
          currentPricing,
          selectedRouteIndex: routeIndex,
          selectedStayCategory,
        },
      });

    } catch (err) {
      console.error("[packagesRepository.findPageData]", err);
      return Result.dbError(err);
    }
  },

  // ── Fresh pricing — no cache ──────────────────────────────────────────────
  findPricing: async (packageSlug: string) => {
    const pkg = await db.packages.findUnique({
      where: { slug: packageSlug },
      select: { id: true },
    });
    if (!pkg) return null;

    return db.package_pricing.findMany({
      where: { package_id: pkg.id, is_active: true },
      select: {
        duration_id: true,
        route_index: true,
        stay_category_id: true,
        price: true,
        original_price: true,
      },
    });
  },

  // ── Hotels — loaded on tab click ──────────────────────────────────────────
  findHotels: async (packageSlug: string) => {
    const pkg = await db.packages.findUnique({
      where: { slug: packageSlug },
      select: { id: true },
    });
    if (!pkg) return null;

    return db.package_hotels.findMany({
      where: { package_id: pkg.id },
      select: {
        is_recommended: true,
        night_number: true,
        stay_category: { select: { id: true, label: true, sort_order: true } },
        hotel: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            star_rating: true,
            category: true,
            address: true,
            amenities: true,
            check_in_time: true,
            check_out_time: true,
            images: {
              orderBy: { sort_order: "asc" },
              take: 5,
              select: { url: true, thumbnail: true, blur_base64: true, alt: true, is_primary: true },
            },
            room_pricing: {               // ← use room_pricing instead of rooms
              where: { is_active: true },
              orderBy: { price_per_night: "asc" },
              select: {
                room_type: true,
                description: true,
                occupancy: true,
                price_per_night: true,
                original_price: true,
                season: true,
                amenities: true,
              },
            },
          },
        },
      },
      orderBy: { stay_category: { sort_order: "asc" } },
    });
  },

  // ── Activities — loaded on tab click ──────────────────────────────────────
  findActivities: async (packageSlug: string) => {
    const pkg = await db.packages.findUnique({
      where: { slug: packageSlug },
      select: { id: true },
    });
    if (!pkg) return null;

    return db.package_activities.findMany({
      where: { package_id: pkg.id },
      select: {
        day_number: true,
        is_optional: true,
        extra_price: true,
        activity: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            duration_hours: true,
            difficulty: true,
            category: true,
            price: true,
            images: {
              where: { is_primary: true },
              take: 1,
              select: { url: true, thumbnail: true, blur_base64: true, alt: true },
            },
          },
        },
      },
      orderBy: { day_number: "asc" },
    });
  },

};