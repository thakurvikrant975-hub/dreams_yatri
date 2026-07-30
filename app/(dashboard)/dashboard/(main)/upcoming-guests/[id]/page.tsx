import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, Phone, Users, Hotel, Car, ExternalLink, PlaneTakeoff } from "lucide-react";
import { db } from "@/app/lib/db";
import { PaymentPill, StatusPill } from "../../package-bookings/pills";
import { ReconfirmButton } from "./ReconfirmButton";

export const metadata: Metadata = {
    title: "Upcoming Guest - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(d);
}

export default async function UpcomingGuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true,
            startDate: true, endDate: true, travellers: true,
            contactEmail: true, contactPhone: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
            travellersList: {
                where: { isLead: true },
                take: 1,
                select: { fullName: true, firstName: true, lastName: true },
            },
            package: { select: { title: true } },
            destination: { select: { name: true } },
            hotelBookings: {
                orderBy: { dayNumber: "asc" },
                select: {
                    dayNumber: true, cityName: true, checkInDate: true, checkOutDate: true,
                    roomType: true, isConfirmed: true, confirmedAt: true,
                    reconfirmedAt: true, reconfirmedByName: true,
                    voucherUrl: true,
                    confirmedBy: { select: { name: true } },
                    hotel: { select: { id: true, name: true, business_phone: true } },
                },
            },
            cabBookings: {
                orderBy: { legNumber: "asc" },
                select: {
                    legNumber: true, fromLocation: true, toLocation: true, transferDate: true,
                    vehicleName: true, cabType: true, isConfirmed: true, confirmedAt: true,
                    reconfirmedAt: true, reconfirmedByName: true,
                    driverName: true, driverPhone: true, vehicleNumber: true,
                    voucherUrl: true,
                    confirmedBy: { select: { name: true } },
                },
            },
        },
    });

    if (!booking) notFound();

    const nowMs = Date.now();
    const daysToTravel = Math.ceil((booking.startDate.getTime() - nowMs) / 86_400_000);
    const lead = booking.travellersList[0];
    const guestName = lead
        ? (lead.fullName || [lead.firstName, lead.lastName].filter(Boolean).join(" "))
        : (booking.user?.name ?? booking.contactEmail ?? "—");

    const confirmedHotels = booking.hotelBookings.filter((h) => h.isConfirmed);
    const confirmedCabs = booking.cabBookings.filter((c) => c.isConfirmed);
    const hotelReconfirmedCount = confirmedHotels.filter((h) => h.reconfirmedAt != null).length;
    const cabReconfirmedCount = confirmedCabs.filter((c) => c.reconfirmedAt != null).length;

    return (
        <div className="flex flex-col gap-5">
            <Link href="/dashboard/upcoming-guests" className="text-sm text-dashboard-neutral hover:text-dashboard-primary cursor-pointer transition-colors">
                ← Back to upcoming guests
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{booking.bookingNumber}</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">{guestName} · {booking.destination?.name ?? booking.package?.title ?? ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={booking.status} />
                    <PaymentPill status={booking.paymentStatus} />
                    <Link
                        href={`/dashboard/package-bookings/${booking.id}`}
                        className="cursor-pointer rounded-md border border-dashboard-base-300 px-3 py-1.5 text-sm text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                    >
                        Full booking →
                    </Link>
                </div>
            </div>

            {/* Travel banner */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-3.5 shadow-lg flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="flex items-center gap-2 text-sm">
                    <PlaneTakeoff className="size-4 text-dashboard-primary shrink-0" />
                    <span className={`font-semibold ${daysToTravel <= 2 ? "text-red-600" : "text-dashboard-base-content"}`}>
                        {daysToTravel <= 0 ? "Travelling today" : `${daysToTravel} day${daysToTravel !== 1 ? "s" : ""} to travel`}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-dashboard-neutral">
                    <CalendarDays className="size-3.5" /> {fmtDate(booking.startDate)} → {fmtDate(booking.endDate)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-dashboard-neutral">
                    <Users className="size-3.5" /> {booking.travellers} traveller{booking.travellers !== 1 ? "s" : ""}
                </div>
                {(booking.contactPhone) && (
                    <a href={`tel:${booking.contactPhone}`} className="flex items-center gap-1.5 text-sm text-dashboard-neutral hover:text-dashboard-primary transition-colors">
                        <Phone className="size-3.5" /> {booking.contactPhone}
                    </a>
                )}
                {(booking.user?.email ?? booking.contactEmail) && (
                    <a href={`mailto:${booking.user?.email ?? booking.contactEmail}`} className="flex items-center gap-1.5 text-sm text-dashboard-neutral hover:text-dashboard-primary transition-colors">
                        <Mail className="size-3.5" /> {booking.user?.email ?? booking.contactEmail}
                    </a>
                )}
            </div>

            {/* Hotels */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Hotel className="size-4 text-dashboard-neutral" />
                    <h2 className="text-sm font-semibold text-dashboard-base-content">
                        Hotels — {hotelReconfirmedCount}/{confirmedHotels.length} reconfirmed with vendor
                    </h2>
                </div>

                {booking.hotelBookings.length === 0 ? (
                    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-6 text-center text-sm text-dashboard-neutral">
                        No hotel legs recorded for this booking.
                    </div>
                ) : (
                    booking.hotelBookings.map((h) => (
                        <div
                            key={h.dayNumber}
                            className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
                                !h.isConfirmed
                                    ? "border-dashboard-base-300 bg-dashboard-base-200/30"
                                    : h.reconfirmedAt != null
                                        ? "border-green-200 bg-green-50/60"
                                        : "border-amber-200 bg-amber-50/60"
                            }`}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="shrink-0 rounded-md bg-dashboard-base-content px-2 py-0.5 text-[11px] font-bold text-dashboard-base-100">
                                        Day {h.dayNumber}
                                    </span>
                                    {h.hotel ? (
                                        <Link
                                            href={`/dashboard/hotels/${h.hotel.id}`}
                                            target="_blank"
                                            className="inline-flex items-center gap-1 text-sm font-semibold text-dashboard-primary hover:underline"
                                        >
                                            {h.hotel.name} <ExternalLink className="size-3" />
                                        </Link>
                                    ) : (
                                        <span className="text-sm font-semibold text-dashboard-base-content">{h.cityName}</span>
                                    )}
                                    {!h.isConfirmed && (
                                        <span className="rounded bg-dashboard-base-300 px-1.5 py-0.5 text-[10px] font-semibold text-dashboard-neutral">Not yet confirmed</span>
                                    )}
                                </div>
                                <p className="text-xs text-dashboard-neutral mt-0.5">
                                    {fmtDate(h.checkInDate)} → {fmtDate(h.checkOutDate)} · {h.roomType}
                                </p>
                                {h.hotel?.business_phone && (
                                    <a href={`tel:${h.hotel.business_phone}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-dashboard-neutral hover:text-dashboard-primary transition-colors">
                                        <Phone className="size-3" /> {h.hotel.business_phone}
                                    </a>
                                )}
                                {h.reconfirmedAt != null && (
                                    <p className="text-[11px] text-green-700 mt-0.5">Reconfirmed by {h.reconfirmedByName ?? "—"} · {fmtDateTime(h.reconfirmedAt)}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {!h.isConfirmed ? (
                                    <Link
                                        href={`/dashboard/verify-hotels/${booking.id}`}
                                        className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-xs font-semibold text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                                    >
                                        Confirm hotel →
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href={`/dashboard/verify-hotels/${booking.id}`}
                                            className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-xs font-semibold text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                                        >
                                            Change hotel
                                        </Link>
                                        <ReconfirmButton
                                            kind="hotel"
                                            bookingId={booking.id}
                                            legNumber={h.dayNumber}
                                            reconfirmed={h.reconfirmedAt != null}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Cabs */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Car className="size-4 text-dashboard-neutral" />
                    <h2 className="text-sm font-semibold text-dashboard-base-content">
                        Cabs — {cabReconfirmedCount}/{confirmedCabs.length} reconfirmed with vendor
                    </h2>
                </div>

                {booking.cabBookings.length === 0 ? (
                    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-6 text-center text-sm text-dashboard-neutral">
                        No cab legs recorded for this booking.
                    </div>
                ) : (
                    booking.cabBookings.map((c) => (
                        <div
                            key={c.legNumber}
                            className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${
                                !c.isConfirmed
                                    ? "border-dashboard-base-300 bg-dashboard-base-200/30"
                                    : c.reconfirmedAt != null
                                        ? "border-green-200 bg-green-50/60"
                                        : "border-amber-200 bg-amber-50/60"
                            }`}
                        >
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="shrink-0 rounded-md bg-dashboard-base-content px-2 py-0.5 text-[11px] font-bold text-dashboard-base-100">
                                        Leg {c.legNumber}
                                    </span>
                                    <span className="text-sm font-semibold text-dashboard-base-content">
                                        {c.fromLocation} → {c.toLocation}
                                    </span>
                                    {!c.isConfirmed && (
                                        <span className="rounded bg-dashboard-base-300 px-1.5 py-0.5 text-[10px] font-semibold text-dashboard-neutral">Not yet confirmed</span>
                                    )}
                                </div>
                                <p className="text-xs text-dashboard-neutral mt-0.5">
                                    {fmtDate(c.transferDate)} · {c.vehicleName ?? c.cabType}
                                </p>
                                {(c.driverName || c.driverPhone) && (
                                    <p className="text-xs text-dashboard-neutral mt-0.5">
                                        {c.driverName ?? "Driver"}{c.vehicleNumber ? ` · ${c.vehicleNumber}` : ""}
                                        {c.driverPhone && (
                                            <a href={`tel:${c.driverPhone}`} className="ml-1.5 inline-flex items-center gap-1 hover:text-dashboard-primary transition-colors">
                                                <Phone className="size-3" /> {c.driverPhone}
                                            </a>
                                        )}
                                    </p>
                                )}
                                {c.reconfirmedAt != null && (
                                    <p className="text-[11px] text-green-700 mt-0.5">Reconfirmed by {c.reconfirmedByName ?? "—"} · {fmtDateTime(c.reconfirmedAt)}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {!c.isConfirmed ? (
                                    <Link
                                        href={`/dashboard/verify-cabs/${booking.id}`}
                                        className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-xs font-semibold text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                                    >
                                        Confirm cab →
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href={`/dashboard/verify-cabs/${booking.id}`}
                                            className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-xs font-semibold text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                                        >
                                            Change cab
                                        </Link>
                                        <ReconfirmButton
                                            kind="cab"
                                            bookingId={booking.id}
                                            legNumber={c.legNumber}
                                            reconfirmed={c.reconfirmedAt != null}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
