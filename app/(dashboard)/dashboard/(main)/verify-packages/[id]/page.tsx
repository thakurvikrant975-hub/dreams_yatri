import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import { getRejectionReasons } from "../../(marketing)/queries/actions";
import { getItinerarySettings } from "../../itinerary-settings/actions";
import { computeBuilderHotelPricing, computeBuilderCabPricing } from "@/app/services/package-pricing.service";
import { splitManualHotelName } from "@/app/services/hotel-name-utils";
import { parseRoomSelections, parseCabSelections } from "@/app/(dashboard)/dashboard/(builder)/package-builder/room-cab-selections";
import { VerifyPackageDetailClient, type PricingSnapshot } from "./VerifyPackageDetailClient";

export const metadata: Metadata = {
    title: "Package Verification - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const TICKET_MARGIN_PCT = 5;

export default async function VerifyPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [pkg, rejectionReasons, itinerarySettings] = await Promise.all([
        db.custom_packages.findUnique({
            where: { id },
            select: {
                id: true, title: true, destination: true, startingPoint: true,
                totalDays: true, totalNights: true, travelDate: true,
                adults: true, children: true, infants: true,
                childrenAges: true, infantAges: true,
                pricePerPerson: true, totalPrice: true, currency: true,
                marginPercentage: true, gstPercentage: true,
                hotelSubtotalOverride: true, cabSubtotalOverride: true,
                status: true, builtByName: true, sentAt: true,
                readyAt: true, readyByName: true,
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
                        cabPricingId: true, transportDistanceKm: true, cabQuantity: true, extraCabs: true,
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
    if (!pkg || !pkg.readyAt || !pkg.query) notFound();

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
                travelDate: travelDateIso, adults: pkg.adults, children: pkg.children,
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
                    cabPriceOverride: it.cabPriceOverride,
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
        const finalPrice = taxable + gstAmount;
        const totalPax = pkg.adults + pkg.children;
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

    return (
        <VerifyPackageDetailClient
            pkg={{
                id: pkg.id, title: pkg.title, destination: pkg.destination, startingPoint: pkg.startingPoint,
                totalDays: pkg.totalDays, totalNights: pkg.totalNights, travelDate: pkg.travelDate,
                adults: pkg.adults, children: pkg.children, infants: pkg.infants,
                childrenAges: pkg.childrenAges, infantAges: pkg.infantAges,
                pricePerPerson: pkg.pricePerPerson, totalPrice: pkg.totalPrice, currency: pkg.currency,
                marginPercentage: pkg.marginPercentage, gstPercentage: pkg.gstPercentage,
                status: pkg.status, builtByName: pkg.builtByName, sentAt: pkg.sentAt,
                readyAt: pkg.readyAt, readyByName: pkg.readyByName,
                viewedAt: pkg.viewedAt, viewCount: pkg.viewCount,
                verified: pkg.verified, verifiedAt: pkg.verifiedAt, verifiedByName: pkg.verifiedByName,
                rejectedAt: pkg.rejectedAt, rejectedByName: pkg.rejectedByName, rejectionNote: pkg.rejectionNote,
                rejectionReasonLabel: pkg.rejectionReason?.label ?? null,
                revisionRequestedAt: pkg.revisionRequestedAt, revisionRequestedByName: pkg.revisionRequestedByName, revisionNote: pkg.revisionNote,
                flightsIncluded: pkg.flightsIncluded, flightNotes: pkg.flightNotes, flightFrom: pkg.flightFrom, flightTo: pkg.flightTo,
                trainIncluded: pkg.trainIncluded, trainNotes: pkg.trainNotes, trainFrom: pkg.trainFrom, trainTo: pkg.trainTo,
            }}
            snapshot={snapshot}
            tickets={pkg.tickets}
            addOns={pkg.addOns}
            query={pkg.query}
            rejectionReasons={rejectionReasons}
            hotelIdByDay={hotelIdByDay}
            inclusions={inclusions}
            exclusions={exclusions}
        />
    );
}
