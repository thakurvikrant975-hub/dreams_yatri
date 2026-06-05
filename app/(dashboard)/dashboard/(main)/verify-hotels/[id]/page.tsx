import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import { PaymentPill, StatusPill } from "../../package-bookings/pills";
import HotelConfirmPanel from "./HotelConfirmPanel";

export const metadata: Metadata = {
    title: "Hotel Verification - Dashboard",
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
            <div className="border-b border-dashboard-base-300 px-5 py-3">
                <h2 className="text-sm font-semibold text-dashboard-base-content">{title}</h2>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-dashboard-neutral">{label}</dt>
            <dd className="mt-0.5 text-sm text-dashboard-base-content">{value ?? "—"}</dd>
        </div>
    );
}

export default async function VerifyHotelDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [booking, allHotels] = await Promise.all([
        db.booking.findUnique({
            where: { id },
            select: {
                id: true, bookingNumber: true, status: true, paymentStatus: true,
                startDate: true, endDate: true, duration: true, travellers: true, createdAt: true,
                totalAmount_paise: true, contactEmail: true, contactPhone: true,
                destinationId: true,
                user: { select: { name: true, email: true } },
                package: { select: { title: true } },
                destination: { select: { name: true } },
                hotelBookings: {
                    orderBy: { dayNumber: "asc" },
                    select: {
                        id: true, dayNumber: true, cityName: true,
                        checkInDate: true, checkOutDate: true,
                        hotelId: true, roomType: true, roomsCount: true,
                        ratePerRoom: true, totalCost: true,
                        isConfirmed: true, confirmedAt: true, notes: true,
                        hotel: { select: { id: true, name: true, category: true, city: true } },
                        confirmedBy: { select: { name: true } },
                    },
                },
            },
        }),
        db.hotels.findMany({
            where: { is_active: true },
            select: { id: true, name: true, category: true, city: true, destination_id: true },
            orderBy: { name: "asc" },
            take: 300,
        }),
    ]);

    if (!booking) notFound();

    const destinationHotels = allHotels.filter((h) => h.destination_id === booking.destinationId);
    const confirmedCount = booking.hotelBookings.filter((h) => h.isConfirmed).length;
    const totalCount = booking.hotelBookings.length;
    const progressPct = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

    return (
        <div className="flex flex-col gap-5">
            <Link href="/dashboard/verify-hotels" className="text-sm text-dashboard-neutral hover:text-dashboard-primary">
                ← Back to verify hotels
            </Link>

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{booking.bookingNumber}</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">Booked on {fmtDateTime(booking.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={booking.status} />
                    <PaymentPill status={booking.paymentStatus} />
                    <Link
                        href={`/dashboard/package-bookings/${booking.id}`}
                        className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-sm text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                    >
                        Full booking →
                    </Link>
                </div>
            </div>

            {/* Progress bar */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dashboard-base-content">Hotel Confirmation Progress</span>
                    <span className="text-sm text-dashboard-neutral">
                        {confirmedCount} of {totalCount} stay{totalCount !== 1 ? "s" : ""} confirmed
                    </span>
                </div>
                <div className="h-2 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div
                        className={`h-2 rounded-full transition-all ${progressPct === 100 ? "bg-green-500" : "bg-dashboard-primary"}`}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
                {progressPct === 100 && (
                    <p className="mt-1.5 text-xs text-green-600 font-medium">All hotel stays confirmed. Booking will be moved to Hotel Confirmed.</p>
                )}
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                {/* Main column */}
                <div className="lg:col-span-2 flex flex-col gap-5">
                    <Section title={`Hotel Requirements — ${totalCount} stay${totalCount !== 1 ? "s" : ""}`}>
                        {totalCount === 0 ? (
                            <p className="text-sm text-dashboard-neutral">No hotel bookings found for this trip.</p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {booking.hotelBookings.map((bh) => (
                                    <div
                                        key={bh.id}
                                        className={`rounded-lg border p-4 ${
                                            bh.isConfirmed
                                                ? "border-green-200 bg-green-50/40"
                                                : "border-dashboard-base-300"
                                        }`}
                                    >
                                        {/* Row header */}
                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <span className="rounded bg-dashboard-primary/10 px-2 py-0.5 text-[11px] font-semibold text-dashboard-primary">
                                                Day {bh.dayNumber}
                                            </span>
                                            <span className="text-sm font-semibold text-dashboard-base-content">{bh.cityName}</span>
                                            <span className="text-sm text-dashboard-neutral">
                                                {fmtDate(bh.checkInDate)} → {fmtDate(bh.checkOutDate)}
                                            </span>
                                            {bh.isConfirmed ? (
                                                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                                                    ✓ Confirmed
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                                                    Pending
                                                </span>
                                            )}
                                        </div>

                                        {/* Hotel details grid */}
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 mb-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Hotel</div>
                                                <div className="text-sm font-medium text-dashboard-base-content">{bh.hotel.name}</div>
                                                {bh.hotel.city && (
                                                    <div className="text-xs text-dashboard-neutral">{bh.hotel.city}</div>
                                                )}
                                                {bh.hotel.category && (
                                                    <div className="text-xs text-dashboard-neutral">{bh.hotel.category}</div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Room type</div>
                                                <div className="text-sm text-dashboard-base-content">{bh.roomType}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Rooms</div>
                                                <div className="text-sm text-dashboard-base-content">{bh.roomsCount}</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Rate / room</div>
                                                <div className="text-sm text-dashboard-base-content">
                                                    ₹{Number(bh.ratePerRoom).toLocaleString("en-IN")}
                                                </div>
                                                <div className="text-xs text-dashboard-neutral">
                                                    Total ₹{Number(bh.totalCost).toLocaleString("en-IN")}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Confirmed info */}
                                        {bh.isConfirmed && (
                                            <div className="rounded-md bg-green-100/60 px-3 py-2 text-xs text-green-700">
                                                Confirmed by <span className="font-medium">{bh.confirmedBy?.name ?? "—"}</span>
                                                {" · "}{fmtDateTime(bh.confirmedAt)}
                                                {bh.notes && <span className="block mt-0.5 text-green-800">Note: {bh.notes}</span>}
                                            </div>
                                        )}

                                        {/* Confirm form */}
                                        {!bh.isConfirmed && (
                                            <div className="mt-3 border-t border-dashboard-base-300/60 pt-3">
                                                <HotelConfirmPanel
                                                    bookingHotelId={bh.id}
                                                    currentHotelId={bh.hotelId}
                                                    destinationHotels={destinationHotels}
                                                    allHotels={allHotels}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>
                </div>

                {/* Sidebar */}
                <div className="flex flex-col gap-5">
                    <Section title="Booking Info">
                        <dl className="flex flex-col gap-3">
                            <Field label="Customer" value={booking.user?.name} />
                            <Field label="Contact email" value={booking.contactEmail ?? booking.user?.email} />
                            <Field label="Contact phone" value={booking.contactPhone} />
                            <Field label="Package" value={booking.package?.title} />
                            <Field label="Destination" value={booking.destination?.name} />
                            <Field
                                label="Travel dates"
                                value={`${fmtDate(booking.startDate)} – ${fmtDate(booking.endDate)}`}
                            />
                            <Field label="Duration" value={`${booking.duration} day${booking.duration !== 1 ? "s" : ""}`} />
                            <Field label="Travellers" value={booking.travellers} />
                            <Field label="Total amount" value={formatPaise(booking.totalAmount_paise)} />
                        </dl>
                    </Section>

                    <Section title="Hotel Summary">
                        <div className="flex flex-col gap-2">
                            {booking.hotelBookings.map((bh) => (
                                <div key={bh.id} className="flex items-center justify-between text-sm">
                                    <div>
                                        <span className="text-dashboard-neutral">Day {bh.dayNumber}</span>
                                        <span className="mx-1.5 text-dashboard-base-300">·</span>
                                        <span className="text-dashboard-base-content">{bh.hotel.name}</span>
                                    </div>
                                    <span
                                        className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                                            bh.isConfirmed
                                                ? "bg-green-100 text-green-700"
                                                : "bg-amber-100 text-amber-700"
                                        }`}
                                    >
                                        {bh.isConfirmed ? "Done" : "Pending"}
                                    </span>
                                </div>
                            ))}
                            {totalCount === 0 && (
                                <p className="text-sm text-dashboard-neutral">No hotel stays.</p>
                            )}
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
}
