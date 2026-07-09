"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { fetchPackagePageData } from "@/app/actions/packages/fetch-page-data";
import { getHeroImage, getThumbnailImage } from "@/app/lib/imageUrl";
import { db } from "@/app/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Real hotel-room / activity search, scoped by city name.
//
// Note: real hotel/activity rows in this catalog are keyed by the free-text
// `city` field, not `destination_id` (that FK is only populated on a handful
// of test rows) — so unlike the admin package-builder's search (which filters
// by destination_id), this searches `city` directly against the route stop's
// name, with destination.name as a secondary match for any rows that *do*
// have destination_id set. Not restricted to LIVE listing_status — this is
// an internal sales/ops tool, and virtually all real hotels sit in DRAFT
// (that status gates customer-facing visibility, not internal usability).
// ─────────────────────────────────────────────────────────────────────────────

const HOTEL_IMAGE_ORDER = [{ is_primary: "desc" as const }, { sort_order: "asc" as const }];

const HOTEL_ROOM_SELECT = {
  id: true,
  plan_name: true,
  price_per_night: true,
  meal_type: { select: { name: true } },
  hotel: {
    select: {
      name: true, category: true, thumbnail: true,
      images: { select: { url: true, thumbnail: true }, orderBy: HOTEL_IMAGE_ORDER, take: 1 },
    },
  },
  room: {
    select: {
      name: true,
      images: { select: { url: true, thumbnail: true }, orderBy: HOTEL_IMAGE_ORDER, take: 3 },
    },
  },
} as const;

export interface HotelRoomResult {
  id:            number;
  hotelName:     string;
  roomName:      string;
  mealPlanName:  string | null;
  pricePerNight: number;
  thumbnail:     string | null;
  /** The hotel's own main photo — shown first in the picked-hotel gallery. */
  hotelPhoto:    string | null;
  /** Up to 3 photos of the specific room booked. */
  roomPhotos:    string[];
  category:      string | null;
}

export async function searchHotelRoomsForBuilder(cityOrDestinationName: string, query: string): Promise<HotelRoomResult[]> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  if (!city) return [];

  const list = await db.hotel_room_pricing.findMany({
    where: {
      is_active: true,
      hotel: {
        is_active: true,
        OR: [
          { city: { contains: city, mode: "insensitive" } },
          { destination: { name: { contains: city, mode: "insensitive" } } },
        ],
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
    },
    select: HOTEL_ROOM_SELECT,
    take: 20,
    orderBy: [{ hotel: { name: "asc" } }, { sort_order: "asc" }],
  });

  return list.map((item) => {
    const rawHotelPhoto = item.hotel.images[0]?.thumbnail ?? item.hotel.images[0]?.url ?? item.hotel.thumbnail ?? null;
    const rawRoomPhotos = (item.room?.images ?? []).map((img) => img.thumbnail ?? img.url).filter((u): u is string => !!u);
    const rawThumbnail = rawRoomPhotos[0] ?? rawHotelPhoto ?? null;
    return {
      id:            item.id,
      hotelName:     item.hotel.name,
      roomName:      item.room?.name ?? "Room",
      mealPlanName:  item.meal_type?.name ?? null,
      pricePerNight: Number(item.price_per_night),
      thumbnail:     rawThumbnail ? getThumbnailImage(rawThumbnail) : null,
      hotelPhoto:    rawHotelPhoto ? getThumbnailImage(rawHotelPhoto) : null,
      roomPhotos:    rawRoomPhotos.map((u) => getThumbnailImage(u)),
      category:      item.hotel.category,
    };
  });
}

export interface ActivityResult {
  id:            number;
  name:          string;
  category:      string | null;
  durationHours: number | null;
  thumbnail:     string | null;
}

export async function searchActivitiesForBuilder(cityOrDestinationName: string, query: string): Promise<ActivityResult[]> {
  const city = cityOrDestinationName.split(",")[0]?.trim();
  if (!city) return [];

  const list = await db.activities.findMany({
    where: {
      is_active: true,
      OR: [
        { city: { contains: city, mode: "insensitive" } },
        { destination: { name: { contains: city, mode: "insensitive" } } },
      ],
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, name: true, duration_hours: true,
      category: { select: { name: true } },
      images: {
        select: { url: true, thumbnail: true },
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        take: 1,
      },
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return list.map((a) => {
    const rawThumbnail = a.images[0]?.thumbnail ?? a.images[0]?.url ?? null;
    return {
      id:            a.id,
      name:          a.name,
      category:      a.category?.name ?? null,
      durationHours: a.duration_hours != null ? Number(a.duration_hours) : null,
      thumbnail:     rawThumbnail ? getThumbnailImage(rawThumbnail) : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle/cab search — not city-scoped (unlike hotels/activities): vehicles
// are a shared fleet catalog, not tied to a single destination.
// ─────────────────────────────────────────────────────────────────────────────

export interface VehicleResult {
  id:                number;
  name:              string;
  type:              string;
  passengerCapacity: number;
  hasAc:             boolean;
  thumbnail:         string | null;
}

export async function searchVehiclesForBuilder(query: string): Promise<VehicleResult[]> {
  const list = await db.vehicles.findMany({
    where: {
      is_active: true,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, name: true, type: true, passenger_capacity: true, has_ac: true, image_key: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return list.map((v) => ({
    id:                v.id,
    name:              v.name,
    type:              v.type,
    passengerCapacity: v.passenger_capacity,
    hasAc:             v.has_ac,
    thumbnail:         v.image_key ? getThumbnailImage(v.image_key) : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Types (exported so pages can import them)
// ─────────────────────────────────────────────────────────────────────────────

export interface QueryRow {
  id:             string;
  name:           string;
  phone:          string;
  countryCode:    string;
  email:          string | null;
  destination:    string | null;
  travelDate:     Date | null;
  groupSize:      number | null;
  assignedToName: string | null;
  assignedAt:     Date | null;
  updatedAt:      Date;
  requirements:   any;
  status:         string;
}

export interface QueryDetail extends QueryRow {
  message: string | null;
  customPackage: {
    id:              string;
    status:          string;
    title:           string;
    description:     string | null;
    coverImage:      string | null;
    pricePerPerson:  number | null;
    totalPrice:      number | null;
    flightsIncluded: boolean;
    flightNotes:     string | null;
    trainIncluded:   boolean;
    trainNotes:      string | null;
    stops:           StopInput[];
    itineraries:     DayItinerary[];
  } | null;
}

export interface StopInput {
  id?:     string;
  name:    string;
  nights:  number;
}

export interface ActivityInput {
  id?:          string;
  title:        string;
  description:  string;
  photo:        string;
}

export interface DayItinerary {
  id?:                string;
  day:                number;
  title:              string;
  description:        string;
  activities:         ActivityInput[];
  meals:              string[];
  accommodation:      string;
  accommodationPhoto: string;
  accommodationRoomPhotos: string[];
  hotelCheckIn:       string;
  hotelCheckOut:      string;
  hotelMealPlan:      string;
  transport:          string;
  transportPhoto:     string;
  notes:              string;
}

export interface PackageInput {
  queryId:         string;
  title:           string;
  description:     string;
  coverImage:      string;
  destination:     string;
  startingPoint:   string;
  totalDays:       number;
  totalNights:     number;
  travelDate:      string;
  adults:          number;
  children:        number;
  infants:         number;
  pricePerPerson:  number | null;
  totalPrice:      number | null;
  currency:        string;
  inclusions:      string[];
  exclusions:      string[];
  termsNotes:      string;
  flightsIncluded: boolean;
  flightNotes:     string;
  trainIncluded:   boolean;
  trainNotes:      string;
  status:          "DRAFT" | "READY";
  stops:           StopInput[];
  itineraries:     DayItinerary[];
}

export interface PaginatedQueries {
  queries:    QueryRow[];
  total:      number;
  page:       number;
  totalPages: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// "Use It" — copy a real catalog package's content into a draft-shaped
// payload the builder form can merge in directly. Deliberately leaves out
// anything traveller/query-specific (travelDate, adults/children/infants,
// pricing, flight/train inclusion, status) — those belong to the actual
// lead, not the catalog package, so copying-in shouldn't overwrite them.
// ─────────────────────────────────────────────────────────────────────────────

export interface PackageCopyPayload {
  title:         string;
  description:   string;
  coverImage:    string;
  destination:   string;
  startingPoint: string;
  totalDays:     number;
  totalNights:   number;
  inclusions:    string[];
  exclusions:    string[];
  termsNotes:    string;
  stops:         StopInput[];
  itineraries:   DayItinerary[];
}

export async function copyPackageIntoDraft(
  packageSlug:  string,
  durationSlug: string,
  routeSlug:    string,
  staySlug:     string,
): Promise<PackageCopyPayload | null> {
  const data = await fetchPackagePageData(packageSlug, durationSlug, routeSlug, staySlug);
  if (!data) return null;

  const stops: StopInput[] = (data.selectedRoute?.stops ?? []).map((s) => ({
    name:   s.place_name,
    nights: s.stay_days,
  }));

  const itineraries: DayItinerary[] = data.itinerary.map((day) => {
    const transfer = day.transfers[0];
    const transportParts = [
      transfer?.vehicle_name ?? null,
      transfer?.pickup_name && transfer?.drop_name ? `${transfer.pickup_name} → ${transfer.drop_name}` : null,
    ].filter((p): p is string => !!p);

    const rawHotelPhoto = day.hotel?.images?.[0]?.thumbnail ?? day.hotel?.images?.[0]?.url ?? null;
    const rawRoomPhotos = (day.hotel?.room_images ?? [])
      .slice(0, 3)
      .map((img) => img.thumbnail ?? img.url)
      .filter((u): u is string => !!u);

    return {
      day:                day.day,
      title:              day.title,
      description:        day.description ?? "",
      activities:         day.activities.map((a) => {
        const rawActivityPhoto = a.images?.[0]?.thumbnail ?? a.images?.[0]?.url ?? null;
        return {
          title:       a.name,
          description: a.description ?? "",
          photo:       rawActivityPhoto ? getThumbnailImage(rawActivityPhoto) : "",
        };
      }),
      meals:              day.meals,
      accommodation:      day.hotel ? [day.hotel.name, day.hotel.room_name].filter(Boolean).join(" — ") : "",
      accommodationPhoto: rawHotelPhoto ? getThumbnailImage(rawHotelPhoto) : "",
      accommodationRoomPhotos: rawRoomPhotos.map((u) => getThumbnailImage(u)),
      hotelCheckIn:       day.hotel?.check_in_time ?? "",
      hotelCheckOut:      day.hotel?.check_out_time ?? "",
      hotelMealPlan:      day.hotel?.plan_name ?? day.hotel?.meal_type ?? "",
      transport:          transportParts.join(" · "),
      transportPhoto:     transfer?.vehicle_image_key ? getThumbnailImage(transfer.vehicle_image_key) : "",
      notes:              day.notes.map((n) => n.message).join(" "),
    };
  });

  const termsNotes = data.policies
    .map((p) => `${p.title}:\n${p.points.map((pt) => `• ${pt}`).join("\n")}`)
    .join("\n\n");

  const rawCover = data.thumbnail ?? data.images[0]?.url ?? "";

  return {
    title:         data.title,
    description:   data.description ?? "",
    coverImage:    rawCover ? getHeroImage(rawCover) : "",
    destination:   stops.length > 0 ? stops.map((s) => s.name).join(", ") : data.destination.name,
    startingPoint: "",
    totalDays:     data.currentDuration.days,
    totalNights:   data.currentDuration.nights,
    inclusions:    data.inclusions,
    exclusions:    data.exclusions,
    termsNotes,
    stops,
    itineraries,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. List all IN_PROGRESS queries pending package creation
// ─────────────────────────────────────────────────────────────────────────────
export async function getPackageBuilderQueries({
  page    = 1,
  size    = 20,
  search  = "",
}: {
  page?:   number;
  size?:   number;
  search?: string;
}): Promise<PaginatedQueries> {
  const safeSize = Math.min(size, 50);
  const skip     = (page - 1) * safeSize;

  const searchFilter = search
    ? {
        OR: [
          { name:        { contains: search, mode: "insensitive" as const } },
          { destination: { contains: search, mode: "insensitive" as const } },
          { phone:       { contains: search } },
        ],
      }
    : {};

  const where = {
    status: "IN_PROGRESS" as const,
    ...searchFilter,
  };

  const [total, queries] = await Promise.all([
    db.package_queries.count({ where }),
    db.package_queries.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: safeSize,
      select: {
        id:             true,
        name:           true,
        phone:          true,
        countryCode:    true,
        email:          true,
        destination:    true,
        travelDate:     true,
        groupSize:      true,
        assignedToName: true,
        assignedAt:     true,
        updatedAt:      true,
        requirements:   true,
        status:         true,
      },
    }),
  ]);

  return {
    queries: queries as QueryRow[],
    total,
    page,
    totalPages: Math.ceil(total / safeSize),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Look up a destination's catalog cover photo by name (exact, then fuzzy),
//    so a new package can default to a real photo instead of a blank header.
// ─────────────────────────────────────────────────────────────────────────────
export async function getDestinationCoverImage(destinationName: string): Promise<string | null> {
  const name = destinationName.split(",")[0]?.trim();
  if (!name) return null;

  const destination =
    (await db.destinations.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { cover_image: true, thumbnail: true },
    })) ??
    (await db.destinations.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      select: { cover_image: true, thumbnail: true },
    }));

  const raw = destination?.cover_image ?? destination?.thumbnail ?? null;
  return raw ? getHeroImage(raw) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Get single query detail (with existing custom package if any)
// ─────────────────────────────────────────────────────────────────────────────
export async function getQueryDetail(queryId: string): Promise<QueryDetail | null> {
  const query = await db.package_queries.findUnique({
    where: { id: queryId },
    select: {
      id:             true,
      name:           true,
      phone:          true,
      countryCode:    true,
      email:          true,
      destination:    true,
      travelDate:     true,
      groupSize:      true,
      assignedToName: true,
      assignedAt:     true,
      updatedAt:      true,
      requirements:   true,
      status:         true,
      message:        true,
      // custom_packages is a singular 1:1 relation (queryId is @unique on
      // custom_packages), so no take/orderBy here — those only apply to
      // to-many relations.
      custom_packages: {
        select: {
          id:              true,
          status:          true,
          title:           true,
          description:     true,
          coverImage:      true,
          pricePerPerson:  true,
          totalPrice:      true,
          flightsIncluded: true,
          flightNotes:     true,
          trainIncluded:   true,
          trainNotes:      true,
          stops: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, nights: true },
          },
          itineraries: {
            orderBy: { day: "asc" },
            select: {
              id:                 true,
              day:                true,
              title:              true,
              description:        true,
              meals:              true,
              accommodation:      true,
              accommodationPhoto: true,
              accommodationRoomPhotos: true,
              hotelCheckIn:       true,
              hotelCheckOut:      true,
              hotelMealPlan:      true,
              transport:          true,
              transportPhoto:     true,
              notes:              true,
              activities: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true, description: true, photo: true },
              },
            },
          },
        },
      },
    },
  });

  if (!query) return null;

  return {
    ...(query as any),
    customPackage: query.custom_packages ?? null,
  } as QueryDetail;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Save (create or update) a custom package with itineraries
// ─────────────────────────────────────────────────────────────────────────────
export async function saveCustomPackage(input: PackageInput): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    const {
      queryId, title, description, coverImage, destination, startingPoint,
      totalDays, totalNights, travelDate, adults, children, infants,
      pricePerPerson, totalPrice, currency, inclusions, exclusions,
      termsNotes, flightsIncluded, flightNotes, trainIncluded, trainNotes,
      status, stops, itineraries,
    } = input;

    const { teamMemberId, teamMemberName } = await getCurrentActor();
    const builtBy = teamMemberId ?? "unknown";
    const builtByName = teamMemberName ?? "Sales Executive";

    // Upsert the custom package (unique on queryId)
    const pkg = await db.custom_packages.upsert({
      where:  { queryId },
      create: {
        queryId,
        title,
        description:     description || null,
        coverImage:      coverImage || null,
        destination,
        startingPoint:   startingPoint || null,
        totalDays,
        totalNights,
        travelDate:      travelDate ? new Date(travelDate) : null,
        adults,
        children,
        infants,
        pricePerPerson:  pricePerPerson ?? null,
        totalPrice:      totalPrice ?? null,
        currency,
        inclusions,
        exclusions,
        termsNotes:      termsNotes || null,
        flightsIncluded,
        flightNotes:     flightNotes || null,
        trainIncluded,
        trainNotes:      trainNotes || null,
        status,
        builtBy,
        builtByName:     builtByName || null,
      },
      update: {
        title,
        description:     description || null,
        coverImage:      coverImage || null,
        destination,
        startingPoint:   startingPoint || null,
        totalDays,
        totalNights,
        travelDate:      travelDate ? new Date(travelDate) : null,
        adults,
        children,
        infants,
        pricePerPerson:  pricePerPerson ?? null,
        totalPrice:      totalPrice ?? null,
        currency,
        inclusions,
        exclusions,
        termsNotes:      termsNotes || null,
        flightsIncluded,
        flightNotes:     flightNotes || null,
        trainIncluded,
        trainNotes:      trainNotes || null,
        status,
        builtByName:     builtByName || null,
      },
    });

    // Replace route stops — delete all then recreate (no nested children, so
    // createMany is fine here, unlike itineraries below).
    await db.custom_package_stops.deleteMany({
      where: { customPackageId: pkg.id },
    });
    const namedStops = stops.filter((s) => s.name.trim());
    if (namedStops.length > 0) {
      await db.custom_package_stops.createMany({
        data: namedStops.map((s, idx) => ({
          customPackageId: pkg.id,
          name:            s.name,
          nights:          s.nights,
          sortOrder:       idx,
        })),
      });
    }

    // Replace itineraries (and their nested activities, via cascade) — delete
    // all then recreate. Nested `activities.create` needs one create per day
    // rather than createMany, since createMany can't take nested writes.
    await db.custom_itineraries.deleteMany({
      where: { customPackageId: pkg.id },
    });

    if (itineraries.length > 0) {
      await db.$transaction(
        itineraries.map((it) =>
          db.custom_itineraries.create({
            data: {
              customPackageId:    pkg.id,
              day:                it.day,
              title:              it.title,
              description:        it.description || null,
              meals:              it.meals,
              accommodation:      it.accommodation || null,
              accommodationPhoto: it.accommodationPhoto || null,
              accommodationRoomPhotos: it.accommodationRoomPhotos ?? [],
              hotelCheckIn:       it.hotelCheckIn || null,
              hotelCheckOut:      it.hotelCheckOut || null,
              hotelMealPlan:      it.hotelMealPlan || null,
              transport:          it.transport || null,
              transportPhoto:     it.transportPhoto || null,
              notes:              it.notes || null,
              activities: {
                create: it.activities
                  .filter((a) => a.title.trim())
                  .map((a, idx) => ({
                    title:       a.title,
                    description: a.description || null,
                    photo:       a.photo || null,
                    sortOrder:   idx,
                  })),
              },
            },
          }),
        ),
      );
    }

    revalidatePath("/dashboard/package-builder");

    return { id: pkg.id, success: true };
  } catch (err) {
    console.error("[saveCustomPackage]", err);
    return { id: "", success: false, error: "Failed to save package" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Mark package as SENT → update query status → return WhatsApp URL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPackageToClient(packageId: string): Promise<{
  success:      boolean;
  whatsappUrl?: string;
  error?:       string;
}> {
  try {
    const pkg = await db.custom_packages.findUnique({
      where:   { id: packageId },
      include: {
        query:       true,
        itineraries: { orderBy: { day: "asc" } },
      },
    });

    if (!pkg) return { success: false, error: "Package not found" };

    // ── Build WhatsApp deep-link ─────────────────────────────────────────────
    const rawPhone  = pkg.query.phone.replace(/\D/g, "");
    const country   = pkg.query.countryCode ?? "91";
    const fullPhone = rawPhone.startsWith(country) ? rawPhone : `${country}${rawPhone}`;

    const travelDateStr = pkg.travelDate
      ? new Date(pkg.travelDate).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric",
        })
      : "TBD";

    const paxLine =
      `${pkg.adults} Adult${pkg.adults !== 1 ? "s" : ""}` +
      (pkg.children ? `, ${pkg.children} Child${pkg.children !== 1 ? "ren" : ""}` : "") +
      (pkg.infants  ? `, ${pkg.infants} Infant${pkg.infants !== 1 ? "s" : ""}` : "");

    const priceStr = pkg.totalPrice
      ? `${pkg.currency} ${Number(pkg.totalPrice).toLocaleString("en-IN")}`
      : "To be confirmed";

    const transportLine = [
      pkg.flightsIncluded ? "✈️ Flights included" : null,
      pkg.trainIncluded ? "🚆 Train included" : null,
    ].filter(Boolean).join(" · ");

    const message = [
      `Hi ${pkg.query.name} 👋`,
      ``,
      `Your customised *${pkg.title}* package is ready! 🎉`,
      ``,
      `📍 *Destination:* ${pkg.destination}`,
      `🚗 *Starting From:* ${pkg.startingPoint ?? pkg.query.destination ?? "—"}`,
      `📅 *Travel Date:* ${travelDateStr}`,
      `🌙 *Duration:* ${pkg.totalDays} Days / ${pkg.totalNights} Nights`,
      `👥 *Travellers:* ${paxLine}`,
      `💰 *Total Price:* ${priceStr}`,
      ...(transportLine ? [transportLine] : []),
      ``,
      `Please check your email for the detailed itinerary PDF.`,
      `Let us know if you'd like any changes! 🙏`,
    ].join("\n");

    const whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

    // ── Update DB ────────────────────────────────────────────────────────────
    await db.$transaction([
      db.custom_packages.update({
        where: { id: packageId },
        data:  { status: "SENT", sentAt: new Date() },
      }),
      db.package_queries.update({
        where: { id: pkg.queryId },
        data:  { status: "PACKAGE_SENT" },
      }),
    ]);

    // ── Trigger email (plug in your email service here) ──────────────────────
    // if (pkg.query.email) {
    //   await sendPackageEmail({ to: pkg.query.email, name: pkg.query.name, pkg });
    // }

    revalidatePath("/dashboard/package-builder");

    return { success: true, whatsappUrl };
  } catch (err) {
    console.error("[sendPackageToClient]", err);
    return { success: false, error: "Failed to send package" };
  }
}
