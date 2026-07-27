import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Phone, Mail } from "lucide-react";
import { db } from "@/app/lib/db";
import DyLogo from "@/app/components/ui/DyLogo";
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
function fmtDateRange(start: Date, end: Date): string {
    return start.getTime() === end.getTime() ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** Collapses a sequence into runs where consecutive items satisfy `sameGroup`
 * — used to fold a trip's day-by-day hotel/cab rows into one row per
 * continuous stay/hire instead of one row per day. */
function groupConsecutive<T>(items: T[], sameGroup: (prev: T, curr: T) => boolean): T[][] {
    const groups: T[][] = [];
    for (const item of items) {
        const current = groups[groups.length - 1];
        if (current && sameGroup(current[current.length - 1], item)) {
            current.push(item);
        } else {
            groups.push([item]);
        }
    }
    return groups;
}

function StatusBadge({ isConfirmed, status }: { isConfirmed: boolean; status: string }) {
    if (isConfirmed) {
        return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Confirmed</span>;
    }
    return <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{titleCase(status)}</span>;
}

function ContactRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-end gap-2 text-neutral-600/90">
            <span>{children}</span>
            <Icon className="size-3.5 shrink-0 text-primary-400" />
        </div>
    );
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

    // Same hotel, same room, same confirmation state, and picking up right
    // where the previous day's stay left off — fold into a single date-range
    // row. A different hotel (or a gap/status change) starts a new row, so a
    // multi-hotel trip still gets one row per distinct stay.
    const hotelGroups = groupConsecutive(hotels, (a, b) =>
        a.hotel.name === b.hotel.name &&
        a.roomType === b.roomType &&
        a.roomsCount === b.roomsCount &&
        a.isConfirmed === b.isConfirmed &&
        a.status === b.status &&
        b.dayNumber === a.dayNumber + 1 &&
        a.checkOutDate.getTime() === b.checkInDate.getTime()
    );

    // Same vehicle (type, capacity, count, driver/plate) on consecutive legs
    // — fold into one row spanning the date range. A different vehicle
    // starts a new row, so a trip that swaps cars mid-way gets multiple rows.
    const cabGroups = groupConsecutive(cabs, (a, b) =>
        a.cabType === b.cabType &&
        a.capacity === b.capacity &&
        a.cabCount === b.cabCount &&
        a.driverName === b.driverName &&
        a.vehicleNumber === b.vehicleNumber &&
        a.isConfirmed === b.isConfirmed &&
        a.status === b.status &&
        b.legNumber === a.legNumber + 1
    );

    const confirmedCount = hotels.filter((h) => h.isConfirmed).length + cabs.filter((c) => c.isConfirmed).length;
    const totalCount = hotels.length + cabs.length;
    const allConfirmed = totalCount > 0 && confirmedCount === totalCount;

    return (
        <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
            <style>{`@media print { .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>

            <div className="mx-auto max-w-215 bg-white shadow-lg print:shadow-none rounded-sm overflow-hidden">
                {/* ── Header ── */}
                <div className="flex items-start justify-between px-10 pt-10 pb-6">
                    <div>
                        <DyLogo className="h-11.5 text-primary-500" />
                        <div className="mt-1.5 text-[11px] text-neutral-600/90">Curated Holiday Experiences</div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold tracking-[0.15em] text-neutral-700">VOUCHER</div>
                        <div className="mt-0.5 text-[11px] text-neutral-400">Hotel &amp; Transport Confirmation</div>
                    </div>
                </div>
                <div className="h-0.75 bg-linear-to-r from-primary-600 to-primary-400" />

                {/* ── Meta row (voucher no. / date / voucher to) ── */}
                <div className="flex flex-wrap items-start justify-between gap-4 px-10 py-6 text-sm">
                    <div className="flex gap-10">
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Voucher No.</div>
                            <div className="mt-0.5 font-semibold text-neutral-900">{booking.bookingNumber}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Date</div>
                            <div className="mt-0.5 font-semibold text-neutral-900">{fmtDate(booking.createdAt)}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Voucher To</div>
                        <div className="mt-0.5 font-semibold text-neutral-900">{booking.user?.name ?? "Guest"}</div>
                        {(booking.contactPhone || booking.contactEmail) && (
                            <div className="text-xs text-neutral-800">{[booking.contactPhone, booking.contactEmail].filter(Boolean).join(" · ")}</div>
                        )}
                    </div>
                </div>

                {/* ── Trip summary strip ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-10 pb-6">
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Trip</div>
                        <div className="mt-0.5 text-lg font-bold text-neutral-900">
                            {booking.package?.title ?? booking.destination?.name ?? "Your trip"}
                        </div>
                        <div className="text-xs text-neutral-800 mt-0.5">
                            {fmtDate(booking.startDate)} – {fmtDate(booking.endDate)} · {booking.duration} day{booking.duration !== 1 ? "s" : ""} · {booking.travellers} traveller{booking.travellers !== 1 ? "s" : ""}
                        </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                        <ContactRow icon={Phone}>+91 82199 79481</ContactRow>
                        <ContactRow icon={Mail}>support@dreamsyatri.com</ContactRow>
                    </div>
                </div>

                {/* ── Hotel table ── */}
                <div className="px-10">
                    <div className="rounded-lg ring-[0.1em] ring-inset ring-neutral-300/80 overflow-hidden p-[0.1em] bg-white">
                    <table className="w-full text-sm border-collapse rounded-md overflow-hidden">
                        <thead>
                            <tr className="bg-primary-500 text-white">
                                <th className="text-left font-semibold px-3 py-2.5">Hotel</th>
                                <th className="text-left font-semibold px-3 py-2.5">Room Type</th>
                                <th className="text-right font-semibold px-3 py-2.5">Check-in</th>
                                <th className="text-right font-semibold px-3 py-2.5">Check-out</th>
                                <th className="text-right font-semibold px-3 py-2.5">Nights</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hotelGroups.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-600/90 text-xs">No hotel confirmed yet</td></tr>
                            ) : hotelGroups.map((group, i) => {
                                const first = group[0];
                                const last = group[group.length - 1];
                                return (
                                    <tr key={first.dayNumber} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                                        <td className="px-3 py-3 align-top">
                                            <div className="font-semibold text-neutral-900">{first.hotel.name}</div>
                                            <div className="text-xs text-neutral-700">{[first.hotel.city ?? first.cityName, first.hotel.state].filter(Boolean).join(", ")}</div>
                                            <div className="mt-1"><StatusBadge isConfirmed={first.isConfirmed} status={first.status} /></div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-neutral-800 text-sm font-semibold ">{first.roomType || "—"}{first.roomsCount > 1 ? ` × ${first.roomsCount}` : ""}</td>
                                        <td className="px-3 py-3 align-top text-right text-neutral-600/90">{fmtDate(first.checkInDate)}</td>
                                        <td className="px-3 py-3 align-top text-right text-neutral-600/90">{fmtDate(last.checkOutDate)}</td>
                                        <td className="px-3 py-3 align-top text-right font-semibold text-neutral-700">{nightsBetween(first.checkInDate, last.checkOutDate)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* ── Cab table ── */}
                <div className="px-10 mt-8">
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-700">Transportation</div>
                    <div className="rounded-lg ring-[0.1em] ring-inset ring-neutral-300/80 overflow-hidden p-[0.1em] bg-white">
                    <table className="w-full text-sm border-collapse rounded-md overflow-hidden">
                        <thead>
                            <tr className="bg-primary-500 text-white">
                                <th className="text-left font-semibold px-3 py-2.5">Vehicle</th>
                                <th className="text-left font-semibold px-3 py-2.5">From</th>
                                <th className="text-left font-semibold px-3 py-2.5">To</th>
                                <th className="text-right font-semibold px-3 py-2.5">Date</th>
                                <th className="text-right font-semibold px-3 py-2.5">Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cabGroups.length === 0 ? (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-600/90 text-xs">No cab assigned yet</td></tr>
                            ) : cabGroups.map((group, i) => {
                                const first = group[0];
                                const last = group[group.length - 1];
                                return (
                                    <tr key={first.legNumber} className={i % 2 === 1 ? "bg-neutral-50" : ""}>
                                        <td className="px-3 py-3 align-top">
                                            <div className="font-medium text-neutral-900">
                                                {titleCase(first.cabType)}{first.cabCount > 1 ? ` × ${first.cabCount}` : ""}
                                                <span className="ml-1 text-xs font-normal text-neutral-600/90">({first.capacity}-seater)</span>
                                            </div>
                                            {(first.driverName || first.vehicleNumber) && (
                                                <div className="text-xs text-neutral-600/90">
                                                    {[first.driverName, first.driverPhone, first.vehicleNumber].filter(Boolean).join(" · ")}
                                                </div>
                                            )}
                                            <div className="mt-1"><StatusBadge isConfirmed={first.isConfirmed} status={first.status} /></div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-neutral-600/90">{first.fromLocation || "—"}</td>
                                        <td className="px-3 py-3 align-top text-neutral-600/90">{last.toLocation || "—"}</td>
                                        <td className="px-3 py-3 align-top text-right text-neutral-600/90">{fmtDateRange(first.transferDate, last.transferDate)}</td>
                                        <td className="px-3 py-3 align-top text-right font-semibold text-neutral-700">{group.length}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* ── Need-assistance box + confirmed-count summary ── */}
                <div className="mt-8 flex flex-wrap items-start justify-between gap-6 px-10">
                    <div className="max-w-65">
                        <div className="text-xs font-bold uppercase tracking-wide text-neutral-700">Need Assistance?</div>
                        <div className="mt-2 space-y-1 text-xs text-neutral-600/90">
                            <div className="font-semibold text-neutral-700">Dreams Yatri Operations</div>
                            <div>support@dreamsyatri.com</div>
                            <div>+91 82199 79481</div>
                        </div>
                    </div>

                    <div className="w-full max-w-xs">
                        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-neutral-600/90">
                            <span>Hotels confirmed</span>
                            <span className="font-medium text-neutral-700">{hotels.filter((h) => h.isConfirmed).length}/{hotels.length}</span>
                        </div>
                        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-neutral-600/90">
                            <span>Cabs confirmed</span>
                            <span className="font-medium text-neutral-700">{cabs.filter((c) => c.isConfirmed).length}/{cabs.length}</span>
                        </div>
                        <div className={`mt-2 flex items-center justify-between rounded-md px-3 py-2.5 ${allConfirmed ? "bg-primary-500" : "bg-neutral-700"}`}>
                            <span className="text-sm font-bold text-white">Overall Status</span>
                            <span className="text-sm font-bold text-white">{allConfirmed ? "Fully Confirmed" : "In Progress"}</span>
                        </div>
                    </div>
                </div>

                {/* ── Signature / footer ── */}
                <div className="px-10 mt-10 flex items-end justify-between">
                    <p className="max-w-xs text-[11px] text-neutral-600/90 leading-relaxed">
                        Please present this voucher (printed or digital) at check-in / pickup. For any changes, contact our support team.
                    </p>
                    <div className="text-center">
                        <div className="text-xl italic text-neutral-900" style={{ fontFamily: "cursive" }}>Dreams Yatri</div>
                        <div className="mt-1 border-t border-neutral-300 pt-1 text-xs text-neutral-600/90">Operations Team</div>
                    </div>
                </div>

                <div className="mt-8 border-t border-neutral-200 px-10 py-5 flex items-center justify-between text-[11px] text-neutral-600/90">
                    <span>support@dreamsyatri.com · +91 82199 79481</span>
                    <DyLogo className="h-4 text-primary-500" />
                </div>
            </div>

            <PrintVoucherButton />
        </div>
    );
}
