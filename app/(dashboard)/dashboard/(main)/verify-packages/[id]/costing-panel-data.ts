// ─────────────────────────────────────────────────────────────────────────────
// Costing panel data.
//
// Everything the costing sidebar needs, in one server call: the package, its
// live-computed pricing snapshot, the rejection reasons and the standard
// inclusion/exclusion lists.
//
// Pulled out of the verify route so the BUILDER route can load it too. There is
// one editor now, at /dashboard/package-builder/[packageId], and whether it
// shows a costing tab depends on who opened it — which means the builder route
// has to be able to assemble costing's data when a reviewer is the one looking.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "@/app/lib/db";
import { getRejectionReasons } from "../../(marketing)/queries/actions";
import { getItinerarySettings } from "../../itinerary-settings/actions";
import { computeBuilderHotelPricing, computeBuilderCabPricing, travellersOf } from "@/app/services/package-pricing.service";
import { splitManualHotelName } from "@/app/services/hotel-name-utils";
import { parseRoomSelections, parseCabSelections } from "@/app/(dashboard)/dashboard/(builder)/package-builder/room-cab-selections";
import type { PricingSnapshot } from "./VerifyPackageDetailClient";
import { applyDiscount } from "@/app/(dashboard)/dashboard/(builder)/package-builder/discount";
import { payingPaxOf } from "@/app/(dashboard)/dashboard/(builder)/package-builder/traveller-ages";

/** Tickets carry a lower margin than hotels and cabs — same split
 * sendPackageToClient applies when it freezes the real snapshot. */
const TICKET_MARGIN_PCT = 5;

export async function loadCostingPanelData(id: string) {

    const [pkg, rejectionReasons, itinerarySettings] = await Promise.all([
        db.custom_packages.findUnique({
            where: { id },
            select: {
                id: true, title: true, destination: true, startingPoint: true,
                totalDays: true, totalNights: true, travelDate: true,
                adults: true, children: true, infants: true,
                childrenAges: true, infantAges: true,
                infantMaxAge: true, childMaxAge: true,
                pricePerPerson: true, totalPrice: true, currency: true,
                marginPercentage: true, gstPercentage: true,
                discountType: true, discountValue: true, discountNote: true,
                hotelSubtotalOverride: true, cabSubtotalOverride: true,
                status: true, builtByName: true, sentAt: true,
                readyAt: true, readyByName: true, readyNote: true,
                viewedAt: true, viewCount: true, pricingSnapshot: true,
                verified: true, verifiedAt: true, verifiedByName: true,
                rejectedAt: true, rejectedByName: true, rejectionNote: true,
                rejectionReason: { select: { label: true } },
                revisionRequestedAt: true, revisionRequestedByName: true, revisionNote: true,
                flightsIncluded: true, flightNotes: true, flightFrom: true, flightTo: true,
                trainIncluded: true, trainNotes: true, trainFrom: true, trainTo: true,
                extraPolicyItems: true, removedInclusions: true, removedExclusions: true,
                tickets: {
                    orderBy: { sortOrder: "asc" },
                    select: { id: true, type: true, provider: true, fromPlace: true, toPlace: true, fare: true, ticketCount: true },
                },
                addOns: {
                    orderBy: { sortOrder: "asc" },
                    select: { id: true, name: true, price: true, quantity: true, day: true },
                },
                query: {
                    select: {
                        id: true, name: true, phone: true, countryCode: true, email: true,
                        message: true, groupSize: true, assignedAt: true,
                    },
                },
                itineraries: {
                    select: {
                        day: true, roomPricingId: true, roomsCount: true, manualExtraBeds: true, extraRooms: true,
                        cabPricingId: true, transportDistanceKm: true, cabQuantity: true, extraCabs: true, transport: true,
                        accommodation: true, manualHotelPricePerNight: true, manualExtraBedRate: true,
                        hotelPriceOverride: true, cabPriceOverride: true,
                    },
                },
            },
        }),
        getRejectionReasons(),
        getItinerarySettings(),
    ]);

    // readyAt is only ever set once a package has been marked ready for
    // review at least once (and, transitively, is only ever set once it has
    // a linked query — see markPackageReady), so this also guarantees
    // pkg.query below. A package still sitting in DRAFT that was never
    // submitted has nothing to review yet.
    // Returns null rather than 404-ing: the builder route calls this for any
    // package a reviewer opens, and a DRAFT that was never submitted simply has
    // nothing to review — the editor still renders, just without a costing tab.
    if (!pkg || !pkg.readyAt || !pkg.query) return null;

    // status === SENT (currently delivered) → show the frozen numbers
    // actually locked in and delivered to the client. Anything else —
    // including a package that was sent once but has since been pulled back
    // for revision and resubmitted — needs a LIVE preview instead: sentAt/
    // pricingSnapshot are deliberately never cleared on resubmission (kept as
    // "was this ever sent" history, see requestPackageRevision), so checking
    // sentAt alone here would keep showing the STALE snapshot from the
    // previous send cycle throughout the new review, even though the price
    // may have been corrected or the itinerary changed since. Live-compute
    // the same way sendPackageToClient itself will, so costing reviews the
    // exact numbers that'll be locked in whenever the exec next sends it,
    // including any hotel/cab correction already saved via
    // updatePackagePricing.
    let snapshot: PricingSnapshot | null;
    if (pkg.status === "SENT" && pkg.pricingSnapshot) {
        snapshot = pkg.pricingSnapshot as unknown as PricingSnapshot;
    } else {
        const travelDateIso = pkg.travelDate ? pkg.travelDate.toISOString().slice(0, 10) : null;
        const [hotelPricing, cabPricing] = await Promise.all([
            computeBuilderHotelPricing({
                travelDate: travelDateIso, ...travellersOf(pkg),
                days: pkg.itineraries.map((it) => ({
                    day: it.day, roomPricingId: it.roomPricingId, roomsCount: it.roomsCount,
                    manualExtraBeds: it.manualExtraBeds,
                    extraRooms: parseRoomSelections(it.extraRooms),
                    manualHotelPricePerNight: it.manualHotelPricePerNight,
                    manualExtraBedRate: it.manualExtraBedRate,
                    hotelPriceOverride: it.hotelPriceOverride,
                    ...splitManualHotelName(it.accommodation),
                })),
            }),
            computeBuilderCabPricing({
                travelDate: travelDateIso,
                days: pkg.itineraries.map((it) => ({
                    day: it.day, cabPricingId: it.cabPricingId, transportDistanceKm: it.transportDistanceKm,
                    cabQuantity: it.cabQuantity, extraCabs: parseCabSelections(it.extraCabs),
                    cabPriceOverride: it.cabPriceOverride, transport: it.transport,
                })),
            }),
        ]);

        const hotelSubtotal = pkg.hotelSubtotalOverride ?? hotelPricing.hotelSubtotal;
        const cabSubtotal = pkg.cabSubtotalOverride ?? cabPricing.cabSubtotal;
        const ticketsSubtotal = pkg.tickets.reduce((sum, t) => sum + (t.fare ?? 0), 0);
        const addonsSubtotal = pkg.addOns.reduce((sum, a) => sum + (a.price ?? 0) * (a.quantity || 1), 0);
        const hotelCabBase = hotelSubtotal + cabSubtotal;
        const baseCost = hotelCabBase + addonsSubtotal + ticketsSubtotal;
        const hotelCabMarginAmount = Math.round((hotelCabBase + addonsSubtotal) * pkg.marginPercentage / 100);
        const ticketsMarginAmount = Math.round(ticketsSubtotal * TICKET_MARGIN_PCT / 100);
        const marginAmount = hotelCabMarginAmount + ticketsMarginAmount;
        const taxable = baseCost + marginAmount;
        const gstAmount = Math.round(taxable * pkg.gstPercentage / 100);
        const listPrice = taxable + gstAmount;
        // Same helper, same order as everywhere else — see discount.ts.
        const discount = applyDiscount(listPrice, { type: pkg.discountType, value: pkg.discountValue });
        const finalPrice = discount.finalPrice;
        // Same divisor the builder quotes with — see payingPaxOf.
        const totalPax = payingPaxOf(pkg);
        const pricePerPerson = totalPax > 0 ? Math.round(finalPrice / totalPax) : finalPrice;

        snapshot = {
            lockedAt: new Date().toISOString(),
            currency: pkg.currency,
            hotel: { subtotal: hotelSubtotal, nightsCounted: hotelPricing.nightsCounted, lines: hotelPricing.days, overridden: pkg.hotelSubtotalOverride != null },
            cab: { subtotal: cabSubtotal, daysCounted: cabPricing.daysCounted, lines: cabPricing.days, overridden: pkg.cabSubtotalOverride != null },
            tickets: {
                subtotal: ticketsSubtotal,
                lines: pkg.tickets.map((t) => ({ type: t.type, provider: t.provider ?? "", fromPlace: t.fromPlace ?? "", toPlace: t.toPlace ?? "", fare: t.fare, ticketCount: t.ticketCount })),
            },
            addOns: {
                subtotal: addonsSubtotal,
                lines: pkg.addOns.map((a) => ({ name: a.name, price: a.price, quantity: a.quantity, day: a.day })),
            },
            baseCost,
            marginPercentage: pkg.marginPercentage,
            hotelCabMarginAmount,
            ticketsMarginAmount,
            marginAmount,
            taxable,
            gstPercentage: pkg.gstPercentage,
            gstAmount,
            listPrice,
            discountType: pkg.discountType,
            discountValue: pkg.discountValue,
            discountAmount: discount.amount,
            finalPrice,
            pricePerPerson,
            displayedTotalPrice: pkg.totalPrice ?? null,
            displayedPricePerPerson: pkg.pricePerPerson ?? null,
        };
    }

    // Resolve day → hotel id so the hotel lines (live-computed or frozen
    // snapshot alike) can link out to the hotel's dashboard page — see
    // VerifyPackageDetailClient. Looked up fresh from the live itinerary so
    // it works regardless of which pricing branch above ran.
    const roomPricingIds = [...new Set(pkg.itineraries.map((it) => it.roomPricingId).filter((v): v is number => v != null))];
    const roomPricings = roomPricingIds.length > 0
        ? await db.hotel_room_pricing.findMany({ where: { id: { in: roomPricingIds } }, select: { id: true, hotel_id: true } })
        : [];
    const hotelIdByRoomPricingId = new Map(roomPricings.map((rp) => [rp.id, rp.hotel_id]));
    const hotelIdByDay: Record<number, number> = {};
    for (const it of pkg.itineraries) {
        if (it.roomPricingId == null) continue;
        const hotelId = hotelIdByRoomPricingId.get(it.roomPricingId);
        if (hotelId != null) hotelIdByDay[it.day] = hotelId;
    }

    // Effective inclusions/exclusions this reviewer is looking at right now —
    // live standard defaults + this package's own additions, minus anything
    // already vetoed in an earlier review pass. See
    // updatePackageInclusionsExclusions, which diffs a re-submitted list of
    // this shape back against the live standard lists.
    const extraPolicy = pkg.extraPolicyItems as unknown as { inclusions?: string[]; exclusions?: string[] } | null;
    const inclusions = [...itinerarySettings.inclusions, ...(extraPolicy?.inclusions ?? [])]
        .filter((i) => !pkg.removedInclusions.includes(i));
    const exclusions = [...itinerarySettings.exclusions, ...(extraPolicy?.exclusions ?? [])]
        .filter((e) => !pkg.removedExclusions.includes(e));

    return { pkg, snapshot, rejectionReasons, hotelIdByDay, inclusions, exclusions };
}

export type CostingPanelData = NonNullable<Awaited<ReturnType<typeof loadCostingPanelData>>>;
