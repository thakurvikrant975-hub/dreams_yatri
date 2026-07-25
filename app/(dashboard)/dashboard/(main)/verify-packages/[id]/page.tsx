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
            },
        }),
        getRejectionReasons(),
    ]);

    // sentAt is only ever set once a package has a linked query (a "blank"
    // package can't be sent — see sendPackageToClient), so this also
    // guarantees pkg.query below.
    if (!pkg || !pkg.sentAt || !pkg.query) notFound();

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
        />
    );
}
