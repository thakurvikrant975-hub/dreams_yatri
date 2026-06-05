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

// Full snapshot types (all fields available in priceSnapshot)
type SnapHotel = {
    hotel_id: number;
    room_pricing_id: number;
    room_id: number | null;
    hotel_name: string;
    hotel_city: string | null;
    hotel_state: string | null;
    hotel_address: string | null;
    check_in_time: string | null;
    check_out_time: string | null;
    room_name: string | null;
    plan_name: string | null;
    occupancy_selected: number;
    rooms_count: number;
    num_nights: number;
    price_per_room: number;
    total: number;
};
type SnapDay = {
    day: number;
    day_title: string;
    day_date: string | null;
    hotel: SnapHotel | null;
    meals: { label: string }[];
};
type Snapshot = { days?: SnapDay[] };

function fmtDate(d: Date | null | string): string {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
function fmtDateTime(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(d);
}
function addDays(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
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

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true,
            startDate: true, endDate: true, duration: true, travellers: true, createdAt: true,
            totalAmount_paise: true, contactEmail: true, contactPhone: true,
            destinationId: true, priceSnapshot: true,
            user: { select: { name: true, email: true } },
            package: { select: { title: true } },
            destination: { select: { name: true } },
            // Existing confirmed records (to show confirmed state)
            hotelBookings: {
                select: {
                    dayNumber: true, isConfirmed: true, confirmedAt: true, notes: true, hotelId: true,
                    confirmedBy: { select: { name: true } },
                },
            },
        },
    });

    if (!booking) notFound();

    // Parse snapshot to get hotel days
    const snapshot = (booking.priceSnapshot ?? {}) as Snapshot;
    const hotelDays = (snapshot.days ?? []).filter((d): d is SnapDay & { hotel: SnapHotel } => d.hotel !== null);

    // Fetch hotel details (thumbnail + contacts) for all unique hotel IDs in the snapshot
    const uniqueHotelIds = [...new Set(hotelDays.map((d) => d.hotel.hotel_id))];
    const [hotelDetailsList, allHotels] = await Promise.all([
        db.hotels.findMany({
            where: { id: { in: uniqueHotelIds } },
            select: { id: true, name: true, thumbnail: true, category: true, city: true, business_phone: true, business_email: true },
        }),
        db.hotels.findMany({
            where: { is_active: true },
            select: { id: true, name: true, category: true, city: true, destination_id: true },
            orderBy: { name: "asc" },
            take: 300,
        }),
    ]);

    const hotelDetailsMap = new Map(hotelDetailsList.map((h) => [h.id, h]));
    const confirmedMap = new Map(booking.hotelBookings.map((bh) => [bh.dayNumber, bh]));
    const destinationHotels = allHotels.filter((h) => h.destination_id === booking.destinationId);

    const totalCount = hotelDays.length;
    const confirmedCount = hotelDays.filter((d) => confirmedMap.get(d.day)?.isConfirmed).length;
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
                        {confirmedCount} of {totalCount} hotel stay{totalCount !== 1 ? "s" : ""} confirmed
                    </span>
                </div>
                <div className="h-2 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div
                        className={`h-2 rounded-full transition-all ${progressPct === 100 ? "bg-green-500" : "bg-dashboard-primary"}`}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
                {progressPct === 100 && (
                    <p className="mt-1.5 text-xs text-green-600 font-medium">
                        All hotel stays confirmed — booking will be moved to Hotel Confirmed.
                    </p>
                )}
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                {/* Main column — hotel cards */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {totalCount === 0 ? (
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral">
                            No hotel stays found in the booking itinerary snapshot.
                        </div>
                    ) : (
                        hotelDays.map((d) => {
                            const snap = d.hotel;
                            const details = hotelDetailsMap.get(snap.hotel_id);
                            const confirmed = confirmedMap.get(d.day);
                            const isConfirmed = confirmed?.isConfirmed ?? false;

                            const checkIn = d.day_date ?? null;
                            const checkOut = checkIn ? addDays(checkIn, snap.num_nights) : null;

                            return (
                                <div
                                    key={d.day}
                                    className={`rounded-xl border overflow-hidden ${
                                        isConfirmed ? "border-green-200 bg-green-50/30" : "border-dashboard-base-300 bg-dashboard-base-100"
                                    }`}
                                >
                                    <div className="flex gap-0">
                                        {/* Thumbnail */}
                                        <div className="w-32 shrink-0 sm:w-44 relative overflow-hidden bg-dashboard-base-200">
                                            {details?.thumbnail ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={details.thumbnail}
                                                    alt={snap.hotel_name}
                                                    className="w-full h-full object-cover"
                                                    style={{ minHeight: "140px" }}
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full text-dashboard-neutral text-3xl" style={{ minHeight: "140px" }}>
                                                    🏨
                                                </div>
                                            )}
                                            {/* Day badge */}
                                            <div className="absolute top-2 left-2">
                                                <span className="rounded-md bg-dashboard-primary px-2 py-1 text-[11px] font-bold text-white shadow">
                                                    Day {d.day}
                                                </span>
                                            </div>
                                            {/* Nights badge */}
                                            <div className="absolute bottom-2 right-2">
                                                <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
                                                    {snap.num_nights}N
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 p-4 flex flex-col gap-2">
                                            {/* Header row */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <h3 className="font-semibold text-dashboard-base-content text-base leading-tight">
                                                        {snap.hotel_name}
                                                    </h3>
                                                    {(snap.hotel_city || details?.city) && (
                                                        <p className="text-xs text-dashboard-neutral mt-0.5">
                                                            {snap.hotel_city ?? details?.city}
                                                            {snap.hotel_state ? `, ${snap.hotel_state}` : ""}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="shrink-0">
                                                    {isConfirmed ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                                                            ✓ Confirmed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                                                            Pending
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Room + plan badges */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {snap.room_name && (
                                                    <span className="rounded-full border border-dashboard-base-300 px-2.5 py-0.5 text-[11px] text-dashboard-base-content">
                                                        {snap.room_name}
                                                    </span>
                                                )}
                                                {snap.plan_name && (
                                                    <span className="rounded-full border border-dashboard-base-300 px-2.5 py-0.5 text-[11px] text-dashboard-base-content">
                                                        {snap.plan_name}
                                                    </span>
                                                )}
                                                <span className="rounded-full border border-dashboard-base-300 px-2.5 py-0.5 text-[11px] text-dashboard-base-content">
                                                    {snap.rooms_count} room{snap.rooms_count !== 1 ? "s" : ""}
                                                </span>
                                                <span className="rounded-full border border-dashboard-base-300 px-2.5 py-0.5 text-[11px] text-dashboard-base-content">
                                                    {booking.travellers} guest{booking.travellers !== 1 ? "s" : ""}
                                                </span>
                                            </div>

                                            {/* Dates */}
                                            <div className="text-sm text-dashboard-base-content">
                                                <span className="text-dashboard-neutral text-xs">Check-in</span>{" "}
                                                <span className="font-medium">{fmtDate(checkIn)}</span>
                                                {snap.check_in_time && (
                                                    <span className="text-xs text-dashboard-neutral"> by {snap.check_in_time}</span>
                                                )}
                                                <span className="mx-2 text-dashboard-neutral">→</span>
                                                <span className="text-dashboard-neutral text-xs">Check-out</span>{" "}
                                                <span className="font-medium">{fmtDate(checkOut)}</span>
                                                {snap.check_out_time && (
                                                    <span className="text-xs text-dashboard-neutral"> by {snap.check_out_time}</span>
                                                )}
                                            </div>

                                            {/* Price */}
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="text-dashboard-neutral text-xs">
                                                    ₹{Number(snap.price_per_room).toLocaleString("en-IN")} / room
                                                </span>
                                                <span className="text-dashboard-base-300">·</span>
                                                <span className="font-semibold text-dashboard-base-content">
                                                    Total ₹{Number(snap.total).toLocaleString("en-IN")}
                                                </span>
                                            </div>

                                            {/* Contact */}
                                            {(details?.business_phone || details?.business_email) && (
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-dashboard-neutral">
                                                    {details.business_phone && (
                                                        <a href={`tel:${details.business_phone}`} className="hover:text-dashboard-primary flex items-center gap-1">
                                                            📞 {details.business_phone}
                                                        </a>
                                                    )}
                                                    {details.business_email && (
                                                        <a href={`mailto:${details.business_email}`} className="hover:text-dashboard-primary flex items-center gap-1">
                                                            ✉ {details.business_email}
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {/* Confirmed info */}
                                            {isConfirmed && confirmed && (
                                                <div className="rounded-md bg-green-100/70 px-3 py-2 text-xs text-green-800 mt-1">
                                                    Confirmed by{" "}
                                                    <span className="font-medium">{confirmed.confirmedBy?.name ?? "—"}</span>
                                                    {" · "}{fmtDateTime(confirmed.confirmedAt)}
                                                    {confirmed.notes && (
                                                        <span className="block mt-0.5">Note: {confirmed.notes}</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Confirm button / form */}
                                            {!isConfirmed && (
                                                <HotelConfirmPanel
                                                    bookingId={booking.id}
                                                    dayNumber={d.day}
                                                    defaultHotelId={snap.hotel_id}
                                                    cityName={snap.hotel_city ?? d.day_title}
                                                    checkInDate={checkIn ?? booking.startDate.toISOString().split("T")[0]}
                                                    checkOutDate={checkOut ?? booking.endDate.toISOString().split("T")[0]}
                                                    roomType={snap.room_name ?? snap.plan_name ?? "Standard"}
                                                    roomsCount={snap.rooms_count}
                                                    ratePerRoom={snap.price_per_room}
                                                    totalCost={snap.total}
                                                    destinationHotels={destinationHotels}
                                                    allHotels={allHotels}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
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

                    {totalCount > 0 && (
                        <Section title="Hotel Summary">
                            <div className="flex flex-col gap-2">
                                {hotelDays.map((d) => {
                                    const confirmed = confirmedMap.get(d.day);
                                    return (
                                        <div key={d.day} className="flex items-center justify-between text-sm gap-2">
                                            <div className="min-w-0">
                                                <span className="text-dashboard-neutral shrink-0">Day {d.day}</span>
                                                <span className="mx-1.5 text-dashboard-base-300">·</span>
                                                <span className="text-dashboard-base-content truncate">{d.hotel.hotel_name}</span>
                                            </div>
                                            <span
                                                className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${
                                                    confirmed?.isConfirmed
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-amber-100 text-amber-700"
                                                }`}
                                            >
                                                {confirmed?.isConfirmed ? "Done" : "Pending"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    )}
                </div>
            </div>
        </div>
    );
}
