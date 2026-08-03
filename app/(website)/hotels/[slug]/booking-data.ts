import "server-only";
import { db } from "@/app/lib/db";
import { getRoomARI } from "@/app/lib/hotel-inventory/rates";
import { resolveCancellation, effectivePolicy, cancellationLabel, type CancellationPolicy } from "@/app/lib/hotel-inventory/cancellation";
import { ROOM_AMENITY_GROUPS } from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/tabs/room-data";
import { HOTEL_PHOTO_TAGS, GUEST_HOUSE_PHOTO_TAGS } from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/tabs/photo-tags-data";
import type { Hotel, Room, RatePlan, BedroomLayout, ReviewItem, SimilarHotel } from "./dummy";
import { getImageUrl, IMAGE_SIZES } from "@/app/lib/imageUrl";
import { getOrFetchLandmarks } from "@/app/lib/hotel-inventory/landmarks";
import { parseRoomAmenities, iconFor } from "@/app/lib/hotel-inventory/room-amenities";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  PRICE_BUCKETS, ROOM_TYPES, PROPERTY_TYPES, MEAL_PLANS, AMENITY_OPTIONS,
  hotelFiltersKey, hotelScopeKey, type HotelFilters,
} from "@/app/lib/hotels/hotelFacets";
import { cached, CACHE_TTL, CACHE_KEYS } from "@/app/lib/cache";
import { groupAmenityNames, headlineAmenities } from "@/app/lib/hotels/amenityGroups";
import type { HotelCard } from "@/app/lib/hotels/hotelCard";

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

const UNTAGGED_LABEL = "Property";

/**
 * Group hotel photos into the same { label, images }[] shape the package
 * page's FullGallery expects, using each photo's own primary tag (the same
 * signal the owner sets and sees grouped in the Photos step's
 * groupPhotosByTag) — NOT hotel_image_categories, which every upload lands
 * in as a single vestigial "Property" bucket regardless of what the owner
 * actually tagged it as. Categories are ordered to match the owner-facing
 * tag list (HOTEL_PHOTO_TAGS/GUEST_HOUSE_PHOTO_TAGS) so tab order is the
 * same one owners configure against, with untagged photos falling back to
 * a generic "Property" bucket instead of being dropped.
 */
function buildPropertyGalleryCategories(
  images: { url: string | null; tags: string[] }[],
  isGuestHouse: boolean,
): GalleryCategoryOut[] {
  const tagOrder = isGuestHouse ? GUEST_HOUSE_PHOTO_TAGS : HOTEL_PHOTO_TAGS;
  const orderIndex = new Map(tagOrder.map((tag, i) => [tag, i]));

  const byTag = new Map<string, string[]>();
  for (const img of images) {
    if (!img.url) continue;
    const tag = img.tags[0] || UNTAGGED_LABEL;
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag)!.push(img.url);
  }

  return [...byTag.entries()]
    .sort(([a], [b]) => (orderIndex.get(a) ?? tagOrder.length) - (orderIndex.get(b) ?? tagOrder.length))
    .map(([label, urls]) => ({
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

// Guest-friendlier copy for a couple of the wizard's internal group labels —
// cosmetic only, doesn't change which amenities land in which group.
const ROOM_GROUP_DISPLAY_LABEL: Record<string, string> = { Mandatory: "Basic Facilities" };

/** Group a room's selected amenity names by the same categories the room wizard's Amenities step (ROOM_AMENITY_GROUPS) uses. */
function groupedRoomAmenities(names: string[]): { group: string; items: { label: string; icon: string }[] }[] {
  const set = new Set(names);
  return ROOM_AMENITY_GROUPS
    .map((cat) => ({
      group: ROOM_GROUP_DISPLAY_LABEL[cat.label] ?? cat.label,
      items: cat.items.filter((name) => set.has(name)).map((name) => ({ label: name, icon: iconFor(name) })),
    }))
    .filter((g) => g.items.length > 0);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.max(1, Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000));
}

/**
 * Yes/no policy sentence for a tri-state wizard boolean. Returns null (omit
 * entirely) when the owner never answered — showing the "no" sentence for an
 * unset field would assert something nobody actually confirmed.
 */
function factIf(v: boolean | null | undefined, yes: string, no: string): string | null {
  if (v == null) return null;
  return v ? yes : no;
}

function money0(v: unknown): string | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `₹${n.toLocaleString("en-IN")}` : null;
}

const CHARGE_TYPE_LABEL: Record<string, string> = {
  FREE: "Free",
  SHARING_BED: "Sharing existing bed",
  EXTRA_BED: "Extra bed",
  FIXED_RATE: "Fixed rate",
};

type PolicySection = { title: string; items: string[] };

/** Drops any section with zero real facts instead of rendering an empty card. */
function withFacts(sections: PolicySection[]): PolicySection[] {
  return sections.filter((s) => s.items.length > 0);
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

// Deterministic keyword categories for the guest-facing "Filter by" chips —
// extracted from each review's own comment text, not invented. A review can
// match more than one category.
const REVIEW_TAG_RULES: { tag: string; pattern: RegExp }[] = [
  { tag: "Great hospitality", pattern: /hospitalit|staff|host(?:ed|ing)?\b|service/i },
  { tag: "Clean rooms", pattern: /clean|hygien|spotless|tidy/i },
  { tag: "Beautiful property", pattern: /beautiful|view|scenic|stunning|picturesque|surroundings/i },
  { tag: "Tasty food", pattern: /food|breakfast|meal|dining|restaurant|tasty|cuisine/i },
  { tag: "Great location", pattern: /location|walk(?:ing|able)? distance|close to|nearby|access/i },
  { tag: "Value for money", pattern: /value|worth|afforda|reasonable price/i },
  { tag: "Needs improvement", pattern: /disappoint|poor|not (?:good|great)|smaller than expected|could be better|issue|problem/i },
];

function deriveReviewTags(comment: string): string[] {
  return REVIEW_TAG_RULES.filter((r) => r.pattern.test(comment)).map((r) => r.tag);
}

/** Real rating average, star distribution, and reviews (with owner replies, room/stay context, and content-derived tags) for a hotel — same groupBy pattern as the owner-side reviews page (reviews-actions.ts). */
async function getReviewStats(hotelId: number): Promise<ReviewStats> {
  const [ratingGroups, count, all] = await Promise.all([
    db.hotel_review.groupBy({ by: ["rating"], where: { hotel_id: hotelId }, _count: { _all: true } }),
    db.hotel_review.count({ where: { hotel_id: hotelId } }),
    db.hotel_review.findMany({
      where: { hotel_id: hotelId },
      orderBy: { created_at: "desc" },
      take: 500,
      select: {
        id: true, guest_name: true, rating: true, comment: true, created_at: true,
        booking_id: true, host_response: true, host_response_at: true, images: true,
      },
    }),
  ]);

  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const g of ratingGroups) {
    if (g.rating >= 1 && g.rating <= 5) breakdown[g.rating as 1 | 2 | 3 | 4 | 5] += g._count._all;
    sum += g.rating * g._count._all;
  }
  const overall = count > 0 ? sum / count : 0;

  // Real room type + stay month per review, joined off the same
  // (booking_id, hotel_id) pair the review itself is keyed on — not every
  // review's booking has a matching row (e.g. seeded demo reviews), so
  // this degrades to omitting the line rather than guessing.
  const bookingIds = [...new Set(all.map((r) => r.booking_id))];
  const bookingHotels = bookingIds.length
    ? await db.bookingHotel.findMany({
        where: { bookingId: { in: bookingIds }, hotelId },
        orderBy: { checkInDate: "asc" },
        select: { bookingId: true, roomType: true, checkInDate: true },
      })
    : [];
  const stayByBooking = new Map<string, { roomType: string; checkInDate: Date }>();
  for (const bh of bookingHotels) {
    if (!stayByBooking.has(bh.bookingId)) stayByBooking.set(bh.bookingId, bh);
  }

  return {
    overall,
    label: reviewLabelFor(overall),
    count,
    distribution: ([5, 4, 3, 2, 1] as const).map((stars) => ({
      stars,
      pct: count > 0 ? Math.round((breakdown[stars] / count) * 100) : 0,
    })),
    items: all.map((r) => {
      const stay = stayByBooking.get(r.booking_id);
      const comment = r.comment ?? "";
      return {
        id: String(r.id),
        name: r.guest_name,
        initials: initialsFor(r.guest_name),
        date: r.created_at.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        rating: r.rating,
        text: comment,
        images: r.images.length > 0 ? r.images : undefined,
        hostResponse: r.host_response,
        hostResponseAt: r.host_response_at
          ? r.host_response_at.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : null,
        roomType: stay?.roomType ?? null,
        travelMonth: stay ? stay.checkInDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : null,
        tags: deriveReviewTags(comment),
      };
    }),
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

export type { HotelCard } from "@/app/lib/hotels/hotelCard";

export type HotelSearchPage = {
  items: HotelCard[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/** Leading digit of the legacy "3 Star" text, accepted only in 1–5. */
function starsFromStayType(stayType: string | null): number | null {
  const n = Number(stayType?.trim().match(/^([1-5])/)?.[1]);
  return Number.isInteger(n) ? n : null;
}

/**
 * Match one star tier, reading the legacy `stay_type` text wherever the integer
 * column is still unset — the same fallback the card badge uses, so the filter
 * and what the card displays can't disagree. Once `star_rating` is backfilled
 * the first branch answers everything and the second matches nothing.
 */
export function starRatingWhere(n: number): Prisma.hotelsWhereInput {
  return {
    OR: [
      { star_rating: n },
      { star_rating: null, stay_type: { startsWith: `${n} Star`, mode: "insensitive" } },
    ],
  };
}

/**
 * Guest-facing name for a meal plan. The stored names are trade codes with the
 * detail bolted on ("CP(Breakfast only)", "MAP (Breakfast + Dinner)") — matched
 * on the descriptive part, never the code, because "AP" is a substring of "MAP".
 */
function mealPlanLabel(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  const text = rawName.toLowerCase();
  if (text.includes("all inclusive")) return "All Inclusive";
  if (text.includes("lunch")) return "All Meals Included";
  if (text.includes("breakfast + dinner")) return "Breakfast + Dinner";
  if (text.includes("breakfast")) return "Breakfast Included";
  return null;
}

/**
 * The chips shown on a card: the amenities a guest actually scans for, pulled
 * from the union of the property's rooms and ordered by AMENITY_OPTIONS so the
 * recognisable ones (Wi-Fi, Parking, Restaurant) win the four visible slots
 * instead of back-of-house entries like "Fire Extinguisher".
 */
function cardAmenities(rooms: { amenities: unknown }[]): string[] {
  const all = new Set<string>();
  for (const r of rooms) {
    for (const a of parseRoomAmenities(r.amenities)) all.add(a);
  }
  if (all.size === 0) return [];
  const preferred = AMENITY_OPTIONS.filter((a) => all.has(a));
  const rest = [...all].filter((a) => !preferred.includes(a as (typeof AMENITY_OPTIONS)[number]));
  return [...preferred, ...rest].slice(0, 4);
}

export const HOTELS_PAGE_SIZE = 24;

/**
 * Everything a hotel tile needs, in one place. Shared by the search results and
 * the detail page's similar-properties rail so the two can't drift — a guest
 * comparing four alternatives sees the same facts they were shown on the way in.
 */
const HOTEL_CARD_SELECT = {
  id: true, slug: true, name: true, city: true, state: true,
  star_rating: true, stay_type: true, category: true,
  images: { orderBy: [{ is_primary: "desc" as const }, { sort_order: "asc" as const }], take: 1, select: { url: true } },
  _count: { select: { images: true } },
  hotelRooms: {
    where: { is_active: true },
    select: {
      name: true, max_occupancy: true, bed_type: true, amenities: true,
      pricing: {
        where: { is_active: true },
        orderBy: { price_per_night: "asc" as const },
        take: 1,
        select: {
          price_per_night: true, gst_percentage: true,
          meal_type: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.hotelsSelect;

type HotelCardRow = Prisma.hotelsGetPayload<{ select: typeof HOTEL_CARD_SELECT }>;

function shapeHotelCard(h: HotelCardRow): HotelCard {
  // The cheapest sellable room drives the whole price block, so the "from"
  // figure and the room it describes can never come from different rooms.
  const cheapest = h.hotelRooms
    .map((r) => ({ room: r, plan: r.pricing[0] }))
    .filter((x): x is { room: typeof x.room; plan: NonNullable<typeof x.plan> } => !!x.plan)
    .sort((a, b) => Number(a.plan.price_per_night) - Number(b.plan.price_per_night))[0];

  const price = cheapest ? Number(cheapest.plan.price_per_night) : null;
  const gst = cheapest ? Number(cheapest.plan.gst_percentage) : null;

  return {
    id: h.id,
    slug: h.slug,
    name: h.name,
    city: h.city,
    state: h.state,
    // `star_rating` is still unpopulated on dashboard stock; the tier only
    // exists as text in `stay_type`. Falling back keeps the badge working
    // before the backfill lands, and costs nothing once it has.
    starRating: h.star_rating ?? starsFromStayType(h.stay_type),
    propertyType: h.category ? prettify(h.category) : null,
    image: imageUrl(h.images[0]?.url) ?? FALLBACK_IMG,
    photoCount: h._count.images,
    priceFrom: price,
    taxesFrom: price != null && gst != null ? Math.round(price * (gst / 100)) : null,
    mealPlan: mealPlanLabel(cheapest?.plan.meal_type?.name),
    roomName: cheapest?.room.name ?? null,
    maxOccupancy: cheapest?.room.max_occupancy ?? null,
    bedType: cheapest?.room.bed_type ?? null,
    roomTypeCount: h.hotelRooms.length,
    // Property-level `property_amenities` is set on 2 of 1 149 live hotels, so
    // the card's chips were almost always empty. The rooms carry the real list
    // (1 097 hotels), including property facilities like Reception and
    // Restaurant, so the card reads off those instead.
    amenities: cardAmenities(h.hotelRooms),
  };
}

/** Where the guest is searching — the place half, without sidebar selections. */
export type HotelSearchScope = {
  /** Free-text place or property name, e.g. the picked location's name. */
  query?: string;
  /** `Location.id` of the picked suggestion, when one was chosen from the picker. */
  locationId?: string;
  /** `Location.type` of that suggestion — decides which hierarchy column to match. */
  locationType?: string;
};

export type HotelSearchOpts = HotelSearchScope & {
  /** Sidebar selections. Omitted or empty means "no constraint". */
  filters?: HotelFilters;
  page?: number;
  pageSize?: number;
};

/**
 * Places match by hierarchy, not by string equality on one column.
 *
 * The picker returns any location type, but a hotel row only stores flat
 * `city`/`state` strings — so a STATE pick like "Kerala" matched nothing
 * against `city`, even though 172 Kerala properties exist under cities like
 * Munnar and Alappuzha. `locations` denormalises `country_id`/`state_id`/
 * `city_id` on every row (each indexed), so the picked location's own type
 * tells us which column to filter `hotels.location` on.
 */
function locationScopeFilter(locationId: string, locationType: string) {
  let id: bigint;
  try {
    id = BigInt(locationId);
  } catch {
    return null;
  }

  switch (locationType) {
    case "COUNTRY":
      return { location: { country_id: id } };
    case "STATE":
      return { location: { state_id: id } };
    case "REGION":
    case "SUBREGION":
      // Regions aren't denormalised onto locations — fall back to text match.
      return null;
    default:
      // CITY and everything more granular (AREA, DISTRICT, NEIGHBOURHOOD,
      // LANDMARK…): the location itself, anything filed under it as a city,
      // or anything hanging directly off it.
      return { location: { OR: [{ id }, { city_id: id }, { parent_id: id }] } };
  }
}

/**
 * Translate the sidebar selections into `hotels` where-clauses.
 *
 * Every dimension is ANDed (a 4-star *and* pool search means both), while the
 * options within one dimension are ORed — ticking two price bands widens the
 * range rather than returning nothing.
 *
 * Room-level dimensions use `some`, i.e. "this hotel has at least one room
 * that qualifies". That's the semantic guests expect from a hotel filter:
 * a property with one suite under ₹4 000 belongs in both a "Suite" search and
 * an "under ₹4 000" one.
 */
export function hotelFilterClauses(f: HotelFilters): Prisma.hotelsWhereInput[] {
  const and: Prisma.hotelsWhereInput[] = [];

  if (f.stars.length > 0) {
    and.push({ OR: f.stars.map(starRatingWhere) });
  }

  if (f.propertyTypes.length > 0) {
    const categories = PROPERTY_TYPES
      .filter((p) => f.propertyTypes.includes(p.slug))
      .flatMap((p) => p.categories);
    if (categories.length > 0) and.push({ category: { in: categories } });
  }

  if (f.price.length > 0) {
    const buckets = PRICE_BUCKETS.filter((b) => f.price.includes(b.slug));
    and.push({
      OR: buckets.map((b) => ({
        hotelRooms: {
          some: {
            is_active: true,
            pricing: {
              some: {
                is_active: true,
                price_per_night: {
                  gte: b.min,
                  ...(Number.isFinite(b.max) ? { lt: b.max } : {}),
                },
              },
            },
          },
        },
      })),
    });
  }

  if (f.roomTypes.length > 0) {
    const keywords = ROOM_TYPES
      .filter((r) => f.roomTypes.includes(r.slug))
      .flatMap((r) => r.keywords);
    and.push({
      hotelRooms: {
        some: {
          is_active: true,
          OR: keywords.map((kw) => ({ name: { contains: kw, mode: "insensitive" as const } })),
        },
      },
    });
  }

  if (f.mealPlans.length > 0) {
    const keywords = MEAL_PLANS
      .filter((m) => f.mealPlans.includes(m.slug))
      .flatMap((m) => m.keywords);
    and.push({
      room_pricing: {
        some: {
          is_active: true,
          OR: keywords.map((kw) => ({
            meal_type: { name: { contains: kw, mode: "insensitive" as const } },
          })),
        },
      },
    });
  }

  // Amenities are stored as a JSON string array per room. Each selected
  // amenity gets its own `some` rather than sharing one — a single clause
  // would only require one room to hold *any* of them, so ticking Pool + Gym
  // would match a hotel that has neither together.
  for (const amenity of f.amenities) {
    and.push({
      hotelRooms: {
        some: { is_active: true, amenities: { array_contains: [amenity] } },
      },
    });
  }

  return and;
}

/**
 * The LIVE-and-in-this-place half of the search predicate, with no sidebar
 * selections applied. Shared with the facet counts so a checkbox's number and
 * the result set it produces can never disagree about what "here" means.
 */
export function hotelSearchScopeWhere(scope: HotelSearchScope): Prisma.hotelsWhereInput {
  const q = scope.query?.trim();
  const hierarchy = scope.locationId && scope.locationType
    ? locationScopeFilter(scope.locationId, scope.locationType)
    : null;

  // Text match stays in the OR even when a location scope resolved: ~6% of
  // hotels have no `location_id` at all, so hierarchy alone would silently
  // drop them from results for their own city or state.
  //
  // Property name is matched at word starts only, not as a bare substring —
  // an unanchored `contains` pulls "Castle Bijaipur" (Bassi, Rajasthan) into a
  // Jaipur search. Anchoring still catches the cases that matter, like
  // "Ginger Goa Candolim", whose own city/state columns are empty.
  const textMatch = q
    ? [
        { city:  { contains: q, mode: "insensitive" as const } },
        { state: { contains: q, mode: "insensitive" as const } },
        { name:  { startsWith: q, mode: "insensitive" as const } },
        { name:  { contains: ` ${q}`, mode: "insensitive" as const } },
      ]
    : [];

  const anyOf = [...(hierarchy ? [hierarchy] : []), ...textMatch];

  return {
    listing_status: "LIVE" as const,
    ...(anyOf.length > 0 ? { OR: anyOf } : {}),
  };
}

/**
 * Search LIVE hotels for the listing page.
 *
 * Offset-paginated: the listing now serves 1 000+ properties, so the whole set
 * can't be sent in one payload. `id` is the ordering tiebreaker, which keeps
 * page boundaries stable — `star_rating` alone is NULL for the bulk of the
 * catalogue and would leave rows free to reshuffle between requests, silently
 * duplicating or skipping properties across pages.
 */
export async function searchHotels(opts: HotelSearchOpts = {}): Promise<HotelSearchPage> {
  const key = [
    CACHE_KEYS.hotelSearch,
    hotelScopeKey(opts),
    opts.page ?? 1,
    opts.pageSize ?? HOTELS_PAGE_SIZE,
    opts.filters ? hotelFiltersKey(opts.filters) : "-",
  ].join(":");
  return cached(key, () => searchHotelsUncached(opts), CACHE_TTL.short);
}

async function searchHotelsUncached(opts: HotelSearchOpts = {}): Promise<HotelSearchPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(48, Math.max(1, Math.floor(opts.pageSize ?? HOTELS_PAGE_SIZE)));
  const skip = (page - 1) * pageSize;

  const filterClauses = opts.filters ? hotelFilterClauses(opts.filters) : [];

  const where: Prisma.hotelsWhereInput = {
    ...hotelSearchScopeWhere(opts),
    ...(filterClauses.length > 0 ? { AND: filterClauses } : {}),
  };

  const [total, hotels] = await Promise.all([
    db.hotels.count({ where }),
    db.hotels.findMany({
      where,
      orderBy: [{ star_rating: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: HOTEL_CARD_SELECT,
    }),
  ]);

  return {
    items: hotels.map(shapeHotelCard),
    total,
    page,
    pageSize,
    hasMore: skip + hotels.length < total,
  };
}

/**
 * Nearby alternatives for the "Similar properties nearby" rail.
 *
 * "Nearby" is resolved by locality, not radius: dashboard-created hotels have
 * no coordinates of their own, and the fallback ones we can derive resolve to a
 * shared city centroid — every hotel in a city would sit at distance zero from
 * every other, so a radius sort would be noise dressed up as precision.
 *
 * Widens one step at a time (same city → same state) and stops as soon as it
 * has enough, so a well-stocked city never pulls in a property 400 km away.
 */
async function getSimilarHotels(
  hotelId: number,
  city: string | null,
  state: string | null,
  take = 4,
): Promise<SimilarHotel[]> {
  const baseWhere: Prisma.hotelsWhereInput = {
    listing_status: "LIVE",
    id: { not: hotelId },
    // Only offer alternatives a guest can actually act on.
    hotelRooms: { some: { is_active: true, pricing: { some: { is_active: true, price_per_night: { gt: 0 } } } } },
  };

  const runTier = (where: Prisma.hotelsWhereInput, exclude: number[], limit: number) =>
    db.hotels.findMany({
      where: { ...baseWhere, ...where, id: { notIn: [hotelId, ...exclude] } },
      orderBy: [{ star_rating: "desc" }, { id: "desc" }],
      take: limit,
      select: HOTEL_CARD_SELECT,
    });

  const tiers: Prisma.hotelsWhereInput[] = [
    ...(city ? [{ city }] : []),
    ...(state ? [{ state }] : []),
  ];

  const found: HotelCardRow[] = [];

  for (const tier of tiers) {
    if (found.length >= take) break;
    const rows = await runTier(tier, found.map((r) => r.id), take - found.length);
    found.push(...rows);
  }

  return found.map(shapeHotelCard);
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
      // `stay_type` carries the real tier as text ("4 Star") on almost all
      // stock — `star_rating` is populated on a handful of rows — so the detail
      // page needs both to report the tier truthfully.
      star_rating: true, stay_type: true, category: true, description: true, property_amenities: true,
      check_in_time: true, check_out_time: true, cancellation_policy: true,
      allow_unmarried_couples: true, allow_guests_below_18: true, smoking_allowed: true,
      acceptable_id_proofs: true, pets_allowed: true,
      allow_male_only_groups: true, allow_same_city_id: true,
      parties_events_allowed: true, wheelchair_accessible: true, allow_outside_visitors: true,
      pets_on_property: true, allowed_pet_types: true, pet_extra_charges: true,
      pets_restricted_areas: true, pets_without_leash: true, pet_food_available: true,
      pet_count: true, pet_charge_amount: true,
      checkin_24_hours: true, has_check_in_end_time: true, check_in_end_time: true,
      infant_free_occupancy: true, infant_complimentary_food: true,
      extra_bed_included: true, provide_bed_extra_adults: true, provide_bed_extra_kids: true,
      extra_bed_adults_types: true, extra_cot_charge_adult: true, extra_mattress_charge_adult: true, extra_sofa_charge_adult: true,
      extra_bed_kids_types: true, extra_cot_charge_child: true, extra_mattress_charge_child: true, extra_sofa_charge_child: true, extra_crib_charge_child: true,
      meal_price_breakfast: true, meal_price_lunch: true, meal_price_dinner: true,
      smoking_areas: true, entry_exit_restrictions: true, noise_policy: true,
      self_checkin_smart_door: true, host_greets_helps: true, caretaker_greets_helps: true, building_staff_keys: true,
      custom_policy: true,
      childPolicies: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: { age_from: true, age_to: true, charge_type: true, price: true, description: true },
      },
      property_category: true, property_sub_type: true, hs_bedrooms: true, hs_bathrooms: true,
      hs_bedroom_details: true, host_lives_at_property: true, caretaker_stays: true,
      // Coordinate fallbacks — dashboard-created hotels never captured their
      // own lat/lng, which left the location map switched off entirely.
      location: { select: { latitude: true, longitude: true } },
      destination: { select: { latitude: true, longitude: true } },
      images: {
        orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
        select: { url: true, tags: true },
      },
      hotelRooms: {
        where: { is_active: true },
        orderBy: { sort_order: "asc" },
        select: {
          id: true, name: true, area_sqft: true, area_unit: true, bed_type: true,
          view_type: true, base_adults: true, max_adults: true, max_children: true,
          max_occupancy: true, amenities: true, extra_bed_capacity: true,
          images: { orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }], select: { url: true } },
          pricing: {
            where: { is_active: true },
            orderBy: { price_per_night: "asc" },
            select: {
              id: true, price_per_night: true, original_price: true, gst_percentage: true,
              plan_name: true, cancellation_policy: true, meal_type: { select: { name: true } },
              // Presence only — enough to tell the guest rates move with the
              // calendar, without listing every season back at them.
              seasons: { where: { is_active: true }, take: 1, select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!h) return null;

  const hotelImages = h.images.map((i) => imageUrl(i.url)).filter((u): u is string => !!u);
  // Amenity source of truth: the property-level `property_amenities` JSON is
  // set on 2 of 1 149 live hotels, so relying on it alone rendered an empty
  // Amenities section for the whole imported catalogue. The rooms carry the
  // real list — 111 distinct values, ~20 per property, including house-wide
  // facilities like Reception, Restaurant and Power Backup — so the union of
  // those is used, with `property_amenities` merged in wherever it does exist.
  const roomAmenityNames = [...new Set(h.hotelRooms.flatMap((r) => parseRoomAmenities(r.amenities)))];
  const labels = [...new Set([...amenityLabels(h.property_amenities), ...roomAmenityNames])];

  // Full gallery: grouped by each photo's own owner-set tag (Facade, Lobby,
  // Bedroom, …) + a "Rooms" category aggregating every room's own photos —
  // mirrors the package page's FullGallery categorization.
  const galleryCategories = buildPropertyGalleryCategories(h.images, h.property_sub_type === "GUEST_HOUSE");
  const roomGalleryImages = h.hotelRooms.flatMap((r) =>
    r.images
      .filter((i): i is typeof i & { url: string } => !!i.url)
      .map((i) => ({ src: getImageUrl(i.url, IMAGE_SIZES.gallery), fullSrc: getImageUrl(i.url, IMAGE_SIZES.lightbox), label: r.name })),
  );
  if (roomGalleryImages.length > 0) galleryCategories.push({ label: "Rooms", images: roomGalleryImages });

  // Precise coordinates the property itself supplied, versus the locality
  // centroid we can derive from its linked location/destination. The two are
  // kept apart deliberately: the map can honestly show an approximate pin, but
  // landmark distances ("1.2 km from the property") are quantitative claims and
  // are only computed from coordinates the property actually gave us.
  const ownLat = h.latitude != null ? Number(h.latitude) : null;
  const ownLng = h.longitude != null ? Number(h.longitude) : null;
  const hasOwnCoords = ownLat != null && ownLng != null;

  const fallbackLat = h.location?.latitude ?? h.destination?.latitude ?? null;
  const fallbackLng = h.location?.longitude ?? h.destination?.longitude ?? null;
  const displayLat = ownLat ?? (fallbackLat != null ? Number(fallbackLat) : null);
  const displayLng = ownLng ?? (fallbackLng != null ? Number(fallbackLng) : null);

  const [rooms, reviewStats, landmarkGroups, similar] = await Promise.all([
    Promise.all(
    h.hotelRooms.map(async (r): Promise<Room> => {
      const ari = await getRoomARI(r.id, checkIn, checkOut);
      const roomsLeft = ari.length ? Math.min(...ari.map((n) => n.available)) : null;
      const roomAmenities = parseRoomAmenities(r.amenities);
      const roomImages = r.images.map((i) => imageUrl(i.url)).filter((u): u is string => !!u);

      // One rate plan per active pricing row (Room Only, With Breakfast, …).
      const rows = r.pricing.length > 0 ? r.pricing : [null];
      const ratePlans: RatePlan[] = rows.map((p, idx) => {
        const nightly = p ? Number(p.price_per_night) : ari[0]?.price ?? 0;
        const gst = p ? Number(p.gst_percentage) : 12;
        // Only ever the property's own pre-discount rate. This used to fall
        // back to `nightly * 1.15`, which invented a 15% "was" price for every
        // rate plan that had none — and no hotel in the imported catalogue has
        // one, so the entire live inventory advertised a discount off a price
        // that was never charged. A struck-through figure is a factual claim
        // about past pricing; absent real data the honest answer is no claim.
        const original = p?.original_price ? Number(p.original_price) : null;
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
        allAmenities: groupedRoomAmenities(roomAmenities),
        ratePlans,
        roomsLeft,
      };
    }),
    ),
    getReviewStats(h.id),
    hasOwnCoords
      ? getOrFetchLandmarks(h.id, ownLat, ownLng)
      : Promise.resolve([]),
    getSimilarHotels(h.id, h.city, h.state),
  ]);

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

  // ── Policies & Important Information ────────────────────────────────────
  // Every bullet below is derived from a real wizard field the owner actually
  // set — no section is invented, and tri-state booleans that were never
  // answered (factIf returning null) are omitted rather than shown as "no".
  const propAmenities = (h.property_amenities as Record<string, unknown>) ?? {};
  const petTypes = h.allowed_pet_types ?? [];

  const checkInOutNotes: PolicySection = {
    title: "Check-in / Check-out",
    items: [
      h.checkin_24_hours ? "24-hour check-in available" : null,
      h.has_check_in_end_time && h.check_in_end_time ? `Check-in ends at ${h.check_in_end_time}` : null,
    ].filter((x): x is string => x != null),
  };

  const specialInstructions: PolicySection = {
    title: "Special Check-in Instructions",
    items: h.custom_policy ? [h.custom_policy] : [],
  };

  const accessMethods: PolicySection = {
    title: "Access Methods",
    items: [
      isAmenityOn(propAmenities.Reception) ? "Staffed front desk" : null,
      h.self_checkin_smart_door ? "Self check-in via smart lock" : null,
      h.host_lives_at_property && h.host_greets_helps ? "Host greets guests on arrival" : null,
      h.caretaker_stays && h.caretaker_greets_helps ? "Caretaker greets guests on arrival" : null,
      h.building_staff_keys ? "Building staff hold a set of keys" : null,
    ].filter((x): x is string => x != null),
  };

  const guestProfile: PolicySection = {
    title: "Guest Profile",
    items: [
      factIf(h.allow_unmarried_couples, "Couples are welcome.", "Unmarried couples are not allowed."),
      factIf(h.allow_guests_below_18, "Guests below 18 are allowed.", "Guests below 18 are not allowed without a guardian."),
      factIf(h.allow_male_only_groups, "Male-only groups are allowed.", "Male-only groups are not allowed."),
      factIf(h.allow_same_city_id, "Local guests with a same-city ID are accepted.", "Local guests with a same-city ID are not accepted."),
    ].filter((x): x is string => x != null),
  };

  const pets: PolicySection = {
    title: "Pets",
    items: [
      factIf(h.pets_allowed, "Pets are allowed.", "Pets are not allowed."),
      h.pets_allowed && petTypes.length ? `Allowed pet types: ${petTypes.join(", ")}.` : null,
      h.pets_allowed ? factIf(h.pet_extra_charges, "Additional charges apply for pets.", "No extra charge for pets.") : null,
      h.pets_allowed ? factIf(h.pets_without_leash, "Pets may be off-leash on the property.", "Pets must be kept on a leash.") : null,
      h.pets_allowed ? factIf(h.pet_food_available, "Pet food is available on request.", "Pet food is not provided.") : null,
      h.pets_allowed && h.pet_count != null ? `Maximum ${h.pet_count} pet(s) allowed.` : null,
      h.pets_allowed && money0(h.pet_charge_amount) ? `Pet charge: ${money0(h.pet_charge_amount)}.` : null,
      h.pets_allowed && h.pets_restricted_areas ? `Restricted areas for pets: ${h.pets_restricted_areas}.` : null,
    ].filter((x): x is string => x != null),
  };

  const extraBedAdultCharges = [
    money0(h.extra_mattress_charge_adult) && `Mattress ${money0(h.extra_mattress_charge_adult)}/night`,
    money0(h.extra_cot_charge_adult) && `Cot ${money0(h.extra_cot_charge_adult)}/night`,
    money0(h.extra_sofa_charge_adult) && `Sofa bed ${money0(h.extra_sofa_charge_adult)}/night`,
  ].filter((x): x is string => !!x);

  const extraBedKidCharges = [
    money0(h.extra_mattress_charge_child) && `Mattress ${money0(h.extra_mattress_charge_child)}/night`,
    money0(h.extra_cot_charge_child) && `Cot ${money0(h.extra_cot_charge_child)}/night`,
    money0(h.extra_sofa_charge_child) && `Sofa bed ${money0(h.extra_sofa_charge_child)}/night`,
    money0(h.extra_crib_charge_child) && `Crib ${money0(h.extra_crib_charge_child)}/night`,
  ].filter((x): x is string => !!x);

  const childPolicyLines = h.childPolicies.map((cp) => {
    const price = money0(cp.price);
    const chargeLabel = CHARGE_TYPE_LABEL[cp.charge_type] ?? prettify(cp.charge_type);
    const detail = cp.description || (price ? `${chargeLabel} (${price}/night)` : chargeLabel);
    return `Children aged ${cp.age_from}–${cp.age_to}: ${detail}.`;
  });

  const childrenAndExtraBeds: PolicySection = {
    title: "Children & Extra Beds",
    items: [
      factIf(h.infant_free_occupancy, "Infants stay free of charge.", "Infants are charged the standard occupancy rate."),
      factIf(h.infant_complimentary_food, "Complimentary food is provided for infants.", "Food for infants is charged separately."),
      factIf(h.extra_bed_included, "Extra bed charges are included in the room rate.", "Extra bed charges are not included in the room rate."),
      h.provide_bed_extra_adults === true
        ? `Extra bed for adults available${h.extra_bed_adults_types.length ? ` (${h.extra_bed_adults_types.join(", ")})` : ""}${extraBedAdultCharges.length ? ` — ${extraBedAdultCharges.join(", ")}` : ""}.`
        : h.provide_bed_extra_adults === false ? "Extra bed for adults is not available." : null,
      h.provide_bed_extra_kids === true
        ? `Extra bed for children available${h.extra_bed_kids_types.length ? ` (${h.extra_bed_kids_types.join(", ")})` : ""}${extraBedKidCharges.length ? ` — ${extraBedKidCharges.join(", ")}` : ""}.`
        : h.provide_bed_extra_kids === false ? "Extra bed for children is not available." : null,
      ...childPolicyLines,
    ].filter((x): x is string => x != null),
  };

  const optionalExtras: PolicySection = {
    title: "Optional Extras",
    items: [
      money0(h.meal_price_breakfast) ? `Breakfast: ${money0(h.meal_price_breakfast)} per person` : null,
      money0(h.meal_price_lunch) ? `Lunch: ${money0(h.meal_price_lunch)} per person` : null,
      money0(h.meal_price_dinner) ? `Dinner: ${money0(h.meal_price_dinner)} per person` : null,
    ].filter((x): x is string => x != null),
  };

  // ── Sections derived from the rooms and rate plans ─────────────────────────
  // The wizard's tri-state policy booleans are unset across the imported
  // catalogue, which left Property Rules showing little more than a
  // cancellation line. These facts are read off inventory the property really
  // did fill in — room configuration, occupancy, meal plans and tax — so they
  // add substance without asserting anything nobody entered.
  const activeRooms = h.hotelRooms;
  const bedTypes = [...new Set(activeRooms.map((r) => r.bed_type).filter((b): b is string => !!b))];
  const viewTypes = [...new Set(activeRooms.map((r) => r.view_type).filter((v): v is string => !!v))];
  const maxGuestsAcrossRooms = Math.max(
    0,
    ...activeRooms.map((r) => r.max_occupancy ?? r.max_adults + (r.max_children ?? 0)),
  );
  const roomsWithExtraBed = activeRooms.filter((r) => (r.extra_bed_capacity ?? 0) > 0).length;
  const maxChildren = Math.max(0, ...activeRooms.map((r) => r.max_children ?? 0));
  const mealPlanNames = [
    ...new Set(
      activeRooms
        .flatMap((r) => r.pricing.map((p) => mealPlanLabel(p.meal_type?.name)))
        .filter((m): m is string => !!m),
    ),
  ];
  const gstRates = [...new Set(activeRooms.flatMap((r) => r.pricing.map((p) => Number(p.gst_percentage))))]
    .filter((n) => Number.isFinite(n) && n > 0);
  const hasSeasonalRates = activeRooms.some((r) => r.pricing.some((p) => p.seasons.length > 0));

  const roomsAndBedding: PolicySection = {
    title: "Rooms & Bedding",
    items: [
      activeRooms.length > 0
        ? `${activeRooms.length} room type${activeRooms.length === 1 ? "" : "s"} available at this property.`
        : null,
      maxGuestsAcrossRooms > 0 ? `Rooms accommodate up to ${maxGuestsAcrossRooms} guests.` : null,
      bedTypes.length > 0 ? `Bedding options: ${bedTypes.join(", ")}.` : null,
      viewTypes.length > 0 ? `Room views available: ${viewTypes.join(", ")}.` : null,
      roomsWithExtraBed > 0
        ? `Extra bed can be added in ${roomsWithExtraBed} of ${activeRooms.length} room type${activeRooms.length === 1 ? "" : "s"}.`
        : null,
      maxChildren > 0 ? `Children can be accommodated — up to ${maxChildren} per room.` : null,
    ].filter((x): x is string => x != null),
  };

  const mealsAndPlans: PolicySection = {
    title: "Meals & Rate Plans",
    items: [
      mealPlanNames.length > 0
        ? `Rate plans available with: ${mealPlanNames.join(", ")}.`
        : "Room-only rates. Meals can be arranged directly with the property.",
      hasSeasonalRates ? "Rates vary by season and travel date — the price shown is for your selected dates." : null,
    ].filter((x): x is string => x != null),
  };

  const paymentAndTaxes: PolicySection = {
    title: "Payment & Taxes",
    items: [
      gstRates.length === 1
        ? `${gstRates[0]}% GST is applicable on the room tariff.`
        : gstRates.length > 1
          ? `GST of ${Math.min(...gstRates)}–${Math.max(...gstRates)}% applies depending on the rate plan.`
          : null,
      "Taxes and fees are shown separately at checkout before you pay.",
    ].filter((x): x is string => x != null),
  };

  const youNeedToKnow: PolicySection = {
    title: "You Need to Know",
    items: [
      factIf(h.smoking_allowed, "Smoking is allowed in designated areas.", "Smoking is not allowed on the property."),
      h.smoking_allowed && h.smoking_areas ? `Designated smoking areas: ${h.smoking_areas}.` : null,
      factIf(h.parties_events_allowed, "Parties/events are allowed.", "Parties/events are not allowed."),
      factIf(h.wheelchair_accessible, "The property is wheelchair accessible.", "The property is not wheelchair accessible."),
      factIf(h.allow_outside_visitors, "Outside visitors are allowed.", "Outside visitors are not allowed."),
      factIf(h.entry_exit_restrictions, "Entry/exit restrictions apply.", "No entry/exit restrictions."),
      h.noise_policy,
    ].filter((x): x is string => x != null),
  };

  const weShouldMention: PolicySection = {
    title: "We Should Mention",
    items: [
      `${cancellationLabel((h.cancellation_policy as CancellationPolicy | null) ?? "NON_REFUNDABLE")}.`,
      Array.isArray(h.acceptable_id_proofs) && h.acceptable_id_proofs.length
        ? `Accepted ID proofs: ${h.acceptable_id_proofs.join(", ")}.`
        : null,
    ].filter((x): x is string => x != null),
  };

  // Compact MMT-style highlight shown at the top of the Property Rules card
  // (the full section-by-section detail is rendered below it, inline).
  const couplesRule = h.allow_unmarried_couples != null
    ? `${h.allow_unmarried_couples ? "Unmarried couples allowed" : "Unmarried couples not allowed"}${
        h.allow_same_city_id != null ? `. Local ids ${h.allow_same_city_id ? "allowed" : "not allowed"}` : ""
      }.`
    : null;

  const minAgeRule = h.allow_guests_below_18 === false ? "Primary guest should be at least 18 years of age." : null;

  // Circular "trust badge" row at the top of Property Rules — same tri-state
  // rule as everywhere else in this section: a field the owner never
  // answered is omitted, never shown as a hard "no".
  type PolicyBadge = { icon: string; label: string; active: boolean };
  const policyBadges: PolicyBadge[] = [
    h.allow_unmarried_couples != null
      ? { icon: "heart", label: h.allow_unmarried_couples ? "Couple Friendly" : "Couples Restricted", active: h.allow_unmarried_couples }
      : null,
    h.pets_allowed != null
      ? { icon: "paw", label: h.pets_allowed ? "Pet Friendly" : "No Pets", active: h.pets_allowed }
      : null,
    h.wheelchair_accessible != null
      ? { icon: "wheelchair", label: "Wheelchair Accessible", active: h.wheelchair_accessible }
      : null,
    h.infant_free_occupancy != null
      ? { icon: "baby", label: h.infant_free_occupancy ? "Infant Free" : "Infants Charged", active: h.infant_free_occupancy }
      : null,
  ].filter((b): b is PolicyBadge => b != null);

  return {
    id: h.id,
    slug: h.slug,
    name: h.name,
    // Same fallback the listing card uses. Defaulting to 3 here labelled every
    // unrated property a "3-Star Hotel", including 5-star ones.
    starRating: h.star_rating ?? starsFromStayType(h.stay_type),
    propertyType: h.category ? prettify(h.category) : null,
    address: [h.address, h.city, h.state].filter(Boolean).join(", ") || (h.city ?? ""),
    area: h.city ?? "",
    city: h.city ?? "",
    latitude: displayLat,
    longitude: displayLng,
    approximateLocation: !hasOwnCoords && displayLat != null,
    reviewScore: reviewStats.overall,
    reviewLabel: reviewStats.label,
    reviewCount: reviewStats.count,
    tags: headlineAmenities(labels, 4),
    images: hotelImages.length ? hotelImages : [FALLBACK_IMG],
    galleryCategories,
    about: h.description ?? `${h.name} in ${h.city ?? "India"} — comfortable rooms and warm hospitality.`,
    amenities: headlineAmenities(labels, 8).map((l) => ({ icon: iconFor(l), label: l })),
    allAmenities: groupAmenityNames(labels, iconFor),
    landmarks: landmarkGroups,
    policies: {
      checkIn: h.check_in_time ?? "12:00 PM",
      checkOut: h.check_out_time ?? "11:00 AM",
      couplesRule,
      minAgeRule,
      badges: policyBadges,
      sections: withFacts([
        checkInOutNotes, specialInstructions, accessMethods,
        roomsAndBedding, guestProfile, pets, childrenAndExtraBeds,
      ]),
      importantInfo: withFacts([mealsAndPlans, optionalExtras, paymentAndTaxes, youNeedToKnow, weShouldMention]),
    },
    rooms,
    homestay,
    reviews: reviewStats,
    similar,
    nights: nightsBetween(checkIn, checkOut),
  } as Hotel & { nights: number };
}
