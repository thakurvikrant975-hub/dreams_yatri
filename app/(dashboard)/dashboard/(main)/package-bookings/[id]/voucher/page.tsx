import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import PrintVoucherButton from "./PrintVoucherButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Booking voucher - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
function nightsBetween(a: Date, b: Date): number {
    return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function StatusBadge({ isConfirmed, status }: { isConfirmed: boolean; status: string }) {
    if (isConfirmed) {
        return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Confirmed</span>;
    }
    return <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{titleCase(status)}</span>;
}

export default async function BookingVoucherPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, bookingNumber: true, startDate: true, endDate: true, duration: true, travellers: true,
            contactPhone: true, contactEmail: true, createdAt: true,
            destination: { select: { name: true } },
            package: { select: { title: true } },
            user: { select: { name: true } },
            hotelBookings: {
                orderBy: { dayNumber: "asc" },
                select: {
                    dayNumber: true, cityName: true, checkInDate: true, checkOutDate: true,
                    roomType: true, roomsCount: true, isConfirmed: true, status: true,
                    hotel: { select: { name: true, city: true, state: true } },
                },
            },
            cabBookings: {
                orderBy: { legNumber: "asc" },
                select: {
                    legNumber: true, fromLocation: true, toLocation: true, transferDate: true,
                    cabType: true, cabCount: true, capacity: true, isConfirmed: true, status: true,
                    driverName: true, driverPhone: true, vehicleNumber: true,
                },
            },
        },
    });
    if (!booking) notFound();

    const hotels = booking.hotelBookings;
    const cabs = booking.cabBookings;

    return (
        <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
            <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>

            <div className="mx-auto max-w-[860px] bg-white shadow-lg print:shadow-none rounded-sm overflow-hidden">
                {/* ── Header ── */}
                <div className="flex items-start justify-between px-10 pt-10 pb-6">
                    <div>
                        <div className="text-2xl font-extrabold tracking-tight text-neutral-900">
                            DREAMS<span className="text-orange-500">YATRI</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-400">Curated Holiday Experiences</div>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold tracking-[0.15em] text-orange-500">VOUCHER</div>
                    </div>
                </div>
                <div className="h-[3px] bg-linear-to-r from-orange-500 via-orange-300 to-transparent" />

                {/* ── Meta row ── */}
                <div className="flex flex-wrap items-start justify-between gap-4 px-10 py-6 text-sm">
                    <div className="flex gap-10">
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-400">Voucher No.</div>
                            <div className="mt-0.5 font-semibold text-neutral-800">{booking.bookingNumber}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-400">Date</div>
                            <div className="mt-0.5 font-semibold text-neutral-800">{fmtDate(booking.createdAt)}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400">Voucher To</div>
                        <div className="mt-0.5 font-semibold text-neutral-800">{booking.user?.name ?? "Guest"}</div>
                        {(booking.contactPhone || booking.contactEmail) && (
                            <div className="text-xs text-neutral-500">{[booking.contactPhone, booking.contactEmail].filter(Boolean).join(" · ")}</div>
                        )}
                    </div>
                </div>

                {/* ── Trip summary strip ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-10 pb-6">
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400">Trip</div>
                        <div className="mt-0.5 text-lg font-bold text-neutral-800">
                            {booking.package?.title ?? booking.destination?.name ?? "Your trip"}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                            {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)} · {booking.duration} day{booking.duration !== 1 ? "s" : ""} · {booking.travellers} traveller{booking.travellers !== 1 ? "s" : ""}
                        </div>
                    </div>
                    <div className="text-right text-xs text-neutral-500 leading-relaxed">
                        <div>support@dreamsyatri.com</div>
                        <div>+91 82199 79481</div>
                    </div>
                </div>

                {/* ── Hotel table ── */}
                <div className="px-10">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-orange-500 text-white">
                                <th className="text-left font-semibold px-3 py-2.5">Hotel</th>
                                <th className="text-left font-semibold px-3 py-2.5">Room Type</th>
                                <th className="text-right font-semibold px-3 py-2.5">Check-in</th>
                                <th className="text-right font-semibold px-3 py-2.5">Check-out</th>
                                <th className="text-right font-semibold px-3 py-2.5">Nights</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hotels.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-400 text-xs">No hotel confirmed yet</td></tr>
                            ) : hotels.map((h, i) => (
                                <tr key={i} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                                    <td className="px-3 py-3 align-top">
                                        <div className="font-medium text-neutral-800">{h.hotel.name}</div>
                                        <div className="text-xs text-neutral-500">{[h.hotel.city ?? h.cityName, h.hotel.state].filter(Boolean).join(", ")}</div>
                                        <div className="mt-1"><StatusBadge isConfirmed={h.isConfirmed} status={h.status} /></div>
                                    </td>
                                    <td className="px-3 py-3 align-top text-neutral-600">{h.roomType || "—"}{h.roomsCount > 1 ? ` × ${h.roomsCount}` : ""}</td>
                                    <td className="px-3 py-3 align-top text-right text-neutral-600">{fmtDate(h.checkInDate)}</td>
                                    <td className="px-3 py-3 align-top text-right text-neutral-600">{fmtDate(h.checkOutDate)}</td>
                                    <td className="px-3 py-3 align-top text-right font-semibold text-neutral-800">{nightsBetween(h.checkInDate, h.checkOutDate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Cab table ── */}
                <div className="px-10 mt-8">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Transportation</div>
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-orange-500 text-white">
                                <th className="text-left font-semibold px-3 py-2.5">Vehicle</th>
                                <th className="text-left font-semibold px-3 py-2.5">From</th>
                                <th className="text-left font-semibold px-3 py-2.5">To</th>
                                <th className="text-right font-semibold px-3 py-2.5">Date</th>
                                <th className="text-right font-semibold px-3 py-2.5">Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cabs.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-400 text-xs">No cab assigned yet</td></tr>
                            ) : cabs.map((c, i) => (
                                <tr key={i} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                                    <td className="px-3 py-3 align-top">
                                        <div className="font-medium text-neutral-800">
                                            {titleCase(c.cabType)}{c.cabCount > 1 ? ` × ${c.cabCount}` : ""}
                                            <span className="ml-1 text-xs font-normal text-neutral-400">({c.capacity}-seater)</span>
                                        </div>
                                        {(c.driverName || c.vehicleNumber) && (
                                            <div className="text-xs text-neutral-500">
                                                {[c.driverName, c.driverPhone, c.vehicleNumber].filter(Boolean).join(" · ")}
                                            </div>
                                        )}
                                        <div className="mt-1"><StatusBadge isConfirmed={c.isConfirmed} status={c.status} /></div>
                                    </td>
                                    <td className="px-3 py-3 align-top text-neutral-600">{c.fromLocation || "—"}</td>
                                    <td className="px-3 py-3 align-top text-neutral-600">{c.toLocation || "—"}</td>
                                    <td className="px-3 py-3 align-top text-right text-neutral-600">{fmtDate(c.transferDate)}</td>
                                    <td className="px-3 py-3 align-top text-right font-semibold text-neutral-800">1</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Signature / footer ── */}
                <div className="px-10 mt-12 flex items-end justify-between">
                    <p className="max-w-xs text-[11px] text-neutral-400 leading-relaxed">
                        Please present this voucher (printed or digital) at check-in / pickup. For any changes, contact our support team.
                    </p>
                    <div className="text-center">
                        <div className="text-xl italic text-neutral-700" style={{ fontFamily: "cursive" }}>Dreams Yatri</div>
                        <div className="mt-1 border-t border-neutral-300 pt-1 text-xs text-neutral-500">Operations Team</div>
                    </div>
                </div>

                <div className="mt-8 border-t border-neutral-100 px-10 py-5 flex items-center justify-between text-[11px] text-neutral-400">
                    <span>support@dreamsyatri.com · +91 82199 79481</span>
                    <span className="font-bold tracking-tight text-neutral-500">DREAMS<span className="text-orange-500">YATRI</span></span>
                </div>
            </div>

            <PrintVoucherButton />
        </div>
    );
}
