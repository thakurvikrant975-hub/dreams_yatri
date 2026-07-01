import type { Metadata } from "next";
import PackageBookingsClient from "./PackageBookingsClient";

export const metadata: Metadata = {
    title: "Package Bookings - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const PAYMENT_STATUSES = ["PENDING", "ADVANCE_PAID", "FULLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED"];
const BOOKING_STATUSES = [
    "UPCOMING", "ONGOING", "COMPLETED", "CANCELLED", "PENDING_REVIEW", "HOTEL_VERIFICATION",
    "HOTEL_CONFIRMED", "CAB_VERIFICATION", "CAB_CONFIRMED", "OPS_REVIEW", "CONFIRMED",
    "REJECTED", "MODIFICATION_REQUESTED",
];

export default async function PackageBookingsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;

    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const paymentStatus = PAYMENT_STATUSES.includes(sp.payment ?? "") ? (sp.payment ?? "") : "";
    const status = BOOKING_STATUSES.includes(sp.status ?? "") ? (sp.status ?? "") : "";

    return (
        <PackageBookingsClient
            page={page}
            limit={limit}
            search={search}
            paymentStatus={paymentStatus}
            status={status}
        />
    );
}
