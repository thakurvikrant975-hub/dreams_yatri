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
type SnapDay = { day: number; day_title: string; day_date: string | null; hotel: SnapHotel | null; meals: { label: string }[] };
type Snapshot = { days?: SnapDay[] };

function fmtDate(d: Date | string | null): string {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d;
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
function fmtDateTime(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
function addDays(dateStr: string, n: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
}
const fmt = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

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
    const hotelDays = (snapshot.days ?? []).filter((d): d is SnapDay & { hotel: SnapHotel } => d.hotel !== null);

    // Fetch hotel contacts + room details in parallel
    const uniqueHotelIds = [...new Set(hotelDays.map((d) => d.hotel.hotel_id))];
    const uniqueRoomIds = [...new Set(hotelDays.map((d) => d.hotel.room_id).filter((id): id is number => id !== null))];

    const [hotelDetailsList, roomDetailsList, allHotels] = await Promise.all([
        db.hotels.findMany({
            where: { id: { in: uniqueHotelIds } },
            select: { id: true, business_phone: true, business_email: true, address: true, category: true },
        }),
        uniqueRoomIds.length > 0
            ? db.hotel_rooms.findMany({
                  where: { id: { in: uniqueRoomIds } },
                  select: { id: true, name: true, bed_type: true, max_occupancy: true, area_sqft: true, view_type: true },
              })
            : Promise.resolve([]),
        db.hotels.findMany({
            where: { is_active: true },
            select: { id: true, name: true, category: true, city: true, destination_id: true },
            orderBy: { name: "asc" },
            take: 300,
        }),
    ]);

    const hotelMap = new Map(hotelDetailsList.map((h) => [h.id, h]));
    const roomMap = new Map(roomDetailsList.map((r) => [r.id, r]));
    const confirmedMap = new Map(booking.hotelBookings.map((bh) => [bh.dayNumber, bh]));
    const destinationHotels = allHotels.filter((h) => h.destination_id === booking.destinationId);

    const totalCount = hotelDays.length;
    const confirmedCount = hotelDays.filter((d) => confirmedMap.get(d.day)?.isConfirmed).length;
    const pct = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;

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
                    <span className="text-sm font-medium text-dashboard-base-content">Confirmation Progress</span>
                    <span className="text-sm text-dashboard-neutral">{confirmedCount} of {totalCount} hotel stay{totalCount !== 1 ? "s" : ""} confirmed</span>
                </div>
                <div className="h-2 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div
                        className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-dashboard-primary"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                {pct === 100 && (
                    <p className="mt-1.5 text-xs text-green-600 font-medium">All hotel stays confirmed — booking will be moved to Hotel Confirmed.</p>
                )}
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                {/* Hotel cards */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {totalCount === 0 ? (
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral">
                            No hotel stays found in the booking itinerary snapshot.
                        </div>
                    ) : (
                        hotelDays.map((d) => {
                            const snap = d.hotel;
                            const hotel = hotelMap.get(snap.hotel_id);
                            const room = snap.room_id ? roomMap.get(snap.room_id) : null;
                            const confirmed = confirmedMap.get(d.day);
                            const isConfirmed = confirmed?.isConfirmed ?? false;

                            const checkIn = d.day_date ?? null;
                            const checkOut = checkIn ? addDays(checkIn, snap.num_nights) : null;

                            return (
                                <div
                                    key={d.day}
                                    className={`rounded-xl border overflow-hidden ${isConfirmed ? "border-green-200" : "border-dashboard-base-300"}`}
                                >
                                    {/* Card top bar */}
                                    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isConfirmed ? "bg-green-50 border-green-200" : "bg-dashboard-base-200/50 border-dashboard-base-300"}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded bg-dashboard-primary px-2 py-0.5 text-[11px] font-bold text-white">Day {d.day}</span>
                                            <span className="text-sm font-medium text-dashboard-base-content">{d.day_title}</span>
                                            <span className="text-xs text-dashboard-neutral">· {snap.num_nights} night{snap.num_nights !== 1 ? "s" : ""}</span>
                                        </div>
                                        {isConfirmed ? (
                                            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">✓ Confirmed</span>
                                        ) : (
                                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>
                                        )}
                                    </div>

                                    <div className="p-4 flex flex-col gap-4 bg-dashboard-base-100">
                                        {/* Hotel name + location */}
                                        <div className="flex items-start gap-3">
                                            <div className="shrink-0 rounded-lg bg-dashboard-primary/10 flex items-center justify-center size-10 text-xl">🏨</div>
                                            <div>
                                                <h3 className="font-semibold text-dashboard-base-content text-base">{snap.hotel_name}</h3>
                                                <p className="text-sm text-dashboard-neutral mt-0.5">
                                                    {[snap.hotel_city, snap.hotel_state, snap.hotel_address].filter(Boolean).join(", ") || "—"}
                                                </p>
                                                {(hotel?.business_phone || hotel?.business_email) && (
                                                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-dashboard-neutral">
                                                        {hotel.business_phone && (
                                                            <a href={`tel:${hotel.business_phone}`} className="hover:text-dashboard-primary">
                                                                📞 {hotel.business_phone}
                                                            </a>
                                                        )}
                                                        {hotel.business_email && (
                                                            <a href={`mailto:${hotel.business_email}`} className="hover:text-dashboard-primary">
                                                                ✉ {hotel.business_email}
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Room to book — highlighted */}
                                        <div className="rounded-lg border border-dashboard-primary/20 bg-dashboard-primary/5 p-3.5">
                                            <div className="text-[10px] uppercase tracking-widest text-dashboard-primary font-bold mb-3">Room to Book</div>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Room Type</div>
                                                    <div className="text-sm font-semibold text-dashboard-base-content">{snap.room_name ?? "Standard"}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Meal Plan</div>
                                                    <div className="text-sm font-semibold text-dashboard-base-content">{snap.plan_name ?? "—"}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">No. of Rooms</div>
                                                    <div className="text-sm font-semibold text-dashboard-base-content">{snap.rooms_count} room{snap.rooms_count !== 1 ? "s" : ""}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Guests</div>
                                                    <div className="text-sm font-semibold text-dashboard-base-content">{booking.travellers} guest{booking.travellers !== 1 ? "s" : ""}</div>
                                                </div>
                                                {room?.bed_type && (
                                                    <div>
                                                        <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Bed Type</div>
                                                        <div className="text-sm font-semibold text-dashboard-base-content">{room.bed_type}</div>
                                                    </div>
                                                )}
                                                {room?.max_occupancy && (
                                                    <div>
                                                        <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Max Occupancy</div>
                                                        <div className="text-sm font-semibold text-dashboard-base-content">{room.max_occupancy} persons</div>
                                                    </div>
                                                )}
                                                {room?.area_sqft && (
                                                    <div>
                                                        <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Room Size</div>
                                                        <div className="text-sm font-semibold text-dashboard-base-content">{room.area_sqft} sqft</div>
                                                    </div>
                                                )}
                                                {room?.view_type && (
                                                    <div>
                                                        <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">View</div>
                                                        <div className="text-sm font-semibold text-dashboard-base-content">{room.view_type}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Dates */}
                                        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-dashboard-base-200/60 px-4 py-3 text-sm">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Check-in</div>
                                                <div className="font-semibold text-dashboard-base-content">{fmtDate(checkIn)}</div>
                                                {snap.check_in_time && <div className="text-xs text-dashboard-neutral">by {snap.check_in_time}</div>}
                                            </div>
                                            <div className="text-dashboard-neutral text-xl">→</div>
                                            <div>
                                                <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Check-out</div>
                                                <div className="font-semibold text-dashboard-base-content">{fmtDate(checkOut)}</div>
                                                {snap.check_out_time && <div className="text-xs text-dashboard-neutral">by {snap.check_out_time}</div>}
                                            </div>
                                            <div className="ml-auto text-right">
                                                <div className="text-[11px] uppercase tracking-wide text-dashboard-neutral mb-0.5">Price</div>
                                                <div className="font-semibold text-dashboard-base-content">{fmt(snap.total)}</div>
                                                <div className="text-xs text-dashboard-neutral">{fmt(snap.price_per_room)} / room / night</div>
                                            </div>
                                        </div>

                                        {/* Confirmed info or confirm button */}
                                        {isConfirmed && confirmed ? (
                                            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                                                <span className="font-medium">Confirmed</span> by {confirmed.confirmedBy?.name ?? "—"} · {fmtDateTime(confirmed.confirmedAt)}
                                                {confirmed.notes && <p className="mt-1 text-green-700">Note: {confirmed.notes}</p>}
                                            </div>
                                        ) : (
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
                <div className="flex flex-col gap-5">
                    <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                        <div className="border-b border-dashboard-base-300 px-5 py-3">
                            <h2 className="text-sm font-semibold text-dashboard-base-content">Booking Info</h2>
                        </div>
                        <div className="p-5">
                            <dl className="flex flex-col gap-3">
                                <Field label="Customer" value={booking.user?.name} />
                                <Field label="Contact email" value={booking.contactEmail ?? booking.user?.email} />
                                <Field label="Contact phone" value={booking.contactPhone} />
                                <Field label="Package" value={booking.package?.title} />
                                <Field label="Destination" value={booking.destination?.name} />
                                <Field label="Travel dates" value={`${fmtDate(booking.startDate)} – ${fmtDate(booking.endDate)}`} />
                                <Field label="Duration" value={`${booking.duration} day${booking.duration !== 1 ? "s" : ""}`} />
                                <Field label="Travellers" value={booking.travellers} />
                                <Field label="Total amount" value={formatPaise(booking.totalAmount_paise)} />
                            </dl>
                        </div>
                    </div>

                    {totalCount > 0 && (
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                            <div className="border-b border-dashboard-base-300 px-5 py-3">
                                <h2 className="text-sm font-semibold text-dashboard-base-content">Hotel Summary</h2>
                            </div>
                            <div className="p-4 flex flex-col divide-y divide-dashboard-base-300/60">
                                {hotelDays.map((d) => {
                                    const c = confirmedMap.get(d.day);
                                    return (
                                        <div key={d.day} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 text-xs text-dashboard-neutral mb-0.5">
                                                    <span className="font-medium">Day {d.day}</span>
                                                    <span>· {d.hotel.num_nights}N</span>
                                                </div>
                                                <div className="text-sm text-dashboard-base-content truncate">{d.hotel.hotel_name}</div>
                                                <div className="text-xs text-dashboard-neutral truncate">{d.hotel.room_name}</div>
                                            </div>
                                            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c?.isConfirmed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
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
