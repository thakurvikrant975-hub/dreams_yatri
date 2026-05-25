import { db } from "@/app/lib/db";

// ── Output types ───────────────────────────────────────────────────────────

export type RouteStop = {
  place_name: string;
  stay_days: number;
  sort_order: number;
  latitude: number | null;  // from linked Location
  longitude: number | null; // from linked Location
};

export type RouteOption = {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  meta_title: string | null;
  meta_desc: string | null;
  stops: RouteStop[];
};

export type DurationOption = {
  id: number;
  slug: string;
  label: string;
  days: number;
  nights: number;
  is_default: boolean;
  sort_order: number;
  thumbnail_url: string | null;
};

export type StayCategoryOption = {
  id: number;
  slug: string;
  label: string;
  description: string | null;
  is_default: boolean;
  min_duration_days: number | null;
  sort_order: number;
};

export type HotelDay = {
  id: number;
  sort_order: number;
  name: string;
  slug: string;
  stay_type: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  address: string | null;
  plan_name: string | null;
  meal_type: string | null;
  room_name: string | null;
  room_capacity: number | null;
  price_per_night: number;
  original_price: number | null;
  images: { url: string | null; thumbnail: string | null; alt: string | null }[];
  room_images: { url: string; thumbnail: string | null; alt: string | null }[];
};

export type ActivityDay = {
  id: number;
  sort_order: number;
  name: string;
  description: string | null;
  duration_hours: number | null;
  difficulty: string | null;
  category: string | null;
  is_optional: boolean;
  pricing_type: string;
  pricingTiers: { label: string; price: number }[];
  images: { url: string; thumbnail: string | null; alt: string | null; label: string | null }[];
};

export type TransferDay = {
  id: number;
  sort_order: number;
  pickup_name: string | null;
  drop_name: string | null;
  distance_km: number | null;
  vehicle_name: string | null;
  vehicle_type: string | null;
  vehicle_capacity: number | null;
  num_vehicles: number;
  notes: string | null;
};

export type ItineraryDayData = {
  id: number;
  day: number;
  title: string;
  description: string | null;
  hotel: HotelDay | null;
  activities: ActivityDay[];
  transfers: TransferDay[];
  notes: { message: string; type: string; position: string }[];
};

// ── Cab type types ──────────────────────────────────────────────────────────

export type CabSeasonOption = {
  id: number;
  valid_from: string;         // ISO string (serialized from Date)
  valid_to: string;           // ISO string
  pricing_type: "PER_DAY" | "PER_KM";
  weekday_price: number;
  weekend_price: number;
};

export type CabSegmentOption = {
  id: number;
  day_from: number;
  day_to: number;
  sort_order: number;
  cab_pricing_id: number;
  pricing_type: "PER_DAY" | "PER_KM";
  price: number;
  destination: { id: number; name: string };
  seasons: CabSeasonOption[];
};

export type CabTypeOption = {
  id: number;
  vehicle_id: number;
  /** Resolved: label if set, otherwise vehicle.name */
  label: string;
  note: string | null;
  is_default: boolean;
  sort_order: number;
  vehicle: {
    name: string;
    type: string;
    passenger_capacity: number;
    has_ac: boolean;
  };
  segments: CabSegmentOption[];
};

// ── Page data ───────────────────────────────────────────────────────────────

export type PackagePageData = {
  id: number;
  title: string;
  slug: string;
  thumbnail: string | null;
  description: string | null;
  inclusions: string[];
  exclusions: string[];

  destination: {
    name: string;
    slug: string;
    region: { name: string; slug: string } | null;
  };

  images: { url: string; thumbnail: string | null; alt: string | null; is_primary: boolean }[];
  gallery: { image_url: string; label: string | null; position: number }[];

  durations: DurationOption[];
  stay_categories: StayCategoryOption[];

  currentDuration: {
    id: number;
    slug: string;
    label: string;
    days: number;
    nights: number;
    routes: RouteOption[];
  };

  selectedRoute: RouteOption | null;
  selectedStay: StayCategoryOption | null;

  itinerary: ItineraryDayData[];

  pricingConfig: {
    margin_percentage: number;
    gst_percentage: number;
  } | null;

  /**
   * Active cab types for the current package + duration.
   * Segments hold per-day-range pricing (PER_DAY or PER_KM) with seasonal overrides.
   * Grouped by `segments[0].day_from – segments[0].day_to` on the frontend for display.
   */
  cabTypes: CabTypeOption[];

  tags: { name: string; slug: string }[];
  categories: { name: string; slug: string }[];
  policies: { type: string; title: string; points: string[] }[];
};

// ── Main fetch ─────────────────────────────────────────────────────────────

export async function fetchPackagePageData(
  packageSlug: string,
  durationSlug: string,
  routeSlug: string,
  staySlug: string,
): Promise<PackagePageData | null> {

  // ── Step 1: parallel fetch — package basics + current duration ─────────────
  const [pkg, currentDuration] = await Promise.all([
    db.packages.findUnique({
      where: { slug: packageSlug, is_active: true },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        description: true,
        inclusions: true,
        exclusions: true,
        destination: {
          select: {
            name: true,
            slug: true,
            region: { select: { name: true, slug: true } },
          },
        },
        images: {
          orderBy: { sort_order: "asc" },
          select: { url: true, thumbnail: true, alt: true, is_primary: true },
        },
        gallery: {
          orderBy: { position: "asc" },
          select: { image_url: true, label: true, position: true },
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
            sort_order: true,
            thumbnail_url: true,
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
        policies: {
          orderBy: { policy: { sort_order: "asc" } },
          include: { policy: { select: { type: true, title: true, points: true } } },
        },
      },
    }),

    db.package_durations.findFirst({
      where: {
        slug: durationSlug,
        is_active: true,
        package: { slug: packageSlug },
      },
      select: {
        id: true,
        slug: true,
        label: true,
        days: true,
        nights: true,
        routes: {
          where: { is_active: true },
          orderBy: { sort_order: "asc" },
          select: {
            id: true,
            slug: true,
            name: true,
            sort_order: true,
            meta_title: true,
            meta_desc: true,
            stops: {
              orderBy: { sort_order: "asc" },
              select: {
                place_name: true,
                stay_days: true,
                sort_order: true,
                location: { select: { latitude: true, longitude: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!pkg || !currentDuration) return null;

  // ── Step 2: resolve selected route + stay ──────────────────────────────────
  const routes: RouteOption[] = currentDuration.routes.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    sort_order: r.sort_order,
    meta_title: r.meta_title,
    meta_desc: r.meta_desc,
    stops: r.stops.map((s) => ({
      place_name: s.place_name,
      stay_days: s.stay_days,
      sort_order: s.sort_order,
      latitude: s.location?.latitude != null ? Number(s.location.latitude) : null,
      longitude: s.location?.longitude != null ? Number(s.location.longitude) : null,
    })),
  }));

  const selectedRoute =
    routes.find((r) => r.slug === routeSlug) ??
    routes[0] ??
    null;

  const selectedStay =
    pkg.stay_categories.find((s) => s.slug === staySlug) ??
    pkg.stay_categories.find((s) => s.is_default) ??
    pkg.stay_categories[0] ??
    null;

  if (!selectedRoute || !selectedStay) return null;

  // ── Step 3: parallel fetch — itinerary + pricing config + cab types ────────
  const [itineraries, pricingConfig, rawCabTypes] = await Promise.all([
    db.package_itineraries.findMany({
      where: {
        package_id: pkg.id,
        duration_id: currentDuration.id,
        route_id: selectedRoute.id,
      },
      orderBy: { day: "asc" },
      select: {
        id: true,
        day: true,
        title: true,
        description: true,
        itineraryStays: {
          where: { stay_category_id: selectedStay.id },
          take: 1,
          select: {
            sort_order: true,
            num_nights: true,
            room_pricing: {
              select: {
                plan_name: true,
                price_per_night: true,
                original_price: true,
                meal_type: { select: { name: true } },
                hotel: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    stay_type: true,
                    check_in_time: true,
                    check_out_time: true,
                    address: true,
                    images: {
                      where: { category: { room_pricing_id: null } },
                      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                      take: 5,
                      select: { url: true, thumbnail: true, alt: true },
                    },
                  },
                },
                room: {
                  select: {
                    name: true,
                    max_occupancy: true,
                    images: {
                      orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                      take: 2,
                      select: { url: true, thumbnail: true, alt: true },
                    },
                  },
                },
              },
            },
          },
        },
        itinerary_activities: {
          orderBy: { sort_order: "asc" },
          select: {
            id: true,
            sort_order: true,
            is_optional: true,
            activity: {
              select: {
                id: true,
                name: true,
                description: true,
                duration_hours: true,
                difficulty: true,
                category: { select: { name: true } },
                images: {
                  orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
                  take: 4,
                  select: { url: true, thumbnail: true, alt: true, label: true },
                },
              },
            },
            variant: {
              select: {
                pricing_type: true,
                pricing: {
                  where: { is_active: true },
                  orderBy: { sort_order: "asc" },
                  select: { label: true, price: true },
                },
              },
            },
          },
        },
        itinerary_transfers: {
          orderBy: { sort_order: "asc" },
          select: {
            id: true,
            sort_order: true,
            num_vehicles: true,
            notes: true,
            route: {
              select: {
                pickup_name: true,
                drop_name: true,
                distance_km: true,
              },
            },
            vehicle: {
              select: {
                name: true,
                type: true,
                passenger_capacity: true,
              },
            },
          },
        },
        itinerary_notes: {
          orderBy: { sort_order: "asc" },
          select: { message: true, type: true, position: true },
        },
      },
    }),

    db.package_pricing.findUnique({
      where: {
        package_id_duration_id_stay_category_id: {
          package_id: pkg.id,
          duration_id: currentDuration.id,
          stay_category_id: selectedStay.id,
        },
      },
      select: { margin_percentage: true, gst_percentage: true },
    }),

    // ── Active cab types for this package + duration ─────────────────────────
    db.package_cab_types.findMany({
      where: {
        package_id: pkg.id,
        duration_id: currentDuration.id,
        is_active: true,
      },
      orderBy: { sort_order: "asc" },
      select: {
        id: true,
        vehicle_id: true,
        label: true,
        note: true,
        is_default: true,
        sort_order: true,
        vehicle: {
          select: {
            name: true,
            type: true,
            passenger_capacity: true,
            has_ac: true,
          },
        },
        segments: {
          orderBy: { sort_order: "asc" },
          select: {
            id: true,
            day_from: true,
            day_to: true,
            sort_order: true,
            cab_pricing: {
              select: {
                id: true,
                pricing_type: true,
                price: true,
                destination: { select: { id: true, name: true } },
                seasons: {
                  where: { is_active: true },
                  orderBy: { valid_from: "asc" },
                  select: {
                    id: true,
                    valid_from: true,
                    valid_to: true,
                    pricing_type: true,
                    weekday_price: true,
                    weekend_price: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  // ── Step 4: shape itinerary ────────────────────────────────────────────────
  type ItineraryWithNights = ItineraryDayData & { _numNights: number };

  const itineraryWithNights: ItineraryWithNights[] = itineraries.map((day) => {
    const stay = day.itineraryStays[0] ?? null;
    const rp = stay?.room_pricing ?? null;

    const hotel: HotelDay | null = rp
      ? {
          id: rp.hotel.id,
          sort_order: stay?.sort_order ?? 0,
          name: rp.hotel.name,
          slug: rp.hotel.slug,
          stay_type: rp.hotel.stay_type,
          check_in_time: rp.hotel.check_in_time,
          check_out_time: rp.hotel.check_out_time,
          address: rp.hotel.address,
          plan_name: rp.plan_name,
          meal_type: rp.meal_type?.name ?? null,
          room_name: rp.room?.name ?? null,
          room_capacity: rp.room?.max_occupancy ?? null,
          price_per_night: Number(rp.price_per_night),
          original_price: rp.original_price ? Number(rp.original_price) : null,
          images: rp.hotel.images,
          room_images: rp.room?.images ?? [],
        }
      : null;

    const activities: ActivityDay[] = day.itinerary_activities.map((ia) => ({
      id: ia.activity.id,
      sort_order: ia.sort_order,
      name: ia.activity.name,
      description: ia.activity.description,
      duration_hours: ia.activity.duration_hours
        ? Number(ia.activity.duration_hours)
        : null,
      difficulty: ia.activity.difficulty,
      category: ia.activity.category?.name ?? null,
      is_optional: ia.is_optional,
      pricing_type: ia.variant?.pricing_type ?? "PER_PERSON",
      pricingTiers: (ia.variant?.pricing ?? []).map((p) => ({
        label: p.label,
        price: Number(p.price),
      })),
      images: ia.activity.images,
    }));

    const transfers: TransferDay[] = day.itinerary_transfers.map((tr) => ({
      id: tr.id,
      sort_order: tr.sort_order,
      pickup_name: tr.route?.pickup_name ?? null,
      drop_name: tr.route?.drop_name ?? null,
      distance_km: tr.route?.distance_km ? Number(tr.route.distance_km) : null,
      vehicle_name: tr.vehicle?.name ?? null,
      vehicle_type: tr.vehicle?.type ?? null,
      vehicle_capacity: tr.vehicle?.passenger_capacity ?? null,
      num_vehicles: tr.num_vehicles,
      notes: tr.notes,
    }));

    return {
      id: day.id,
      day: day.day,
      title: day.title,
      description: day.description,
      hotel,
      activities,
      transfers,
      notes: day.itinerary_notes,
      _numNights: stay?.num_nights ?? 1,
    };
  });

  // Propagate multi-night hotel stays to covered days that have no own stay
  const itinerary: ItineraryDayData[] = itineraryWithNights.map((d, idx) => {
    if (d.hotel !== null) return d;
    for (let j = 0; j < idx; j++) {
      const prior = itineraryWithNights[j];
      if (prior.hotel && prior.day + prior._numNights > d.day) {
        return { ...d, hotel: prior.hotel };
      }
    }
    return d;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }).map(({ _numNights, ...d }) => d);

  // ── Step 4b: shape cab types ──────────────────────────────────────────────
  // Decimal fields are converted to numbers; Date fields to ISO strings so the
  // object can safely be passed from the server component to any client component.
  const cabTypes: CabTypeOption[] = rawCabTypes.map((ct) => ({
    id: ct.id,
    vehicle_id: ct.vehicle_id,
    label: ct.label ?? ct.vehicle.name,
    note: ct.note,
    is_default: ct.is_default,
    sort_order: ct.sort_order,
    vehicle: {
      name: ct.vehicle.name,
      type: ct.vehicle.type,
      passenger_capacity: ct.vehicle.passenger_capacity,
      has_ac: ct.vehicle.has_ac,
    },
    segments: ct.segments.map((seg) => ({
      id: seg.id,
      day_from: seg.day_from,
      day_to: seg.day_to,
      sort_order: seg.sort_order,
      cab_pricing_id: seg.cab_pricing.id,
      pricing_type: seg.cab_pricing.pricing_type as "PER_DAY" | "PER_KM",
      price: Number(seg.cab_pricing.price),
      destination: seg.cab_pricing.destination,
      seasons: seg.cab_pricing.seasons.map((s) => ({
        id: s.id,
        valid_from: s.valid_from.toISOString(),
        valid_to: s.valid_to.toISOString(),
        pricing_type: s.pricing_type as "PER_DAY" | "PER_KM",
        weekday_price: Number(s.weekday_price),
        weekend_price: Number(s.weekend_price),
      })),
    })),
  }));

  // ── Step 5: assemble final shape ──────────────────────────────────────────
  return {
    id: pkg.id,
    title: pkg.title,
    slug: pkg.slug,
    thumbnail: pkg.thumbnail,
    description: pkg.description,
    inclusions: pkg.inclusions,
    exclusions: pkg.exclusions,
    destination: {
      name: pkg.destination.name,
      slug: pkg.destination.slug,
      region: pkg.destination.region ?? null,
    },
    images: pkg.images,
    gallery: pkg.gallery,
    durations: pkg.durations,
    stay_categories: pkg.stay_categories,
    currentDuration: {
      id: currentDuration.id,
      slug: currentDuration.slug,
      label: currentDuration.label,
      days: currentDuration.days,
      nights: currentDuration.nights,
      routes,
    },
    selectedRoute,
    selectedStay,
    itinerary,
    cabTypes,
    pricingConfig: pricingConfig
      ? {
          margin_percentage: Number(pricingConfig.margin_percentage),
          gst_percentage: Number(pricingConfig.gst_percentage),
        }
      : null,
    tags: pkg.tags.map((t) => t.tag),
    categories: pkg.categories.map((c) => c.category),
    policies: pkg.policies.map((p) => ({ type: p.policy.type, title: p.policy.title, points: p.policy.points })),
  };
}

// ── generateStaticParams helper ────────────────────────────────────────────
// Used by the page to pre-build active packages at build time.

export async function getActivePackageParams() {
  const packages = await db.packages.findMany({
    where: { is_active: true },
    select: {
      slug: true,
      durations: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          slug: true,
          is_default: true,
          routes: {
            where: { is_active: true },
            orderBy: { sort_order: "asc" },
            select: { slug: true, sort_order: true },
          },
        },
      },
      stay_categories: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: { slug: true, is_default: true },
      },
    },
  });

  const params: { slug: string; duration: string; route: string; stay: string }[] = [];

  for (const pkg of packages) {
    const defaultDuration =
      pkg.durations.find((d) => d.is_default) ?? pkg.durations[0];
    if (!defaultDuration) continue;

    const defaultRoute = defaultDuration.routes[0];
    if (!defaultRoute) continue;

    const defaultStay =
      pkg.stay_categories.find((s) => s.is_default) ?? pkg.stay_categories[0];
    if (!defaultStay) continue;

    // Pre-build the default combination for each package.
    // Add more combinations here if needed (e.g., all durations × routes × stays).
    params.push({
      slug: pkg.slug,
      duration: defaultDuration.slug,
      route: defaultRoute.slug,
      stay: defaultStay.slug,
    });
  }

  return params;
}
