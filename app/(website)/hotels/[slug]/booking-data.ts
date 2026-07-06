import "server-only";
import { db } from "@/app/lib/db";
import { getRoomARI } from "@/app/lib/hotel-inventory/rates";
import { resolveCancellation, effectivePolicy, type CancellationPolicy } from "@/app/lib/hotel-inventory/cancellation";
import type { Hotel, Room, RatePlan } from "./dummy";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&h=800&q=80";

const R2_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");

/** Turn a stored image value (R2 key or absolute URL) into a usable absolute URL. */
function imageUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return u;
  return R2_BASE ? `${R2_BASE}/${u.replace(/^\//, "")}` : null;
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

/** Flatten the property_amenities JSON map into a list of human labels. */
function amenityLabels(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const on =
      v === true ||
      (typeof v === "string" && v.length > 0) ||
      (Array.isArray(v) && v.length > 0) ||
      (v && typeof v === "object" && Object.values(v).some(Boolean));
    if (on) out.push(prettify(k));
  }
  return out;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
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
): Promise<RoomBookingContext | null> {
  const room = await db.hotel_rooms.findFirst({
    where: { id: roomId, hotel: { slug } },
    select: {
      id: true, name: true,
      hotel: { select: { id: true, name: true, cancellation_policy: true } },
      pricing: { where: { is_active: true }, orderBy: { sort_order: "asc" }, take: 1, select: { cancellation_policy: true } },
    },
  });
  if (!room) return null;

  const { getStayQuote } = await import("@/app/lib/hotel-inventory/rates");
  const quote = await getStayQuote(roomId, checkIn, checkOut, undefined);
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
      star_rating: true, description: true, property_amenities: true,
      check_in_time: true, check_out_time: true, cancellation_policy: true,
      allow_unmarried_couples: true, allow_guests_below_18: true, smoking_allowed: true,
      acceptable_id_proofs: true, pets_allowed: true,
      images: { orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }], select: { url: true } },
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

  const rooms: Room[] = await Promise.all(
    h.hotelRooms.map(async (r): Promise<Room> => {
      const ari = await getRoomARI(r.id, checkIn, checkOut);
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
      };
    }),
  );

  const rule = (v: boolean | null, yes: string, no: string) => (v ? yes : no);

  return {
    slug: h.slug,
    name: h.name,
    starRating: h.star_rating ?? 3,
    address: [h.address, h.city, h.state].filter(Boolean).join(", ") || (h.city ?? ""),
    area: h.city ?? "",
    city: h.city ?? "",
    reviewScore: 0,
    reviewLabel: "New",
    reviewCount: 0,
    locationScore: 0,
    tags: labels.slice(0, 4),
    images: hotelImages.length ? hotelImages : [FALLBACK_IMG],
    about: h.description ?? `${h.name} in ${h.city ?? "India"} — comfortable rooms and warm hospitality.`,
    amenities: labels.slice(0, 8).map((l) => ({ icon: iconFor(l), label: l })),
    allAmenities: labels.length ? [{ group: "Amenities", items: labels }] : [],
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
    reviews: { overall: 0, label: "New", count: 0, categories: [], distribution: [], items: [] },
    similar: [],
    nights: nightsBetween(checkIn, checkOut),
  } as Hotel & { nights: number };
}
