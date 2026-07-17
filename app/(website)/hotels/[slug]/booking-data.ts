import "server-only";
import { db } from "@/app/lib/db";
import { getRoomARI } from "@/app/lib/hotel-inventory/rates";
import { resolveCancellation, effectivePolicy, type CancellationPolicy } from "@/app/lib/hotel-inventory/cancellation";
import { AMENITY_CATEGORIES } from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/tabs/amenities-data";
import type { Hotel, Room, RatePlan, BedroomLayout, ReviewItem } from "./dummy";
import { getImageUrl, IMAGE_SIZES } from "@/app/lib/imageUrl";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&h=800&q=80";

const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");

/** Turn a stored image value (R2 key or absolute URL) into a usable absolute URL. */
function imageUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return u;
  return R2_BASE ? `${R2_BASE}/${u.replace(/^\//, "")}` : null;
}

type GalleryCategoryOut = { label: string; images: { src: string; fullSrc: string; label: string }[] };

/**
 * Group real, categorized hotel photos (hotel_image_categories) into the
 * same { label, images }[] shape the package page's FullGallery expects —
 * categories ordered by their own sort_order, images within a category kept
 * in fetch order (already is_primary desc, sort_order asc from the query).
 */
function buildPropertyGalleryCategories(
  images: { url: string | null; category: { name: string; sort_order: number } }[],
): GalleryCategoryOut[] {
  const byCat = new Map<string, { sortOrder: number; urls: string[] }>();
  for (const img of images) {
    if (!img.url) continue;
    const entry = byCat.get(img.category.name) ?? { sortOrder: img.category.sort_order, urls: [] };
    entry.urls.push(img.url);
    byCat.set(img.category.name, entry);
  }
  return [...byCat.entries()]
    .sort(([, a], [, b]) => a.sortOrder - b.sortOrder)
    .map(([label, { urls }]) => ({
      label,
      images: urls.map((url) => ({
        src: getImageUrl(url, IMAGE_SIZES.gallery),
        fullSrc: getImageUrl(url, IMAGE_SIZES.lightbox),
        label,
      })),
    }));
}

function prettify(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function iconFor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("wifi") || l.includes("wi-fi") || l.includes("internet")) return "wifi";
  if (l.includes("park")) return "parking";
  if (l.includes("restaurant") || l.includes("dining") || l.includes("food")) return "restaurant";
  if (l.includes("ac") || l.includes("air condition")) return "ac";
  if (l.includes("pool") || l.includes("swim")) return "pool";
  if (l.includes("gym") || l.includes("fitness")) return "gym";
  if (l.includes("spa") || l.includes("wellness")) return "spa";
  return "desk";
}

function isAmenityOn(v: unknown): boolean {
  return (
    v === true ||
    (typeof v === "string" && v.length > 0) ||
    (Array.isArray(v) && v.length > 0) ||
    (!!v && typeof v === "object" && Object.values(v).some(Boolean))
  );
}

/** Flatten the property_amenities JSON map into a list of human labels. */
function amenityLabels(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isAmenityOn(v)) out.push(prettify(k));
  }
  return out;
}

/**
 * Group property_amenities by the same categories hotel-connect's own
 * Amenities wizard step uses (AMENITY_CATEGORIES) — property_amenities is
 * keyed by the exact amenity name (see amenities-actions.ts), so this is a
 * direct lookup, not a guess. Empty categories are dropped. Powers the
 * guest-facing "View All Amenities" modal's tabs.
 */
function groupedAmenities(raw: unknown): { group: string; items: { label: string; icon: string }[] }[] {
  if (!raw || typeof raw !== "object") return [];
  const map = raw as Record<string, unknown>;
  return AMENITY_CATEGORIES
    .map((cat) => ({
      group: cat.label,
      items: cat.items
        .filter((name) => isAmenityOn(map[name]))
        .map((name) => ({ label: name, icon: iconFor(name) })),
    }))
    .filter((g) => g.items.length > 0);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
}

function reviewLabelFor(score: number): string {
  if (score <= 0) return "New";
  if (score >= 4.5) return "Excellent";
  if (score >= 4.0) return "Very Good";
  if (score >= 3.5) return "Good";
  if (score >= 3.0) return "Average";
  return "Below Average";
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "G";
}

type ReviewStats = {
  overall: number;
  label: string;
  count: number;
  distribution: { stars: number; pct: number }[];
  items: ReviewItem[];
};

/** Real rating average, star distribution, and recent reviews for a hotel — same groupBy pattern as the owner-side reviews page (reviews-actions.ts). */
async function getReviewStats(hotelId: number): Promise<ReviewStats> {
  const [ratingGroups, count, recent] = await Promise.all([
    db.hotel_review.groupBy({ by: ["rating"], where: { hotel_id: hotelId }, _count: { _all: true } }),
    db.hotel_review.count({ where: { hotel_id: hotelId } }),
    db.hotel_review.findMany({
      where: { hotel_id: hotelId },
      orderBy: { created_at: "desc" },
      take: 20,
      select: { id: true, guest_name: true, rating: true, comment: true, created_at: true },
    }),
  ]);

  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const g of ratingGroups) {
    if (g.rating >= 1 && g.rating <= 5) breakdown[g.rating as 1 | 2 | 3 | 4 | 5] += g._count._all;
    sum += g.rating * g._count._all;
  }
  const overall = count > 0 ? sum / count : 0;

  return {
    overall,
    label: reviewLabelFor(overall),
    count,
    distribution: ([5, 4, 3, 2, 1] as const).map((stars) => ({
      stars,
      pct: count > 0 ? Math.round((breakdown[stars] / count) * 100) : 0,
    })),
    items: recent.map((r) => ({
      id: String(r.id),
      name: r.guest_name,
      initials: initialsFor(r.guest_name),
      date: r.created_at.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      rating: r.rating,
      text: r.comment ?? "",
    })),
  };
}

type BedroomDetail = {
  name?: string;
  beds?: Record<string, number>;
  has_bathroom?: boolean;
  view?: string;
  size_value?: number | null;
  size_unit?: string;
  amenities?: string[];
};

/** "2 King Beds, 1 Sofa Cum Bed" from a { king_bed: 2, sofa_cum_bed: 1 } map. */
function bedsLabel(beds: Record<string, number> | undefined): string {
  if (!beds) return "";
  return Object.entries(beds)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => `${n} ${prettify(key)}${n > 1 ? "s" : ""}`)
    .join(", ");
}

export type HotelCard = {
  id: number;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  starRating: number | null;
  image: string;
  priceFrom: number | null;
  amenities: string[];
};

/** Search LIVE hotels for the listing page, optionally filtered by city. */
export async function searchHotels(opts: { city?: string }): Promise<HotelCard[]> {
  const hotels = await db.hotels.findMany({
    where: {
      listing_status: "LIVE",
      ...(opts.city ? { city: { contains: opts.city, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ star_rating: "desc" }, { id: "desc" }],
    take: 48,
    select: {
      id: true, slug: true, name: true, city: true, state: true,
      star_rating: true, property_amenities: true,
      images: { orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }], take: 1, select: { url: true } },
      hotelRooms: {
        where: { is_active: true },
        select: {
          pricing: { where: { is_active: true }, orderBy: { price_per_night: "asc" }, take: 1, select: { price_per_night: true } },
        },
      },
    },
  });

  return hotels.map((h) => {
    const prices = h.hotelRooms.flatMap((r) => r.pricing.map((p) => Number(p.price_per_night)));
    return {
      id: h.id,
      slug: h.slug,
      name: h.name,
      city: h.city,
      state: h.state,
      starRating: h.star_rating,
      image: imageUrl(h.images[0]?.url) ?? FALLBACK_IMG,
      priceFrom: prices.length ? Math.min(...prices) : null,
      amenities: amenityLabels(h.property_amenities).slice(0, 4),
    };
  });
}

export type RoomBookingContext = {
  hotelId: number;
  hotelName: string;
  roomId: number;
  roomName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  nightly: number | null;
  total: number | null;
  available: boolean;
  cancellationLabel: string;
};

/** Context for the booking form: room + live price/availability + cancellation. */
export async function getRoomBookingContext(
  slug: string,
  roomId: number,
  checkIn: string,
  checkOut: string,
  pricingId?: number,
): Promise<RoomBookingContext | null> {
  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel: { slug } },
    select: {
      id: true, name: true,
      hotel: { select: { id: true, name: true, cancellation_policy: true } },
      pricing: pricingId != null
        ? { where: { id: pricingId }, take: 1, select: { cancellation_policy: true } }
        : { where: { is_active: true }, orderBy: { sort_order: "asc" }, take: 1, select: { cancellation_policy: true } },
    },
  });
  if (!room) return null;

  const { getStayQuote } = await import("@/app/lib/hotel-inventory/rates");
  const quote = await getStayQuote(roomId, checkIn, checkOut, undefined, pricingId);
  const nights = nightsBetween(checkIn, checkOut);
  const policy = effectivePolicy(
    (room.pricing[0]?.cancellation_policy as CancellationPolicy | null) ?? null,
    (room.hotel.cancellation_policy as CancellationPolicy | null) ?? null,
  );

  return {
    hotelId: room.hotel.id,
    hotelName: room.hotel.name,
    roomId: room.id,
    roomName: room.name,
    checkIn,
    checkOut,
    nights,
    nightly: quote.nights[0]?.price ?? null,
    total: quote.total,
    available: quote.allAvailable,
    cancellationLabel: resolveCancellation(policy, checkIn).label,
  };
}

/**
 * Load a real hotel by slug and build the shape the detail page expects, with
 * **live** per-room availability & price (via getRoomARI) for the given dates.
 * Sections without backing data (reviews, landmarks, similar) get safe defaults.
 */
export async function getHotelForBooking(
  slug: string,
  checkIn: string,
  checkOut: string,
): Promise<Hotel | null> {
  const h = await db.hotels.findFirst({
    where: { slug },
    select: {
      id: true, name: true, slug: true, address: true, city: true, state: true,
      latitude: true, longitude: true,
      star_rating: true, description: true, property_amenities: true,
      check_in_time: true, check_out_time: true, cancellation_policy: true,
      allow_unmarried_couples: true, allow_guests_below_18: true, smoking_allowed: true,
      acceptable_id_proofs: true, pets_allowed: true,
      property_category: true, hs_bedrooms: true, hs_bathrooms: true,
      hs_bedroom_details: true, host_lives_at_property: true, caretaker_stays: true,
      images: {
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        select: { url: true, category: { select: { name: true, sort_order: true } } },
      },
      hotelRooms: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true, name: true, area_sqft: true, area_unit: true, bed_type: true,
          view_type: true, base_adults: true, max_adults: true, max_children: true,
          max_occupancy: true, amenities: true,
          images: { orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }], select: { url: true } },
          pricing: {
            where: { is_active: true },
            orderBy: { price_per_night: "asc" },
            select: {
              id: true, price_per_night: true, original_price: true, gst_percentage: true,
              plan_name: true, cancellation_policy: true, meal_type: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!h) return null;

  const hotelImages = h.images.map((i) => imageUrl(i.url)).filter((u): u is string => !!u);
  const labels = amenityLabels(h.property_amenities);

  // Full gallery: real property categories (hotel_image_categories) + a
  // "Rooms" category aggregating every room's own photos — mirrors the
  // package page's FullGallery categorization (Gallery/Hotels/Rooms/Activities).
  const galleryCategories = buildPropertyGalleryCategories(h.images);
  const roomGalleryImages = h.hotelRooms.flatMap((r) =>
    r.images
      .filter((i): i is typeof i & { url: string } => !!i.url)
      .map((i) => ({ src: getImageUrl(i.url, IMAGE_SIZES.gallery), fullSrc: getImageUrl(i.url, IMAGE_SIZES.lightbox), label: r.name })),
  );
  if (roomGalleryImages.length > 0) galleryCategories.push({ label: "Rooms", images: roomGalleryImages });

  const [rooms, reviewStats] = await Promise.all([
    Promise.all(
    h.hotelRooms.map(async (r): Promise<Room> => {
      const ari = await getRoomARI(r.id, checkIn, checkOut);
      const roomsLeft = ari.length ? Math.min(...ari.map((n) => n.available)) : null;
      const roomAmenities = Array.isArray(r.amenities) ? (r.amenities as string[]).map(String) : amenityLabels(r.amenities);
      const roomImages = r.images.map((i) => imageUrl(i.url)).filter((u): u is string => !!u);

      // One rate plan per active pricing row (Room Only, With Breakfast, …).
      const rows = r.pricing.length > 0 ? r.pricing : [null];
      const ratePlans: RatePlan[] = rows.map((p, idx) => {
        const nightly = p ? Number(p.price_per_night) : ari[0]?.price ?? 0;
        const gst = p ? Number(p.gst_percentage) : 12;
        const original = p?.original_price ? Number(p.original_price) : Math.round(nightly * 1.15);
        const label = p?.plan_name || p?.meal_type?.name || "Room Only";
        const policy = effectivePolicy(
          (p?.cancellation_policy as CancellationPolicy | null) ?? null,
          (h.cancellation_policy as CancellationPolicy | null) ?? null,
        );
        const cancel = resolveCancellation(policy, checkIn);
        const text = `${label} ${p?.meal_type?.name ?? ""}`.toLowerCase();
        const inclusions: string[] = [];
        if (/breakfast|all meal|full board/.test(text)) inclusions.push("Free breakfast");
        if (/lunch|all meal|full board/.test(text)) inclusions.push("Free lunch");
        if (/dinner|all meal|full board/.test(text)) inclusions.push("Free dinner");
        if (inclusions.length === 0) inclusions.push("No meals included");
        return {
          id: p ? String(p.id) : `${r.id}-base`,
          mealPlan: prettify(label),
          inclusions,
          cancellation: cancel.label,
          refundable: cancel.refundable,
          price: nightly,
          originalPrice: original,
          taxes: Math.round(nightly * (gst / 100)),
          badge: rows.length > 1 && idx === 0 ? "Lowest Price" : undefined,
        };
      });

      const maxGuests = r.max_occupancy ?? r.max_adults + (r.max_children ?? 0);
      return {
        id: String(r.id),
        name: r.name,
        images: roomImages.length ? roomImages : hotelImages.length ? hotelImages.slice(0, 3) : [FALLBACK_IMG],
        size: r.area_sqft ? `${r.area_sqft} ${r.area_unit ?? "sq.ft"}` : "",
        bed: r.bed_type ?? "",
        view: r.view_type ?? "",
        occupancy: `Max ${maxGuests} guest${maxGuests === 1 ? "" : "s"}`,
        amenities: roomAmenities,
        ratePlans,
        roomsLeft,
      };
    }),
    ),
    getReviewStats(h.id),
  ]);

  const rule = (v: boolean | null, yes: string, no: string) => (v ? yes : no);

  // Homestay/Villa: MMT/Goibibo-style "Property Layout" showing the physical
  // bedrooms (from the wizard's per-bedroom JSON) instead of sellable rooms.
  let homestay: Hotel["homestay"];
  if (h.property_category === "HOMESTAY_VILLA") {
    const bedroomDetails = Array.isArray(h.hs_bedroom_details) ? (h.hs_bedroom_details as BedroomDetail[]) : [];
    const layout: BedroomLayout[] = bedroomDetails.map((b, i) => ({
      name: b.name || `Bedroom ${i + 1}`,
      bed: bedsLabel(b.beds) || "Bed details not added",
      view: b.view ? prettify(b.view) : "",
      attachedBathroom: !!b.has_bathroom,
      size: b.size_value ? `${b.size_value} ${b.size_unit ?? "sqft"}` : "",
      amenities: Array.isArray(b.amenities) ? b.amenities.map(prettify) : [],
    }));
    const managedBy = h.host_lives_at_property
      ? "Managed by Host"
      : h.caretaker_stays
        ? "Managed by Caretaker/Staff"
        : "Remotely Managed";
    const managedByNote = h.host_lives_at_property
      ? "Host lives at the property"
      : h.caretaker_stays
        ? "For ensuring a smooth and comfortable stay"
        : "Self check-in available";
    homestay = {
      bedroomCount: h.hs_bedrooms ?? layout.length,
      bathroomCount: h.hs_bathrooms ?? 0,
      managedBy,
      managedByNote,
      layout,
    };
  }

  return {
    id: h.id,
    slug: h.slug,
    name: h.name,
    starRating: h.star_rating ?? 3,
    address: [h.address, h.city, h.state].filter(Boolean).join(", ") || (h.city ?? ""),
    area: h.city ?? "",
    city: h.city ?? "",
    latitude: h.latitude != null ? Number(h.latitude) : null,
    longitude: h.longitude != null ? Number(h.longitude) : null,
    reviewScore: reviewStats.overall,
    reviewLabel: reviewStats.label,
    reviewCount: reviewStats.count,
    tags: labels.slice(0, 4),
    images: hotelImages.length ? hotelImages : [FALLBACK_IMG],
    galleryCategories,
    about: h.description ?? `${h.name} in ${h.city ?? "India"} — comfortable rooms and warm hospitality.`,
    amenities: labels.slice(0, 8).map((l) => ({ icon: iconFor(l), label: l })),
    allAmenities: groupedAmenities(h.property_amenities),
    landmarks: [{ category: h.city || "Location", items: [] }],
    rules: {
      checkIn: h.check_in_time ?? "12:00 PM",
      checkOut: h.check_out_time ?? "11:00 AM",
      guestProfile: [
        rule(h.allow_unmarried_couples, "Couples are welcome.", "Unmarried couples are not allowed."),
        rule(h.allow_guests_below_18, "Guests below 18 are allowed.", "Guests below 18 are not allowed without a guardian."),
      ],
      mustRead: [
        ...(Array.isArray(h.acceptable_id_proofs) && h.acceptable_id_proofs.length
          ? [`Accepted ID proofs: ${(h.acceptable_id_proofs as string[]).join(", ")}.`]
          : []),
        rule(h.smoking_allowed, "Smoking is allowed in designated areas.", "Smoking within the premises is not allowed."),
        rule(h.pets_allowed, "Pets are allowed.", "Pets are not allowed."),
      ],
    },
    rooms,
    homestay,
    reviews: reviewStats,
    similar: [],
    nights: nightsBetween(checkIn, checkOut),
  } as Hotel & { nights: number };
}
