// app/repositories/packages.repository.ts
import { db } from "../lib/db";

export const packagesRepository = {

  // ── List packages ─────────────────────────────────────────────────────────
  findMany: async ({ page, limit }: { page: number; limit: number }) => {
    const [data, total] = await Promise.all([
      db.packages.findMany({
        where:   { is_active: true },
        orderBy: { created_at: "desc" },
        take:    limit,
        skip:    (page - 1) * limit,
        select: {
          id:          true,
          title:       true,
          slug:        true,
          thumbnail:   true,
          description: true,
          destination: {
            select: {
              name:   true,
              slug:   true,
              region: { select: { name: true } },
            },
          },
          durations: {
            where:   { is_active: true },
            orderBy: { sort_order: "asc" },
            take:    1,
            select: {
              days:   true,
              nights: true,
              pricing: {
                where:   { is_active: true },
                orderBy: { price: "asc" },
                take:    1,
                select:  { price: true, original_price: true },
              },
            },
          },
        },
      }),
      db.packages.count({ where: { is_active: true } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  // ── SSR page data — single combined query ─────────────────────────────────
  findPageData: async (packageSlug: string, durationSlug: string) => {
    const pkg = await db.packages.findUnique({
      where: { slug: packageSlug },
      select: {
        id:          true,
        title:       true,
        slug:        true,
        thumbnail:   true,
        description: true,
        destination: {
          select: {
            name:   true,
            slug:   true,
            region: { select: { name: true, slug: true } },
          },
        },
        images: {
          orderBy: { sort_order: "asc" },
          select:  { url: true, thumbnail: true, blur_base64: true, alt: true, is_primary: true },
        },
        durations: {
          where:   { is_active: true },
          orderBy: { sort_order: "asc" },
          select: {
            id:         true,
            slug:       true,
            label:      true,
            days:       true,
            nights:     true,
            is_default: true,
            routes:     true,
            meta_title: true,
            meta_desc:  true,
            pricing: {
              where:   { is_active: true },
              orderBy: { price: "asc" },
              take:    1,
              select:  { price: true, original_price: true },
            },
          },
        },
        stay_categories: {
          where:   { is_active: true },
          orderBy: { sort_order: "asc" },
          select: {
            id:                true,
            label:             true,
            description:       true,
            is_default:        true,
            min_duration_days: true,
            sort_order:        true,
          },
        },
        tags:       { select: { tag:      { select: { name: true, slug: true } } } },
        categories: { select: { category: { select: { name: true, slug: true } } } },
      },
    });

    if (!pkg) return null;

    // Current duration from URL slug
    const currentDuration = await db.package_durations.findUnique({
      where: {
        package_id_slug: { package_id: pkg.id, slug: durationSlug },
      },
      select: {
        id:         true,
        slug:       true,
        label:      true,
        days:       true,
        nights:     true,
        routes:     true,
        is_default: true,
        meta_title: true,
        meta_desc:  true,
        pricing: {
          where:  { is_active: true },
          select: {
            route_index:      true,
            stay_category_id: true,
            price:            true,
            original_price:   true,
          },
        },
        itineraries: {
          orderBy: { day: "asc" },
          select: {
            id:           true,
            day:          true,
            title:        true,
            description:  true,
            activities:   true,
            activity_ids: true,
            meals:        true,
            route_index:  true,
            hotel: {
              select: {
                id:             true,
                name:           true,
                slug:           true,
                star_rating:    true,
                category:       true,
                check_in_time:  true,
                check_out_time: true,
                images: {
                  where:  { is_primary: true },
                  take:   1,
                  select: { url: true, thumbnail: true, blur_base64: true, alt: true },
                },
              },
            },
          },
        },
      },
    });

    if (!currentDuration) return null;

    return { ...pkg, currentDuration };
  },

  // ── Fresh pricing — no cache ──────────────────────────────────────────────
  findPricing: async (packageSlug: string) => {
    const pkg = await db.packages.findUnique({
      where:  { slug: packageSlug },
      select: { id: true },
    });
    if (!pkg) return null;

    return db.package_pricing.findMany({
      where:  { package_id: pkg.id, is_active: true },
      select: {
        duration_id:      true,
        route_index:      true,
        stay_category_id: true,
        price:            true,
        original_price:   true,
      },
    });
  },

  // ── Hotels — loaded on tab click ──────────────────────────────────────────
  findHotels: async (packageSlug: string) => {
    const pkg = await db.packages.findUnique({
      where:  { slug: packageSlug },
      select: { id: true },
    });
    if (!pkg) return null;

    return db.package_hotels.findMany({
      where: { package_id: pkg.id },
      select: {
        is_recommended: true,
        night_number:   true,
        stay_category:  { select: { id: true, label: true, sort_order: true } },
        hotel: {
          select: {
            id:             true,
            name:           true,
            slug:           true,
            description:    true,
            star_rating:    true,
            category:       true,
            address:        true,
            amenities:      true,
            check_in_time:  true,
            check_out_time: true,
            images: {
              orderBy: { sort_order: "asc" },
              take:    5,
              select:  { url: true, thumbnail: true, blur_base64: true, alt: true, is_primary: true },
            },
            rooms: {
              where:  { is_active: true },
              select: { name: true, capacity: true, amenities: true },
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
      where:  { slug: packageSlug },
      select: { id: true },
    });
    if (!pkg) return null;

    return db.package_activities.findMany({
      where: { package_id: pkg.id },
      select: {
        day_number:  true,
        is_optional: true,
        extra_price: true,
        activity: {
          select: {
            id:             true,
            name:           true,
            slug:           true,
            description:    true,
            duration_hours: true,
            difficulty:     true,
            category:       true,
            price:          true,
            images: {
              where:  { is_primary: true },
              take:   1,
              select: { url: true, thumbnail: true, blur_base64: true, alt: true },
            },
          },
        },
      },
      orderBy: { day_number: "asc" },
    });
  },

};