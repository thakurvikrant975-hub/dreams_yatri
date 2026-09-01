"use server";

// Staff-only preview data for a catalog `packages` row, shaped into the
// builder document's own PreviewData contract — the same shape
// fetch-shared-package.ts builds from a `custom_packages` row for the
// client's published link. Rendering it through the exact same
// ItineraryDocument component means a catalog package previews with the
// identical design the exec builds against and the client is sent, instead
// of a second, drifting "preview" look.
//
// Deliberately reads its own data rather than converting a catalog package
// into a real custom_packages row: PreviewData is already a flat, denormalized
// render contract (see ItineraryDocument's PreviewData interface) with every
// FK-pricing field (roomPricingId, cabPricingId, …) optional and meant to be
// null for a hand-typed/no-catalog-room day — getSharedPackage sets exactly
// those fields to null for the very same reason. A catalog package has no
// hotel_room_pricing/cab_pricing rows of its own to point at, so this preview
// is content-only: real hotel/activity/transfer text, no live pricing FKs.
//
// Two entry points because a catalog package can genuinely have no active
// duration/route (see fetch-page-data's allowMissingStay) — there is no
// itinerary to show in that case, only what's set at the package level.

import { db } from "@/app/lib/db";
import { fetchPackagePageData, getDurationStartingPrices } from "@/app/actions/packages/fetch-page-data";
import { getDestinationCoverImage } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { getItinerarySettings } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder/[packageId]/ItineraryDocument";

function expandMealPlan(mealType: string | null | undefined, planName: string | null | undefined): string[] {
  const raw = mealType ?? planName ?? "";
  const s = raw.toLowerCase();
  if (!s.trim()) return [];
  const found: string[] = [];
  if (s.includes("breakfast")) found.push("Breakfast");
  if (/morning[\s_-]*snack/.test(s)) found.push("Morning Snacks");
  if (s.includes("lunch")) found.push("Lunch");
  if (/evening[\s_-]*snack/.test(s)) found.push("Evening Snacks");
  if (s.includes("dinner")) found.push("Dinner");
  if (found.length) return found;
  const code = s.trim();
  if (code === "ap" || code === "full board") return ["Breakfast", "Lunch", "Dinner"];
  if (code === "map" || code === "half board") return ["Breakfast", "Dinner"];
  if (code === "cp" || code === "bb") return ["Breakfast"];
  return [];
}

function mealKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

const MEAL_ORDER = ["breakfast", "morning_snacks", "lunch", "evening_snacks", "dinner"];

/** The company header/footer + house template/theme, common to every
 * catalog preview regardless of how much of the package is filled in. */
async function companyFields() {
  const settings = await getItinerarySettings();
  return {
    template: null,
    themeOverrides: null,
    companySettings: {
      phone: settings.companyPhone,
      email: settings.companyEmail,
      address: settings.companyAddress,
      description: settings.companyDescription,
      disclaimer: settings.documentDisclaimer,
      defaultTemplate: settings.defaultTemplate,
      themeOverrides: settings.themeOverrides,
    },
    customPolicySections: settings.customPolicySections,
  } satisfies Partial<PreviewData>;
}

/** Catalog `policies` (cancellation/date-change/refund/T&C) map onto
 * PreviewData's shape as: T&C into the standard termsConditions list (a
 * PreviewData field custom_packages also has), everything else into
 * customPolicySections — the field that exists precisely for "admin-defined
 * extra policy blocks beyond the six fixed lists". */
function splitPolicies(policies: { type: string; title: string; points: string[] }[]): {
  termsConditions: string[];
  extraSections: { id: string; title: string; items: string[] }[];
} {
  const termsConditions: string[] = [];
  const extraSections: { id: string; title: string; items: string[] }[] = [];
  policies.forEach((p, i) => {
    if (p.type === "TERMS_AND_CONDITIONS") {
      termsConditions.push(...p.points);
    } else {
      const label =
        p.type === "CANCELLATION" ? "Cancellation Policy"
          : p.type === "DATE_CHANGE" ? "Date Change Policy"
            : p.type === "REFUND" ? "Refund Policy"
              : p.title;
      extraSections.push({ id: `catalog-policy-${i}`, title: label, items: p.points });
    }
  });
  return { termsConditions, extraSections };
}

/** The rich path: a package with an active duration + route (stay optional —
 * a missing one just means every day's accommodation section stays empty,
 * same as fetchPackagePageData's own allowMissingStay behaviour). */
export async function getCatalogPackagePreview(
  slug: string,
  durationSlug: string,
  routeSlug: string,
  staySlug: string,
): Promise<PreviewData | null> {
  const pageData = await fetchPackagePageData(slug, durationSlug, routeSlug, staySlug, {
    includeInactive: true,
    allowMissingStay: true,
  });
  if (!pageData) return null;

  const company = await companyFields();

  const stopNames = [...new Set((pageData.selectedRoute?.stops ?? []).map((s) => s.place_name.trim()).filter(Boolean))];
  const stopImageEntries = await Promise.all(stopNames.map(async (name) => [name, await getDestinationCoverImage(name)] as const));
  const stopImages = Object.fromEntries(stopImageEntries);

  const startingStayId = pageData.selectedStay?.id ?? pageData.stay_categories.find((s) => s.is_default)?.id ?? pageData.stay_categories[0]?.id;
  let pricePerPerson = "";
  let totalPrice = "";
  if (startingStayId) {
    const prices = await getDurationStartingPrices(pageData.id, [pageData.currentDuration.id], startingStayId, {
      adults: 2, children: 0, childAges: [], travelDate: new Date().toISOString().slice(0, 10),
    });
    const info = prices.get(pageData.currentDuration.id);
    if (info?.pricePerAdult) {
      pricePerPerson = String(info.pricePerAdult);
      totalPrice = String(info.pricePerAdult * 2);
    }
  }

  const { termsConditions, extraSections } = splitPolicies(pageData.policies);

  const hotelRunStart = new Map<number, number>();
  for (let i = 0; i < pageData.itinerary.length; i++) {
    const d = pageData.itinerary[i];
    if (!d.hotel) continue;
    const prev = pageData.itinerary[i - 1];
    if (prev?.hotel?.id === d.hotel.id) continue;
    let nights = 1;
    for (let j = i + 1; j < pageData.itinerary.length; j++) {
      if (pageData.itinerary[j].hotel?.id === d.hotel.id) nights++;
      else break;
    }
    hotelRunStart.set(d.day, nights);
  }

  const itineraries: PreviewData["itineraries"] = pageData.itinerary.map((d, dayIdx) => {
    const chosen = new Map<string, string | null>();
    const prevHotel = pageData.itinerary[dayIdx - 1]?.hotel ?? null;
    if (prevHotel) {
      const pm = prevHotel.active_meals.length > 0 ? prevHotel.active_meals : expandMealPlan(prevHotel.meal_type, prevHotel.plan_name);
      if (pm.some((m) => mealKey(m) === "breakfast")) chosen.set("breakfast", prevHotel.name);
    }
    if (d.hotel) {
      const hm = d.hotel.active_meals.length > 0 ? d.hotel.active_meals : expandMealPlan(d.hotel.meal_type, d.hotel.plan_name);
      for (const m of hm) {
        const k = mealKey(m);
        if (k === "breakfast") continue;
        if (!chosen.has(k)) chosen.set(k, d.hotel.name);
      }
    }
    const excluded = new Set((d.excluded_meals ?? []).map(mealKey));
    for (const a of d.activities) {
      for (const m of (a.included_meals ?? [])) {
        const k = mealKey(m);
        if (excluded.has(k) || chosen.has(k)) continue;
        chosen.set(k, a.name);
      }
    }
    for (const m of (d.meals ?? [])) {
      const k = mealKey(m);
      if (!chosen.has(k)) chosen.set(k, null);
    }
    const orderedMeals = [...chosen.keys()]
      .filter((k) => !excluded.has(k))
      .sort((a, b) => {
        const ia = MEAL_ORDER.indexOf(a), ib = MEAL_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map((k) => k.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));

    const runNights = d.hotel ? hotelRunStart.get(d.day) : undefined;
    const primaryTransfer = [...d.transfers].sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;

    const hotelImages = (d.hotel?.images ?? []).map((i) => i.url).filter((u): u is string => !!u);
    const roomImages = (d.hotel?.room_images ?? []).map((i) => i.url).filter((u): u is string => !!u);

    return {
      day: d.day,
      title: d.title,
      description: d.description ?? "",
      activities: d.activities.map((a) => ({
        title: a.name,
        description: a.description ?? "",
        photo: a.images[0]?.url ?? "",
        photos: a.images.slice(1, 4).map((i) => i.url),
        photoLabels: a.images.slice(1, 4).map((i) => i.label ?? i.alt ?? ""),
      })),
      meals: orderedMeals,
      accommodation: d.hotel?.name ?? "",
      accommodationPhoto: hotelImages[0] ?? "",
      accommodationRoomPhotos: roomImages,
      accommodationLocation: d.hotel?.location ?? d.hotel?.address ?? "",
      accommodationRoomSpecs: [d.hotel?.room_bed_type, d.hotel?.room_area_sqft ? `${d.hotel.room_area_sqft} sqft` : null, d.hotel?.room_view]
        .filter(Boolean).join(" · "),
      accommodationStarRating: d.hotel?.stay_type ?? "",
      accommodationRoomCapacity: d.hotel?.room_capacity ?? null,
      accommodationMaxAdults: null,
      accommodationMaxChildren: null,
      accommodationExtraBedCapacity: null,
      manualExtraBeds: null,
      roomPricingId: null,
      roomsCount: d.hotel && runNights !== undefined ? (d.hotel.room_num_rooms ?? null) : null,
      extraRooms: [],
      hotelCheckIn: d.hotel?.check_in_time ?? "",
      hotelCheckOut: d.hotel?.check_out_time ?? "",
      hotelMealPlan: d.hotel?.meal_type ?? d.hotel?.plan_name ?? "",
      hotelPending: false,
      hotelPendingNote: "",
      manualHotelPricePerNight: null,
      transport: primaryTransfer?.vehicle_name ?? "",
      transportPhoto: "",
      transportVehicleType: primaryTransfer?.vehicle_type ?? "",
      transportSeats: primaryTransfer?.vehicle_capacity ?? null,
      transportPickup: primaryTransfer?.pickup_name ?? "",
      transportPickupLat: null,
      transportPickupLng: null,
      transportDropLat: null,
      transportDropLng: null,
      transportDrop: primaryTransfer?.drop_name ?? "",
      transportDistanceKm: primaryTransfer?.distance_km ?? null,
      transportTravelTime: "",
      cabPricingId: null,
      cabQuantity: primaryTransfer?.num_vehicles ?? null,
      extraCabs: [],
      notes: primaryTransfer?.notes ?? "",
    };
  });

  return {
    ...company,
    customPolicySections: [...(company.customPolicySections ?? []), ...extraSections],
    title: pageData.title,
    description: pageData.description ?? "",
    coverImage: pageData.thumbnail ?? pageData.images[0]?.url ?? "",
    coverImagePosition: 50,
    destination: pageData.destination.name,
    startingPoint: "",
    totalDays: pageData.currentDuration.days,
    totalNights: pageData.currentDuration.nights,
    travelDate: "",
    adults: 2,
    children: 0,
    infants: 0,
    childrenAges: [],
    pricePerPerson,
    totalPrice,
    currency: "INR",
    inclusions: pageData.inclusions,
    exclusions: pageData.exclusions,
    termsNotes: "",
    termsConditions,
    paymentPolicy: [],
    amendmentPolicy: [],
    travelBenefits: [],
    stops: (pageData.selectedRoute?.stops ?? []).map((s) => ({ name: s.place_name, nights: s.stay_days, image: stopImages[s.place_name] ?? undefined })),
    stopImages,
    itineraries,
    tickets: [],
    addOns: [],
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    queryId: null,
    execName: "",
    execEmail: "",
    execDesignation: "",
  };
}

/** The lightweight path: a package with no active duration/route at all, so
 * there is genuinely no itinerary — only what's set at the package level. */
export async function getCatalogPackagePreviewSummary(slug: string): Promise<PreviewData | null> {
  const pkg = await db.packages.findUnique({
    where: { slug },
    select: {
      title: true, thumbnail: true, description: true, inclusions: true, exclusions: true,
      destination: { select: { name: true } },
      images: { orderBy: { sort_order: "asc" }, select: { url: true, is_primary: true } },
      policies: {
        orderBy: { policy: { sort_order: "asc" } },
        select: { policy: { select: { type: true, title: true, points: true } } },
      },
    },
  });
  if (!pkg) return null;

  const company = await companyFields();
  const { termsConditions, extraSections } = splitPolicies(pkg.policies.map((p) => p.policy));
  const cover = pkg.thumbnail ?? pkg.images.find((i) => i.is_primary)?.url ?? pkg.images[0]?.url ?? "";

  return {
    ...company,
    customPolicySections: [...(company.customPolicySections ?? []), ...extraSections],
    title: pkg.title,
    description: pkg.description ?? "",
    coverImage: cover,
    coverImagePosition: 50,
    destination: pkg.destination.name,
    startingPoint: "",
    totalDays: 0,
    totalNights: 0,
    travelDate: "",
    adults: 2,
    children: 0,
    infants: 0,
    childrenAges: [],
    pricePerPerson: "",
    totalPrice: "",
    currency: "INR",
    inclusions: pkg.inclusions,
    exclusions: pkg.exclusions,
    termsNotes: "",
    termsConditions,
    paymentPolicy: [],
    amendmentPolicy: [],
    travelBenefits: [],
    stops: [],
    itineraries: [],
    tickets: [],
    addOns: [],
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    queryId: null,
    execName: "",
    execEmail: "",
    execDesignation: "",
  };
}

/** Whether the underlying catalog package is currently live on the public
 * site — used only for the staff-preview header's "Offline" banner. */
export async function getCatalogPackageIsActive(slug: string): Promise<boolean> {
  const pkg = await db.packages.findUnique({ where: { slug }, select: { is_active: true } });
  return pkg?.is_active ?? false;
}
