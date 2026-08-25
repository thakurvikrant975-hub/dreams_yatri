"use server";

// Public, no-auth data access for a client-facing itinerary link — deliberately
// separate from the dashboard's `getQueryDetail` (package-builder/action.ts),
// which returns internal query/lead data never meant to be reachable without
// a session. Only ever returns a package once it has actually been sent —
// a draft/in-progress itinerary is never visible via this path, even to
// someone who knows the id.

import { db } from "@/app/lib/db";
import { getDestinationCoverImage } from "@/app/(dashboard)/dashboard/(builder)/package-builder/action";
import { parseRoomSelections, parseCabSelections } from "@/app/(dashboard)/dashboard/(builder)/package-builder/room-cab-selections";
import { discountLabel } from "@/app/(dashboard)/dashboard/(builder)/package-builder/discount";
import { getItinerarySettings } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";
import { getStayOptionsForDocument } from "@/app/(dashboard)/dashboard/(builder)/package-builder/stay-options.actions";
// The v2 document's shape, because the v2 document is what this page now
// renders — the same component the builder previews and the PDF captures.
// Type-only, so nothing from that client module is pulled into this server
// file at runtime.
import type { PreviewData } from "@/app/(dashboard)/dashboard/(builder)/package-builder-v2/[packageId]/ItineraryDocument";
import type { ThemeOverrides } from "@/app/(dashboard)/dashboard/(builder)/package-builder-v2/[packageId]/doc-theme-data";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";

/** Mirrors ExtraPolicyItems in package-builder/action.ts — can't import it
 * directly since that's a "use server" file (only async function exports
 * allowed there). Per-package additions to the six standard lists below,
 * e.g. a Sales Executive adding "Complimentary airport pickup" just for
 * this client — merged in here so the client actually sees them. */
type ExtraPolicyItems = {
  inclusions: string[]; exclusions: string[]; termsConditions: string[];
  paymentPolicy: string[]; amendmentPolicy: string[]; travelBenefits: string[];
};
function extraItems(raw: unknown, key: keyof ExtraPolicyItems): string[] {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ExtraPolicyItems, unknown>>;
  const v = obj[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** The concession as the document wants it: what the package listed at, how
 * much came off, and the chip's wording.
 *
 * Prefers the frozen snapshot — this page is the client's copy of what was
 * quoted, and the snapshot is the record of exactly that, immune to anything
 * edited on the row afterwards. Falls back to the row for packages sent before
 * the snapshot carried a discount, where listPrice has to be reconstructed by
 * adding the concession back onto what they were charged. */
function resolveSharedDiscount(
  rawSnapshot: unknown,
  rowType: "FLAT" | "PERCENT" | null,
  rowValue: number | null,
): { originalPrice: number; amount: number; label: string } | null {
  const snap = (rawSnapshot && typeof rawSnapshot === "object" ? rawSnapshot : null) as {
    listPrice?: number; finalPrice?: number;
    discountType?: "FLAT" | "PERCENT" | null; discountValue?: number | null; discountAmount?: number;
  } | null;

  if (snap?.discountAmount != null && snap.discountAmount > 0) {
    return {
      originalPrice: snap.listPrice ?? (snap.finalPrice ?? 0) + snap.discountAmount,
      amount: snap.discountAmount,
      label: discountLabel({ type: snap.discountType, value: snap.discountValue }, snap.discountAmount),
    };
  }

  // Pre-snapshot fallback. Only the percentage can be reconstructed exactly
  // here (it is a share of the list price, which we don't have); a flat amount
  // is its own answer.
  if (!rowType || rowValue == null || rowValue <= 0) return null;
  const paid = typeof snap?.finalPrice === "number" ? snap.finalPrice : null;
  if (paid == null) return null;
  const amount = rowType === "FLAT" ? rowValue : Math.round((paid / (100 - rowValue)) * rowValue);
  if (amount <= 0) return null;
  return {
    originalPrice: paid + amount,
    amount,
    label: discountLabel({ type: rowType, value: rowValue }, amount),
  };
}

/** The up-front amount, and the words for it.
 *
 * Reads computePaymentSchedule so the page can never disagree with the payment
 * step. Three outcomes matter to a client, and they are genuinely different
 * sentences:
 *
 *   DEPOSIT_ALLOWED          — pay a share now, the rest before travel
 *   FULL_NEAR_TRAVEL         — travel is inside the balance window, so it is
 *                              all due now; offering a deposit would be a lie
 *   FULL_DEPOSIT_COVERS_TOTAL— the minimum is at or above the trip's price, so
 *                              a "deposit" is just the whole thing
 *
 * Null when there is no price or no travel date yet — a package still being
 * built has nothing honest to say here.
 */
function depositMessage(
  totalPrice: number | null | undefined,
  travelDate: Date | null | undefined,
): { amount: number; isFull: boolean; balance: number; balanceDueDate: string | null } | null {
  if (!totalPrice || totalPrice <= 0 || !travelDate) return null;
  try {
    const s = computePaymentSchedule({
      totalPaise: Math.round(totalPrice * 100),
      travelDate: travelDate.toISOString().slice(0, 10),
    });
    return {
      amount: Math.round(s.depositPaise / 100),
      isFull: s.plan === "FULL",
      balance: Math.round(s.balancePaise / 100),
      balanceDueDate: s.balanceDueDate,
    };
  } catch {
    // A travel date the engine rejects must not take the whole page down.
    return null;
  }
}

export async function getSharedPackage(packageId: string): Promise<PreviewData | null> {
  const pkg = await db.custom_packages.findFirst({
    where: { id: packageId, status: "SENT" },
    select: {
      queryId: true,
      // The package's own document template and colour/font tweaks. Without
      // these the client's page falls back to the house template and renders
      // a different-looking document than the PDF the exec was designing —
      // the whole point of publishing the template is that the two match.
      template: true, themeOverrides: true,
      title: true, description: true, coverImage: true, coverImagePosition: true, destination: true, startingPoint: true,
      totalDays: true, totalNights: true, travelDate: true, adults: true, children: true, infants: true,
      childrenAges: true,
      pricePerPerson: true, totalPrice: true, currency: true,
      discountType: true, discountValue: true, pricingSnapshot: true,
      inclusions: true, exclusions: true, removedInclusions: true, removedExclusions: true, termsNotes: true,
      termsConditions: true, paymentPolicy: true, amendmentPolicy: true, travelBenefits: true,
      extraPolicyItems: true,
      stops: { orderBy: { sortOrder: "asc" }, select: { name: true, nights: true, image: true } },
      addOns: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, price: true, quantity: true, notes: true, day: true },
      },
      tickets: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, type: true, provider: true, ticketNumber: true,
          fromPlace: true, toPlace: true, travelDate: true,
          departureTime: true, arrivalTime: true, durationText: true,
          adults: true, children: true, infants: true,
          ticketCount: true, fare: true, notes: true,
        },
      },
      itineraries: {
        orderBy: { day: "asc" },
        select: {
          day: true, title: true, description: true, meals: true,
          accommodation: true, accommodationPhoto: true, accommodationRoomPhotos: true,
          accommodationLocation: true, accommodationRoomSpecs: true, accommodationStarRating: true,
          accommodationRoomCapacity: true,
          // Needed by occupancyText — without the real caps it falls back to
          // base beds alone and over-reports the room count to the client.
          accommodationMaxAdults: true, accommodationMaxChildren: true, accommodationExtraBedCapacity: true,
          roomsCount: true, extraRooms: true,
          notesType: true,
          notesTitle: true,
          hotelCheckIn: true, hotelCheckOut: true, hotelMealPlan: true,
          transport: true, transportPhoto: true, transportVehicleType: true, transportSeats: true,
          transportPickup: true, transportDrop: true, transportDistanceKm: true, transportTravelTime: true, notes: true,
          cabQuantity: true, extraCabs: true,
          activities: {
            orderBy: { sortOrder: "asc" },
            select: { title: true, description: true, photo: true, photos: true, photoLabels: true },
          },
        },
      },
      query: { select: { assignedTo: true, name: true, phone: true, countryCode: true, email: true } },
    },
  });
  // A package only ever reaches SENT once it has a linked query (a "blank"
  // package with no lead can't be sent — see sendPackageToClient), so this
  // also guarantees pkg.query below.
  if (!pkg || !pkg.query) return null;

  const exec = pkg.query.assignedTo
    ? await db.teamMember.findUnique({
        where: { id: pkg.query.assignedTo },
        select: { name: true, email: true, designation: true },
      })
    : null;

  // Real destination photos for the "Places You Gonna Visit" strip — same
  // catalog lookup the builder's own cover-photo suggestion uses, resolved
  // here (server-side) so the client-facing link shows real photos too, not
  // just the internal builder preview.
  const stopNames = [...new Set(pkg.stops.map((s) => s.name.trim()).filter(Boolean))];
  const [stopImageEntries, settings, stayOptions] = await Promise.all([
    Promise.all(stopNames.map(async (name) => [name, await getDestinationCoverImage(name)] as const)),
    // Header/footer contact block, the disclaimer, the admin's extra policy
    // blocks, and the house template this package's own choice layers over.
    // Unauthenticated on purpose — getItinerarySettings has no session gate,
    // and everything read from it here is already printed on the PDF the
    // client is sent anyway.
    getItinerarySettings(),
    // The stay standards this trip is quoted at, for the columns in each stay
    // block. Never throws the page: a package with none simply renders the
    // original single-hotel layout.
    getStayOptionsForDocument(packageId)
      // Only standards that are actually filled reach the client. One with no
      // hotel on any night is an unfinished thought, not an option — quoting
      // it would print an empty column and an "On request" price the exec
      // never meant to offer.
      .then((cats) => cats.filter((c) => Object.values(c.byDay).some((cell) => cell.hotel?.trim())))
      .catch(() => []),
  ]);
  const stopImages = Object.fromEntries(stopImageEntries);

  return {
    // Template first, then the house default underneath it — resolveDocTheme
    // in the document itself validates both and falls back to the house
    // template if either id no longer exists.
    template:        pkg.template,
    themeOverrides:  (pkg.themeOverrides as ThemeOverrides | null) ?? null,
    companySettings: {
      phone:           settings.companyPhone,
      email:           settings.companyEmail,
      address:         settings.companyAddress,
      description:     settings.companyDescription,
      disclaimer:      settings.documentDisclaimer,
      defaultTemplate: settings.defaultTemplate,
      themeOverrides:  settings.themeOverrides,
    },
    // The admin's extra policy blocks. Unlike inclusions/exclusions these are
    // not frozen onto the package row, so they read live — same as they do in
    // the builder's own preview and in the PDF.
    customPolicySections: settings.customPolicySections,
    stayOptions,
    title:           pkg.title,
    description:     pkg.description ?? "",
    coverImage:      pkg.coverImage ?? "",
    coverImagePosition: pkg.coverImagePosition,
    destination:     pkg.destination,
    startingPoint:   pkg.startingPoint ?? "",
    totalDays:       pkg.totalDays,
    totalNights:     pkg.totalNights,
    travelDate:      pkg.travelDate ? pkg.travelDate.toISOString().slice(0, 10) : "",
    adults:          pkg.adults,
    children:        pkg.children,
    infants:         pkg.infants,
    // Without these the client's own page divided the total by every head
    // including a toddler, and quoted a per-person figure nobody would pay.
    childrenAges:    pkg.childrenAges ?? [],
    pricePerPerson:  pkg.pricePerPerson?.toString() ?? "",
    totalPrice:      pkg.totalPrice?.toString() ?? "",
    // What it takes to hold the booking, computed by the same engine that
    // charges for it. Sent from the server rather than worked out in the
    // browser on purpose: the floor and the percentage can be overridden by
    // environment, and a client-side copy would quietly show one number while
    // checkout took another — on a page whose whole job is asking for money.
    bookingDeposit:  depositMessage(pkg.totalPrice, pkg.travelDate),
    currency:        pkg.currency,
    // The concession, for the document's saving badge. Read from the frozen
    // snapshot rather than recomputed: this page is the client's copy of what
    // was quoted, and the snapshot is the record of exactly that. Falls back to
    // the row's own discount fields for packages sent before the snapshot
    // carried them, and is simply absent when neither has one — which is most
    // packages. `totalPrice` above is already net of it either way.
    discount:        resolveSharedDiscount(pkg.pricingSnapshot, pkg.discountType, pkg.discountValue),
    // Drops anything costing vetoed during pre-send review — see
    // updatePackageInclusionsExclusions (verify-packages/actions.ts).
    inclusions:      [...pkg.inclusions, ...extraItems(pkg.extraPolicyItems, "inclusions")].filter((i) => !pkg.removedInclusions.includes(i)),
    exclusions:      [...pkg.exclusions, ...extraItems(pkg.extraPolicyItems, "exclusions")].filter((e) => !pkg.removedExclusions.includes(e)),
    termsNotes:      pkg.termsNotes ?? "",
    termsConditions: [...pkg.termsConditions, ...extraItems(pkg.extraPolicyItems, "termsConditions")],
    paymentPolicy:   [...pkg.paymentPolicy, ...extraItems(pkg.extraPolicyItems, "paymentPolicy")],
    amendmentPolicy: [...pkg.amendmentPolicy, ...extraItems(pkg.extraPolicyItems, "amendmentPolicy")],
    travelBenefits:  [...pkg.travelBenefits, ...extraItems(pkg.extraPolicyItems, "travelBenefits")],
    stops:           pkg.stops.map((s) => ({ ...s, image: s.image ?? undefined })),
    stopImages,
    addOns: pkg.addOns.map((a) => ({
      id:       a.id,
      name:     a.name,
      price:    a.price ?? null,
      quantity: a.quantity,
      notes:    a.notes ?? "",
      day:      a.day ?? null,
    })),
    tickets: pkg.tickets.map((t) => ({
      id:            t.id,
      type:          t.type,
      provider:      t.provider ?? "",
      ticketNumber:  t.ticketNumber ?? "",
      fromPlace:     t.fromPlace ?? "",
      toPlace:       t.toPlace ?? "",
      travelDate:    t.travelDate ? t.travelDate.toISOString().slice(0, 10) : "",
      departureTime: t.departureTime ?? "",
      arrivalTime:   t.arrivalTime ?? "",
      durationText:  t.durationText ?? "",
      adults:        t.adults,
      children:      t.children,
      infants:       t.infants,
      ticketCount:   t.ticketCount,
      fare:          t.fare ?? null,
      notes:         t.notes ?? "",
    })),
    itineraries: pkg.itineraries.map((it) => ({
      day:                       it.day,
      title:                     it.title,
      description:               it.description ?? "",
      activities: it.activities.map((a) => ({
        title:       a.title,
        description: a.description ?? "",
        photo:       a.photo ?? "",
        photos:      a.photos,
        photoLabels: a.photoLabels,
      })),
      meals:                     it.meals,
      accommodation:             it.accommodation ?? "",
      accommodationPhoto:        it.accommodationPhoto ?? "",
      accommodationRoomPhotos:   it.accommodationRoomPhotos,
      accommodationLocation:     it.accommodationLocation ?? "",
      accommodationRoomSpecs:    it.accommodationRoomSpecs ?? "",
      accommodationStarRating:   it.accommodationStarRating ?? "",
      notesType:                 it.notesType ?? null,
      notesTitle:                it.notesTitle ?? null,
      accommodationRoomCapacity: it.accommodationRoomCapacity ?? null,
      accommodationMaxAdults:    it.accommodationMaxAdults ?? null,
      accommodationMaxChildren:  it.accommodationMaxChildren ?? null,
      accommodationExtraBedCapacity: it.accommodationExtraBedCapacity ?? null,
      roomPricingId:             null,
      roomsCount:                it.roomsCount ?? null,
      extraRooms:                parseRoomSelections(it.extraRooms),
      hotelCheckIn:              it.hotelCheckIn ?? "",
      hotelCheckOut:             it.hotelCheckOut ?? "",
      hotelMealPlan:             it.hotelMealPlan ?? "",
      // Internal-only fulfillment state — the client-facing page never
      // shows a pending day (nothing gets sent until every day is filled).
      hotelPending:              false,
      hotelPendingNote:          "",
      manualHotelPricePerNight:  null,
      transport:                 it.transport ?? "",
      transportPhoto:            it.transportPhoto ?? "",
      transportVehicleType:      it.transportVehicleType ?? "",
      transportSeats:            it.transportSeats ?? null,
      transportPickup:           it.transportPickup ?? "",
      transportPickupLat:        null,
      transportPickupLng:        null,
      transportDropLat:          null,
      transportDropLng:          null,
      transportDrop:             it.transportDrop ?? "",
      transportDistanceKm:       it.transportDistanceKm ?? null,
      transportTravelTime:       it.transportTravelTime ?? "",
      cabPricingId:              null,
      cabQuantity:               it.cabQuantity ?? null,
      extraCabs:                 parseCabSelections(it.extraCabs),
      notes:                     it.notes ?? "",
    })),
    clientName:      pkg.query.name,
    clientPhone:     pkg.query.phone ? `${pkg.query.countryCode} ${pkg.query.phone}` : "",
    clientEmail:     pkg.query.email ?? "",
    queryId:         pkg.queryId,
    execName:        exec?.name ?? "",
    execEmail:       exec?.email ?? "",
    execDesignation: exec?.designation ?? "",
  };
}

/** Fire-and-forget — records that the client actually opened the link. */
export async function markPackageViewed(packageId: string): Promise<void> {
  await db.custom_packages.update({
    where: { id: packageId },
    data: { viewCount: { increment: 1 }, viewedAt: new Date() },
  }).catch(() => {});
}
