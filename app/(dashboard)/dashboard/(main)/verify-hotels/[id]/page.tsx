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

type SnapHotel = {
    hotel_id: number; room_pricing_id: number; room_id: number | null;
    hotel_name: string; hotel_city: string | null; hotel_state: string | null; hotel_address: string | null;
    check_in_time: string | null; check_out_time: string | null;
    room_name: string | null; plan_name: string | null;
    occupancy_selected: number; rooms_count: number; num_nights: number;
    price_per_room: number; total: number;
};
type SnapDay = { day: number; day_title: string; day_date: string | null; hotel: SnapHotel | null; meals: { label: string }[] };
type Snapshot = { days?: SnapDay[] };

function fmtDate(d: Date | string | null): string {
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
function addDays(dateStr: string, n: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wide text-dashboard-neutral">{label}</dt>
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
            hotelBookings: {
                select: {
                    dayNumber: true, isConfirmed: true, confirmedAt: true, notes: true, hotelId: true,
                    confirmedBy: { select: { name: true } },
                },
            },
        },
    });

    if (!booking) notFound();

    const snapshot = (booking.priceSnapshot ?? {}) as Snapshot;
    const hotelDays = (snapshot.days ?? []).filter((d): d is SnapDay & { hotel: SnapHotel } => d.hotel != null && d.hotel.hotel_id != null);

    const uniqueHotelIds = [...new Set(hotelDays.map((d) => d.hotel.hotel_id).filter((x): x is number => x != null))];
    const uniqueRoomIds  = [...new Set(hotelDays.map((d) => d.hotel.room_id).filter((x): x is number => x != null))];

    const [hotelDetailsList, roomDetailsList, allHotels] = await Promise.all([
        db.hotels.findMany({
            where: { id: { in: uniqueHotelIds } },
            select: { id: true, business_phone: true, business_email: true, category: true },
        }),
        uniqueRoomIds.length > 0
            ? db.hotel_rooms.findMany({
                  where: { id: { in: uniqueRoomIds } },
                  select: { id: true, bed_type: true, max_occupancy: true, area_sqft: true, view_type: true },
              })
            : Promise.resolve([]),
        db.hotels.findMany({
            where: { is_active: true },
            select: { id: true, name: true, category: true, city: true, state: true, address: true, destination_id: true, business_phone: true, business_email: true },
            orderBy: { name: "asc" },
            take: 300,
        }),
    ]);

    const hotelMap = new Map(hotelDetailsList.map((h) => [h.id, h]));
    const roomMap  = new Map(roomDetailsList.map((r) => [r.id, r]));
    const confirmedMap = new Map(booking.hotelBookings.map((bh) => [bh.dayNumber, bh]));
    const destinationHotels = allHotels.filter((h) => h.destination_id === booking.destinationId);

    const totalCount     = hotelDays.length;
    const confirmedCount = hotelDays.filter((d) => confirmedMap.get(d.day)?.isConfirmed).length;
    const pct = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;
    const allDone = pct === 100;

    return (
        <div className="flex flex-col gap-5">
            <Link href="/dashboard/verify-hotels" className="text-sm text-dashboard-neutral hover:text-dashboard-primary cursor-pointer transition-colors">
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
                        className="cursor-pointer rounded-md border border-dashboard-base-300 px-3 py-1.5 text-sm text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                    >
                        Full booking →
                    </Link>
                </div>
            </div>

            {/* Progress */}
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-3.5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dashboard-base-content">Confirmation Progress</span>
                    <span className={`text-sm font-medium ${allDone ? "text-dashboard-success" : "text-dashboard-error"}`}>
                        {confirmedCount} / {totalCount} confirmed
                    </span>
                </div>
                <div className="h-2 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${allDone ? "bg-dashboard-success" : "bg-dashboard-error"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className={`mt-1.5 text-xs font-medium ${allDone ? "text-dashboard-success" : "text-dashboard-error"}`}>
                    {allDone
                        ? "✓ All stays confirmed — booking will advance to Hotel Confirmed."
                        : `${totalCount - confirmedCount} hotel stay${totalCount - confirmedCount !== 1 ? "s" : ""} still need confirmation`}
                </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                {/* Hotel cards */}
                <div className="lg:col-span-2 flex flex-col gap-3">
                    {totalCount === 0 ? (
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral">
                            No hotel stays found in the booking itinerary snapshot.
                        </div>
                    ) : (
                        hotelDays.map((d) => {
                            const snap      = d.hotel;
                            const hotel     = hotelMap.get(snap.hotel_id);
                            const room      = snap.room_id ? roomMap.get(snap.room_id) : null;
                            const confirmed = confirmedMap.get(d.day);
                            const isDone    = confirmed?.isConfirmed ?? false;

                            const checkIn  = d.day_date ?? null;
                            const checkOut = checkIn ? addDays(checkIn, snap.num_nights) : null;

                            const chips = [
                                snap.room_name,
                                snap.plan_name,
                                room?.bed_type  ? `${room.bed_type} bed`       : null,
                                room?.max_occupancy ? `Max ${room.max_occupancy} guests` : null,
                                room?.area_sqft ? `${room.area_sqft} sqft`    : null,
                                room?.view_type ? `${room.view_type} view`    : null,
                            ].filter(Boolean) as string[];

                            return (
                                <div
                                    key={d.day}
                                    className={`rounded-xl border overflow-hidden ${isDone ? "border-dashboard-success/30 bg-dashboard-success/5" : "border-dashboard-base-300 bg-dashboard-base-100"}`}
                                >
                                    {/* Top bar */}
                                    <div className={`flex items-center justify-between px-4 py-2 border-b ${isDone ? "bg-dashboard-success/15 border-dashboard-success/20" : "bg-dashboard-base-200 border-dashboard-base-300"}`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="shrink-0 rounded bg-dashboard-primary px-2 py-0.5 text-[11px] font-bold text-dashboard-primary-content">
                                                Day {d.day}
                                            </span>
                                            <span className="text-sm font-medium text-dashboard-base-content truncate">{d.day_title}</span>
                                            <span className="shrink-0 text-xs text-dashboard-neutral">· {snap.num_nights}N</span>
                                        </div>
                                        {isDone ? (
                                            <span className="shrink-0 ml-2 rounded-full bg-dashboard-success/20 px-2.5 py-0.5 text-[11px] font-semibold text-dashboard-success">
                                                ✓ Confirmed
                                            </span>
                                        ) : (
                                            <span className="shrink-0 ml-2 rounded-full bg-dashboard-warning/20 px-2.5 py-0.5 text-[11px] font-semibold text-dashboard-neutral">
                                                Pending
                                            </span>
                                        )}
                                    </div>

                                    <div className="px-4 py-3 flex flex-col gap-3">
                                        {/* Hotel name + contacts */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold text-dashboard-base-content">
                                                        🏨 {snap.hotel_name}
                                                    </span>
                                                    {hotel?.category && (
                                                        <span className={`rounded px-1.5 py-0.5 text-[10px] text-dashboard-neutral ${isDone ? "bg-dashboard-success/10" : "bg-dashboard-base-200"}`}>
                                                            {hotel.category}
                                                        </span>
                                                    )}
                                                </div>
                                                {(snap.hotel_city || snap.hotel_state) && (
                                                    <p className="text-xs text-dashboard-neutral mt-0.5">
                                                        {[snap.hotel_city, snap.hotel_state].filter(Boolean).join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                            {(hotel?.business_phone || hotel?.business_email) && (
                                                <div className="shrink-0 flex flex-col items-end gap-1 text-xs text-dashboard-neutral">
                                                    {hotel.business_phone && (
                                                        <a href={`tel:${hotel.business_phone}`} className="cursor-pointer hover:text-dashboard-primary transition-colors">
                                                            📞 {hotel.business_phone}
                                                        </a>
                                                    )}
                                                    {hotel.business_email && (
                                                        <a href={`mailto:${hotel.business_email}`} className="cursor-pointer hover:text-dashboard-primary transition-colors">
                                                            ✉ {hotel.business_email}
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Room to book */}
                                        <div className={`rounded-lg border px-3 py-2.5 ${isDone ? "border-dashboard-success/20 bg-dashboard-success/8" : "border-dashboard-base-300 bg-dashboard-base-200/60"}`}>
                                            <p className="text-[10px] uppercase tracking-widest text-dashboard-neutral font-semibold mb-2">
                                                Room to Book &nbsp;·&nbsp; {snap.rooms_count} room{snap.rooms_count !== 1 ? "s" : ""} &nbsp;·&nbsp; {booking.travellers} guest{booking.travellers !== 1 ? "s" : ""}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {chips.map((chip) => (
                                                    <span
                                                        key={chip}
                                                        className={`rounded-full border px-2.5 py-0.5 text-xs text-dashboard-base-content ${isDone ? "border-dashboard-success/20 bg-dashboard-base-100" : "border-dashboard-base-300 bg-dashboard-base-100"}`}
                                                    >
                                                        {chip}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Dates + price */}
                                        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg px-3 py-2.5 text-sm ${isDone ? "bg-dashboard-success/8" : "bg-dashboard-base-200/50"}`}>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-dashboard-neutral">Check-in</span>
                                                <span className="font-medium text-dashboard-base-content">{fmtDate(checkIn)}</span>
                                                {snap.check_in_time && <span className="text-[11px] text-dashboard-neutral">({snap.check_in_time})</span>}
                                            </div>
                                            <span className="text-dashboard-neutral">→</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-dashboard-neutral">Check-out</span>
                                                <span className="font-medium text-dashboard-base-content">{fmtDate(checkOut)}</span>
                                                {snap.check_out_time && <span className="text-[11px] text-dashboard-neutral">({snap.check_out_time})</span>}
                                            </div>
                                            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-dashboard-neutral">
                                                ₹{Number(snap.price_per_room).toLocaleString("en-IN")}/room
                                                <span className="text-dashboard-base-300">·</span>
                                                <span className="text-sm font-semibold text-dashboard-base-content">
                                                    ₹{Number(snap.total).toLocaleString("en-IN")}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Confirmed banner */}
                                        {isDone && confirmed && (
                                            <div className="rounded-lg border border-dashboard-success/25 bg-dashboard-success/8 px-3 py-2 text-xs text-dashboard-success">
                                                <span className="font-semibold">Confirmed</span> by {confirmed.confirmedBy?.name ?? "—"} · {fmtDateTime(confirmed.confirmedAt)}
                                                {confirmed.notes && <p className="mt-0.5 opacity-80">Note: {confirmed.notes}</p>}
                                            </div>
                                        )}

                                        {/* Confirm form */}
                                        {!isDone && (
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
                            );
                        })
                    )}
                </div>

                {/* Sidebar */}
                <div className="flex flex-col gap-4">
                    {/* Booking Info */}
                    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                        <div className="border-b border-dashboard-base-300 px-5 py-3">
                            <h2 className="text-sm font-semibold text-dashboard-base-content">Booking Info</h2>
                        </div>
                        <div className="p-4">
                            <dl className="flex flex-col gap-2.5">
                                <InfoRow label="Customer"     value={booking.user?.name} />
                                <InfoRow label="Email"        value={booking.contactEmail ?? booking.user?.email} />
                                <InfoRow label="Phone"        value={booking.contactPhone} />
                                <InfoRow label="Package"      value={booking.package?.title} />
                                <InfoRow label="Destination"  value={booking.destination?.name} />
                                <InfoRow label="Travel dates" value={`${fmtDate(booking.startDate)} – ${fmtDate(booking.endDate)}`} />
                                <InfoRow label="Duration"     value={`${booking.duration} day${booking.duration !== 1 ? "s" : ""}`} />
                                <InfoRow label="Travellers"   value={booking.travellers} />
                                <InfoRow label="Total"        value={formatPaise(booking.totalAmount_paise)} />
                            </dl>
                        </div>
                    </div>

                    {/* Hotel Summary */}
                    {totalCount > 0 && (
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                            <div className="border-b border-dashboard-base-300 px-5 py-3">
                                <h2 className="text-sm font-semibold text-dashboard-base-content">Hotel Summary</h2>
                            </div>
                            <div className="divide-y divide-dashboard-base-300/60">
                                {hotelDays.map((d) => {
                                    const c = confirmedMap.get(d.day);
                                    return (
                                        <div key={d.day} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                            <div className="min-w-0">
                                                <div className="text-xs text-dashboard-neutral mb-0.5">
                                                    Day {d.day} · {d.hotel.num_nights}N
                                                </div>
                                                <div className="text-sm text-dashboard-base-content truncate">{d.hotel.hotel_name}</div>
                                                {d.hotel.room_name && (
                                                    <div className="text-xs text-dashboard-neutral truncate">{d.hotel.room_name}</div>
                                                )}
                                            </div>
                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                c?.isConfirmed
                                                    ? "bg-dashboard-success/20 text-dashboard-success"
                                                    : "bg-dashboard-warning/20 text-dashboard-neutral"
                                            }`}>
                                                {c?.isConfirmed ? "Done" : "Pending"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
