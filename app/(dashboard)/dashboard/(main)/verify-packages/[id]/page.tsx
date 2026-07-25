import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import { getRejectionReasons } from "../../(marketing)/queries/actions";
import { VerifyPackageDetailClient, type PricingSnapshot } from "./VerifyPackageDetailClient";

export const metadata: Metadata = {
    title: "Package Verification - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function VerifyPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [pkg, rejectionReasons] = await Promise.all([
        db.custom_packages.findUnique({
            where: { id },
            select: {
                id: true, title: true, destination: true, startingPoint: true,
                totalDays: true, totalNights: true, travelDate: true,
                adults: true, children: true, infants: true,
                pricePerPerson: true, totalPrice: true, currency: true,
                marginPercentage: true, gstPercentage: true,
                status: true, builtByName: true, sentAt: true,
                viewedAt: true, viewCount: true, pricingSnapshot: true,
                verified: true, verifiedAt: true, verifiedByName: true,
                rejectedAt: true, rejectedByName: true, rejectionNote: true,
                rejectionReason: { select: { label: true } },
                flightsIncluded: true, flightNotes: true, flightFrom: true, flightTo: true,
                trainIncluded: true, trainNotes: true, trainFrom: true, trainTo: true,
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
                        message: true, groupSize: true,
                    },
                },
                itineraries: { select: { day: true, roomPricingId: true } },
            },
        }),
        getRejectionReasons(),
    ]);

    // sentAt is only ever set once a package has a linked query (a "blank"
    // package can't be sent — see sendPackageToClient), so this also
    // guarantees pkg.query below.
    if (!pkg || !pkg.sentAt || !pkg.query) notFound();

    // Resolve day → hotel id so the frozen pricingSnapshot's hotel lines
    // (which only ever stored a plain hotelName string) can link out to the
    // hotel's dashboard page. Looked up fresh from the live itinerary rather
    // than baked into the snapshot itself, so this works for packages sent
    // before this feature existed too — falls back to plain text if a day's
    // itinerary row was since edited/removed and no longer resolves.
    const roomPricingIds = [...new Set(pkg.itineraries.map((it) => it.roomPricingId).filter((id): id is number => id != null))];
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

    return (
        <VerifyPackageDetailClient
            pkg={{
                id: pkg.id, title: pkg.title, destination: pkg.destination, startingPoint: pkg.startingPoint,
                totalDays: pkg.totalDays, totalNights: pkg.totalNights, travelDate: pkg.travelDate,
                adults: pkg.adults, children: pkg.children, infants: pkg.infants,
                pricePerPerson: pkg.pricePerPerson, totalPrice: pkg.totalPrice, currency: pkg.currency,
                marginPercentage: pkg.marginPercentage, gstPercentage: pkg.gstPercentage,
                status: pkg.status, builtByName: pkg.builtByName, sentAt: pkg.sentAt,
                viewedAt: pkg.viewedAt, viewCount: pkg.viewCount,
                verified: pkg.verified, verifiedAt: pkg.verifiedAt, verifiedByName: pkg.verifiedByName,
                rejectedAt: pkg.rejectedAt, rejectedByName: pkg.rejectedByName, rejectionNote: pkg.rejectionNote,
                rejectionReasonLabel: pkg.rejectionReason?.label ?? null,
                flightsIncluded: pkg.flightsIncluded, flightNotes: pkg.flightNotes, flightFrom: pkg.flightFrom, flightTo: pkg.flightTo,
                trainIncluded: pkg.trainIncluded, trainNotes: pkg.trainNotes, trainFrom: pkg.trainFrom, trainTo: pkg.trainTo,
            }}
            snapshot={pkg.pricingSnapshot as unknown as PricingSnapshot | null}
            tickets={pkg.tickets}
            addOns={pkg.addOns}
            query={pkg.query}
            rejectionReasons={rejectionReasons}
            hotelIdByDay={hotelIdByDay}
        />
    );
}
