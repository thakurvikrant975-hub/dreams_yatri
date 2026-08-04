import { Phone, Mail, Star } from "lucide-react";
import DyLogo from "@/app/components/ui/DyLogo";
import type { VoucherData, VoucherDay } from "@/app/lib/voucher";

/**
 * The printable trip voucher, shared by the customer route
 * (/bookings/[id]/voucher) and the ops route
 * (/dashboard/package-bookings/[id]/voucher) so both send out the same
 * document — a voucher a guest queries at check-in has to match the one ops is
 * looking at on the phone.
 *
 * Sized for A4 and expected to run to several pages: the page box is declared
 * in `@page`, section blocks and table rows carry break-inside: avoid so a stay
 * or a policy is never sliced across the fold, and `thead` repeats on every
 * page via table-header-group. Saving as PDF is the browser's own print-to-PDF —
 * same route the invoice takes.
 */

const SUPPORT_PHONE = "+91 82199 79481";
const SUPPORT_EMAIL = "support@dreamsyatri.com";

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

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-700">{children}</div>;
}

/** Table chrome used by all three tables, so they read as one document. */
function TableFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-lg ring-[0.1em] ring-inset ring-neutral-300/80 overflow-hidden p-[0.1em] bg-white">
            <table className="w-full text-sm border-collapse rounded-md overflow-hidden">{children}</table>
        </div>
    );
}

function Stars({ count }: { count: number }) {
    return (
        <span className="inline-flex items-center gap-px align-middle">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    className={`size-2.5 ${i < count ? "fill-amber-400 text-amber-400" : "fill-neutral-200 text-neutral-200"}`}
                />
            ))}
        </span>
    );
}

// ── Day-by-day itinerary ──────────────────────────────────────────────────────

function ItineraryTable({ days }: { days: VoucherDay[] }) {
    return (
        <TableFrame>
            <thead className="print:table-header-group">
                <tr className="bg-primary-500 text-white">
                    <th className="text-left font-semibold px-3 py-2.5 w-16">Day</th>
                    <th className="text-left font-semibold px-3 py-2.5">Title</th>
                    <th className="text-left font-semibold px-3 py-2.5">Hotel</th>
                    <th className="text-left font-semibold px-3 py-2.5">Meals</th>
                    <th className="text-left font-semibold px-3 py-2.5">Activities</th>
                </tr>
            </thead>
            <tbody>
                {days.map((d, i) => (
                    <tr key={d.day} className={`break-inside-avoid align-top ${i % 2 === 1 ? "bg-neutral-50" : ""}`}>
                        <td className="px-3 py-3">
                            <div className="text-xs font-bold text-primary-600">Day {d.day}</div>
                            {d.date && <div className="text-[10px] text-neutral-500 mt-0.5">{fmtDate(d.date)}</div>}
                        </td>
                        <td className="px-3 py-3 font-medium text-neutral-900">{d.title}</td>
                        <td className="px-3 py-3 text-neutral-700">
                            {d.hotelName ? (
                                <>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>{d.hotelName}</span>
                                        {d.hotelStars !== null && <Stars count={d.hotelStars} />}
                                    </div>
                                    {d.roomLabel && <div className="text-[11px] text-neutral-500 mt-0.5">{d.roomLabel}</div>}
                                </>
                            ) : (
                                "—"
                            )}
                        </td>
                        <td className="px-3 py-3 text-neutral-700">{d.meals.length > 0 ? d.meals.join(", ") : d.mealPlan ?? "—"}</td>
                        <td className="px-3 py-3 text-neutral-700">{d.activities.length > 0 ? d.activities.join(", ") : "—"}</td>
                    </tr>
                ))}
            </tbody>
        </TableFrame>
    );
}

// ── Inclusions / exclusions / policies ────────────────────────────────────────

function BulletList({ items, marker }: { items: string[]; marker: "check" | "cross" }) {
    return (
        <ul className="space-y-1.5">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-neutral-700">
                    <span className={`mt-1 shrink-0 font-bold ${marker === "check" ? "text-green-600" : "text-red-500"}`}>
                        {marker === "check" ? "✓" : "✕"}
                    </span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

// ── Document ──────────────────────────────────────────────────────────────────

export default function VoucherDocument({
    data,
    actions,
}: {
    data: VoucherData;
    /** Print/download control — rendered under the sheet, inside the page chrome
     *  so it sits on the grey backdrop rather than below it. Carries `.no-print`. */
    actions?: React.ReactNode;
}) {
    const { hotels, cabs } = data;

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

    const hasItinerary = data.isPackage && data.days.length > 0;
    const hasInclusions = data.isPackage && (data.inclusions.length > 0 || data.exclusions.length > 0);
    const hasPolicies = data.isPackage && data.policies.length > 0;

    return (
        <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
            {/* A4 with a 12mm box. The document is expected to overflow onto
                further pages; only the break rules keep it readable when it does. */}
            <style>{`
                @page { size: A4; margin: 12mm; }
                @media print {
                    .no-print { display: none !important; }
                    .voucher-sheet { width: auto !important; box-shadow: none !important; }
                }
            `}</style>

            <div className="voucher-sheet mx-auto w-[210mm] max-w-full bg-white shadow-lg print:shadow-none rounded-sm overflow-hidden">
                {/* ── Header ── */}
                <div className="flex items-start justify-between px-10 pt-10 pb-6">
                    <div>
                        <DyLogo className="h-11.5 text-primary-500" />
                        <div className="mt-1.5 text-[11px] text-neutral-600/90">Curated Holiday Experiences</div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-bold tracking-[0.15em] text-neutral-700">VOUCHER</div>
                        <div className="mt-0.5 text-[11px] text-neutral-400">
                            {data.isPackage ? "Trip Itinerary & Confirmation" : "Hotel & Transport Confirmation"}
                        </div>
                    </div>
                </div>
                <div className="h-0.75 bg-linear-to-r from-primary-600 to-primary-400" />

                {/* ── Meta row (voucher no. / date / voucher to) ── */}
                <div className="flex flex-wrap items-start justify-between gap-4 px-10 py-6 text-sm">
                    <div className="flex gap-10">
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Voucher No.</div>
                            <div className="mt-0.5 font-semibold text-neutral-900">{data.bookingNumber}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Date</div>
                            <div className="mt-0.5 font-semibold text-neutral-900">{fmtDate(data.createdAt)}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Voucher To</div>
                        <div className="mt-0.5 font-semibold text-neutral-900">{data.guestName}</div>
                        {data.guestContact && <div className="text-xs text-neutral-800">{data.guestContact}</div>}
                    </div>
                </div>

                {/* ── Trip summary strip ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-10 pb-6">
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-neutral-600/90">Trip</div>
                        <div className="mt-0.5 text-lg font-bold text-neutral-900">{data.tripTitle}</div>
                        <div className="text-xs text-neutral-800 mt-0.5">
                            {fmtDate(data.startDate)} – {fmtDate(data.endDate)} · {data.duration} day{data.duration !== 1 ? "s" : ""} · {data.travellers} traveller{data.travellers !== 1 ? "s" : ""}
                            {data.stayLabel ? ` · ${data.stayLabel}` : ""}
                        </div>
                    </div>
                    <div className="space-y-1.5 text-xs">
                        <ContactRow icon={Phone}>{SUPPORT_PHONE}</ContactRow>
                        <ContactRow icon={Mail}>{SUPPORT_EMAIL}</ContactRow>
                    </div>
                </div>

                {/* ── Day-by-day itinerary ── */}
                {hasItinerary && (
                    <div className="px-10 mb-8">
                        <SectionTitle>Day-by-Day Summary</SectionTitle>
                        <ItineraryTable days={data.days} />
                    </div>
                )}

                {/* ── Hotel table ── */}
                <div className="px-10">
                    <SectionTitle>Accommodation</SectionTitle>
                    <TableFrame>
                        <thead className="print:table-header-group">
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
                                    <tr key={first.dayNumber} className={`break-inside-avoid ${i % 2 === 1 ? "bg-neutral-50" : ""}`}>
                                        <td className="px-3 py-3 align-top">
                                            <div className="font-semibold text-neutral-900">{first.hotel.name}</div>
                                            <div className="text-xs text-neutral-700">{[first.hotel.city ?? first.cityName, first.hotel.state].filter(Boolean).join(", ")}</div>
                                            <div className="mt-1"><StatusBadge isConfirmed={first.isConfirmed} status={first.status} /></div>
                                        </td>
                                        <td className="px-3 py-3 align-top text-neutral-800 text-sm font-semibold">{first.roomType || "—"}{first.roomsCount > 1 ? ` × ${first.roomsCount}` : ""}</td>
                                        <td className="px-3 py-3 align-top text-right text-neutral-600/90">{fmtDate(first.checkInDate)}</td>
                                        <td className="px-3 py-3 align-top text-right text-neutral-600/90">{fmtDate(last.checkOutDate)}</td>
                                        <td className="px-3 py-3 align-top text-right font-semibold text-neutral-700">{nightsBetween(first.checkInDate, last.checkOutDate)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </TableFrame>
                </div>

                {/* ── Cab table ── */}
                <div className="px-10 mt-8">
                    <SectionTitle>Transportation</SectionTitle>
                    <TableFrame>
                        <thead className="print:table-header-group">
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
                                    <tr key={first.legNumber} className={`break-inside-avoid ${i % 2 === 1 ? "bg-neutral-50" : ""}`}>
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
                    </TableFrame>
                </div>

                {/* ── Inclusions / Exclusions ── */}
                {hasInclusions && (
                    <div className="px-10 mt-8 break-inside-avoid">
                        <div className="grid grid-cols-2 gap-8">
                            {data.inclusions.length > 0 && (
                                <div>
                                    <SectionTitle>Inclusions</SectionTitle>
                                    <BulletList items={data.inclusions} marker="check" />
                                </div>
                            )}
                            {data.exclusions.length > 0 && (
                                <div>
                                    <SectionTitle>Exclusions</SectionTitle>
                                    <BulletList items={data.exclusions} marker="cross" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Policies ── */}
                {hasPolicies && (
                    <div className="px-10 mt-8">
                        <SectionTitle>Package Policies</SectionTitle>
                        <div className="space-y-4">
                            {data.policies.map((policy, i) => (
                                <div key={i} className="break-inside-avoid rounded-lg bg-neutral-50 px-4 py-3 ring-1 ring-inset ring-neutral-200">
                                    <div className="text-xs font-semibold text-neutral-900">{policy.title}</div>
                                    <ul className="mt-1.5 space-y-1">
                                        {policy.points.map((point, j) => (
                                            <li key={j} className="flex items-start gap-2 text-[11px] leading-relaxed text-neutral-700">
                                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary-400" />
                                                <span>{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Need-assistance box + confirmed-count summary ── */}
                <div className="mt-8 flex flex-wrap items-start justify-between gap-6 px-10 break-inside-avoid">
                    <div className="max-w-65">
                        <div className="text-xs font-bold uppercase tracking-wide text-neutral-700">Need Assistance?</div>
                        <div className="mt-2 space-y-1 text-xs text-neutral-600/90">
                            <div className="font-semibold text-neutral-700">Dreams Yatri Operations</div>
                            <div>{SUPPORT_EMAIL}</div>
                            <div>{SUPPORT_PHONE}</div>
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
                <div className="px-10 mt-10 flex items-end justify-between break-inside-avoid">
                    <p className="max-w-xs text-[11px] text-neutral-600/90 leading-relaxed">
                        Please present this voucher (printed or digital) at check-in / pickup. For any changes, contact our support team.
                    </p>
                    <div className="text-center">
                        <div className="text-xl italic text-neutral-900" style={{ fontFamily: "cursive" }}>Dreams Yatri</div>
                        <div className="mt-1 border-t border-neutral-300 pt-1 text-xs text-neutral-600/90">Operations Team</div>
                    </div>
                </div>

                <div className="mt-8 border-t border-neutral-200 px-10 py-5 flex items-center justify-between text-[11px] text-neutral-600/90">
                    <span>{SUPPORT_EMAIL} · {SUPPORT_PHONE}</span>
                    <DyLogo className="h-4 text-primary-500" />
                </div>
            </div>

            {actions}
        </div>
    );
}
