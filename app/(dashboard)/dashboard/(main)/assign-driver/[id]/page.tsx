import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Car, CheckCircle2, Mail, MapPin, Phone, Users } from "lucide-react";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import { PaymentPill, StatusPill } from "../../package-bookings/pills";
import QuickAssignPanel from "./QuickAssignPanel";
import DriverAssignPanel from "./DriverAssignPanel";
import type { DriverOption, SegmentLeg } from "../actions";

export const metadata: Metadata = {
    title: "Assign Driver - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// ── Snapshot types ──────────────────────────────────────────────────────────────
type SnapTransfer = { pickup_name?: string | null; drop_name?: string | null };
type SnapCab = {
    day_from: number; day_to: number;
    vehicle_name?: string; vehicle_capacity?: number; vehicle_id?: number;
};
type SnapDay = {
    day: number; day_title?: string; day_date?: string | null;
    transfers?: SnapTransfer[];
};
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

// ── Helpers ─────────────────────────────────────────────────────────────────────
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
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
            <div className="border-b border-dashboard-base-300 bg-dashboard-base-200/60 px-4 py-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dashboard-neutral">{title}</h3>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}
function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-dashboard-base-200">
                <Icon className="size-3.5 text-dashboard-neutral" />
            </div>
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-dashboard-neutral">{label}</p>
                <p className="text-sm text-dashboard-base-content">{value}</p>
            </div>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────────
export default async function AssignDriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true,
            startDate: true, endDate: true, duration: true, travellers: true, createdAt: true,
            totalAmount_paise: true, contactEmail: true, contactPhone: true, cabType: true,
            priceSnapshot: true,
            user:        { select: { name: true, email: true } },
            package:     { select: { title: true } },
            destination: { select: { name: true } },
            cabBookings: {
                orderBy: { legNumber: "asc" },
                select: {
                    legNumber: true, isConfirmed: true, confirmedAt: true,
                    fromLocation: true, toLocation: true,
                    driverName: true, driverPhone: true, vehicleNumber: true, notes: true,
                    confirmedBy: { select: { name: true } },
                },
            },
        },
    });

    if (!booking) notFound();

    const snap         = (booking.priceSnapshot ?? {}) as Snapshot;
    const allDays      = snap.days ?? [];
    const cabSegs      = snap.cab_segments ?? [];
    const transferDays = allDays.filter((d) => (d.transfers ?? []).length > 0);

    const confirmedMap = new Map(booking.cabBookings.map((cb) => [cb.legNumber, cb]));
    const startMs      = booking.startDate.getTime();

    function dayDate(day: number): Date {
        return new Date(startMs + (day - 1) * 86_400_000);
    }

    // ── Build segment view ────────────────────────────────────────────────────
    type PageSegment = {
        idx:             number;
        vehicle_name:    string | null;
        vehicle_id:      number | null;
        day_from:        number;
        day_to:          number;
        legs:            SegmentLeg[];
        legDetails: {
            legNumber: number; from: string; to: string; date: Date;
            driverName: string | null; driverPhone: string | null;
            vehicleNumber: string | null; confirmedBy: string | null;
        }[];
        assignedDriver: { name: string; phone: string | null; vehicleNumber: string | null; confirmedBy: string | null } | null;
        isFullyAssigned: boolean;
    };

    const coveredDays = new Set<number>();
    const segments: PageSegment[] = [];

    for (let si = 0; si < cabSegs.length; si++) {
        const seg      = cabSegs[si];
        const segDays  = transferDays.filter((d) => d.day >= seg.day_from && d.day <= seg.day_to);
        if (segDays.length === 0) continue;
        segDays.forEach((d) => coveredDays.add(d.day));

        const legDetails = segDays.map((d) => {
            const c = confirmedMap.get(d.day);
            return {
                legNumber:    d.day,
                from:         c?.fromLocation ?? d.transfers?.[0]?.pickup_name ?? "—",
                to:           c?.toLocation   ?? d.transfers?.[d.transfers.length - 1]?.drop_name ?? "—",
                date:         d.day_date ? new Date(`${d.day_date}T00:00:00`) : dayDate(d.day),
                driverName:   c?.driverName   ?? null,
                driverPhone:  c?.driverPhone  ?? null,
                vehicleNumber: c?.vehicleNumber ?? null,
                confirmedBy:  c?.confirmedBy?.name ?? null,
            };
        });

        const firstAssigned = legDetails.find((l) => l.driverName);
        segments.push({
            idx:          si,
            vehicle_name: seg.vehicle_name ?? null,
            vehicle_id:   seg.vehicle_id   ?? null,
            day_from:     seg.day_from,
            day_to:       seg.day_to,
            legs:         legDetails.map((l) => ({ legNumber: l.legNumber, fromLocation: l.from, toLocation: l.to })),
            legDetails,
            assignedDriver: firstAssigned
                ? { name: firstAssigned.driverName!, phone: firstAssigned.driverPhone, vehicleNumber: firstAssigned.vehicleNumber, confirmedBy: firstAssigned.confirmedBy }
                : null,
            isFullyAssigned: segDays.length > 0 && segDays.every((d) => !!confirmedMap.get(d.day)?.driverName),
        });
    }

    // Orphaned transfer days not covered by any segment → put in one fallback segment
    const orphaned = transferDays.filter((d) => !coveredDays.has(d.day));
    if (orphaned.length > 0) {
        const legDetails = orphaned.map((d) => {
            const c = confirmedMap.get(d.day);
            return {
                legNumber:    d.day,
                from:         c?.fromLocation ?? d.transfers?.[0]?.pickup_name ?? "—",
                to:           c?.toLocation   ?? d.transfers?.[d.transfers.length - 1]?.drop_name ?? "—",
                date:         d.day_date ? new Date(`${d.day_date}T00:00:00`) : dayDate(d.day),
                driverName:   c?.driverName   ?? null,
                driverPhone:  c?.driverPhone  ?? null,
                vehicleNumber: c?.vehicleNumber ?? null,
                confirmedBy:  c?.confirmedBy?.name ?? null,
            };
        });
        const firstAssigned = legDetails.find((l) => l.driverName);
        segments.push({
            idx:          segments.length,
            vehicle_name: null,
            vehicle_id:   null,
            day_from:     orphaned[0].day,
            day_to:       orphaned[orphaned.length - 1].day,
            legs:         legDetails.map((l) => ({ legNumber: l.legNumber, fromLocation: l.from, toLocation: l.to })),
            legDetails,
            assignedDriver: firstAssigned
                ? { name: firstAssigned.driverName!, phone: firstAssigned.driverPhone, vehicleNumber: firstAssigned.vehicleNumber, confirmedBy: firstAssigned.confirmedBy }
                : null,
            isFullyAssigned: orphaned.every((d) => !!confirmedMap.get(d.day)?.driverName),
        });
    }

    const totalLegs      = transferDays.length;
    const assignedLegs   = transferDays.filter((d) => !!confirmedMap.get(d.day)?.driverName).length;
    const pct            = totalLegs > 0 ? Math.round((assignedLegs / totalLegs) * 100) : 0;
    const allAssigned    = assignedLegs === totalLegs && totalLegs > 0;

    // ── Fetch drivers ─────────────────────────────────────────────────────────
    const allDriverRows = await db.cab_drivers.findMany({
        where:   { is_active: true },
        select: {
            id: true, name: true, mobile: true, vehicle_id: true,
            vehicle_reg_number: true, city: true, state: true,
            is_verified: true, avg_rating: true,
            vehicle: { select: { id: true, name: true } },
        },
        orderBy: [{ is_verified: "desc" }, { avg_rating: "desc" }, { name: "asc" }],
    });

    const allDriverOptions: (DriverOption & { vehicle_id: number | null })[] = allDriverRows.map((d) => ({
        id: d.id, name: d.name, mobile: d.mobile,
        vehicle_id:        d.vehicle_id,
        vehicle_reg_number: d.vehicle_reg_number,
        city: d.city, state: d.state,
        is_verified: d.is_verified,
        avg_rating:  d.avg_rating != null ? Number(d.avg_rating) : null,
        vehicle:     d.vehicle,
    }));

    // Per-segment filtered drivers
    for (const seg of segments) {
        (seg as PageSegment & { filteredDrivers: DriverOption[] }).filteredDrivers =
            seg.vehicle_id != null
                ? allDriverOptions.filter((d) => d.vehicle_id === seg.vehicle_id)
                : allDriverOptions;
    }

    // Quick-assign: determine vehicle label + driver pool
    const uniqueVehicleIds  = [...new Set(segments.map((s) => s.vehicle_id).filter(Boolean) as number[])];
    const uniqueVehicleNames = [...new Set(segments.map((s) => s.vehicle_name).filter(Boolean) as string[])];
    const quickVehicleLabel  =
        uniqueVehicleNames.length === 1 ? uniqueVehicleNames[0]
        : uniqueVehicleNames.length > 1 ? uniqueVehicleNames.join(" + ")
        : "all vehicle types";

    // For quick assign: if all segments same vehicle type, filter; otherwise all drivers
    const quickDrivers: DriverOption[] =
        uniqueVehicleIds.length === 1
            ? allDriverOptions.filter((d) => d.vehicle_id === uniqueVehicleIds[0])
            : allDriverOptions;

    return (
        <div className="flex flex-col gap-5">
            <Link
                href="/dashboard/assign-driver"
                className="text-sm text-dashboard-neutral hover:text-dashboard-primary transition-colors"
            >
                ← Back to assign drivers
            </Link>

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{booking.bookingNumber}</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">Booked on {fmtDateTime(booking.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill  status={booking.status} />
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
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-3.5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dashboard-base-content">Driver Assignment Progress</span>
                    <span className={`text-sm font-semibold ${allAssigned ? "text-green-600" : "text-dashboard-error"}`}>
                        {assignedLegs} / {totalLegs} legs assigned
                    </span>
                </div>
                <div className="h-2.5 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${allAssigned ? "bg-green-500" : pct > 50 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                </div>
                <p className={`mt-1.5 text-xs ${allAssigned ? "text-green-600 font-medium" : "text-dashboard-neutral"}`}>
                    {allAssigned
                        ? "✓ All drivers assigned. Customer will receive driver details 4–5 days before travel."
                        : `${totalLegs - assignedLegs} leg${totalLegs - assignedLegs !== 1 ? "s" : ""} still need a driver — details shared with customer 4–5 days before travel.`}
                </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">

                {/* ── Left: Quick assign + segments ──────────────────────── */}
                <div className="lg:col-span-2 flex flex-col gap-4">

                    {/* Quick assign — always at top */}
                    {!allAssigned && (
                        <QuickAssignPanel
                            bookingId={booking.id}
                            totalLegs={totalLegs}
                            drivers={quickDrivers}
                            vehicleLabel={quickVehicleLabel}
                        />
                    )}

                    {/* "All done" banner when everything is assigned */}
                    {allAssigned && (
                        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
                            <CheckCircle2 className="size-5 text-green-600 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-green-800">All drivers assigned</p>
                                <p className="text-xs text-green-600 mt-0.5">Use the segment cards below to change or remove any assignment.</p>
                            </div>
                        </div>
                    )}

                    {/* Per-segment cards */}
                    {totalLegs === 0 ? (
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral">
                            No cab transfers found in this booking.
                        </div>
                    ) : (
                        segments.map((seg) => {
                            const segDrivers = (seg as PageSegment & { filteredDrivers: DriverOption[] }).filteredDrivers ?? allDriverOptions;

                            return (
                                <div
                                    key={seg.idx}
                                    className={`rounded-xl border-2 overflow-hidden ${
                                        seg.isFullyAssigned
                                            ? "border-green-200 bg-green-50/20"
                                            : "border-dashboard-base-300 bg-dashboard-base-100"
                                    }`}
                                >
                                    {/* Segment header */}
                                    <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${
                                        seg.isFullyAssigned
                                            ? "bg-green-50 border-green-200"
                                            : "bg-dashboard-base-200 border-dashboard-base-300"
                                    }`}>
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                                                seg.isFullyAssigned ? "bg-green-200" : "bg-dashboard-primary/10"
                                            }`}>
                                                <Car className={`size-4 ${seg.isFullyAssigned ? "text-green-700" : "text-dashboard-primary"}`} />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-dashboard-base-content truncate">
                                                    {seg.vehicle_name ?? "Cab Segment"}
                                                    {segments.length > 1 && (
                                                        <span className="ml-2 text-xs font-normal text-dashboard-neutral">
                                                            · Segment {seg.idx + 1} of {segments.length}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[11px] text-dashboard-neutral">
                                                    Day{seg.day_from !== seg.day_to ? `s ${seg.day_from}–${seg.day_to}` : ` ${seg.day_from}`}
                                                    {" · "}{seg.legs.length} transfer{seg.legs.length !== 1 ? "s" : ""}
                                                </p>
                                            </div>
                                        </div>
                                        {seg.isFullyAssigned ? (
                                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-200 px-2.5 py-0.5 text-[11px] font-bold text-green-800">
                                                <CheckCircle2 className="size-3" /> Assigned
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                                                No driver
                                            </span>
                                        )}
                                    </div>

                                    <div className="px-4 py-3.5 flex flex-col gap-3.5">
                                        {/* Transfer stops list */}
                                        <div className="flex flex-col gap-1.5">
                                            {seg.legDetails.map((leg, li) => (
                                                <div key={leg.legNumber} className="flex items-center gap-2.5 text-sm">
                                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-[10px] font-bold text-dashboard-primary">
                                                        {leg.legNumber}
                                                    </span>
                                                    <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-medium text-dashboard-base-content truncate max-w-35">{leg.from}</span>
                                                        <span className="text-dashboard-neutral text-xs">→</span>
                                                        <span className="text-dashboard-base-content truncate max-w-35">{leg.to}</span>
                                                        <span className="text-dashboard-neutral text-[11px] ml-auto shrink-0">{fmtDate(leg.date)}</span>
                                                    </div>
                                                    {li < seg.legDetails.length - 1 && (
                                                        <div className="absolute left-4.75 h-2 w-px bg-dashboard-base-300" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Assigned driver banner */}
                                        {seg.assignedDriver && (
                                            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5">
                                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-200 text-sm font-bold text-green-800">
                                                    {seg.assignedDriver.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-semibold text-green-800">{seg.assignedDriver.name}</p>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs text-green-700 mt-0.5">
                                                        {seg.assignedDriver.phone        && <span>📞 {seg.assignedDriver.phone}</span>}
                                                        {seg.assignedDriver.vehicleNumber && <span>🚗 {seg.assignedDriver.vehicleNumber}</span>}
                                                        {seg.assignedDriver.confirmedBy   && <span className="opacity-60">by {seg.assignedDriver.confirmedBy}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Driver assign / change panel */}
                                        <DriverAssignPanel
                                            bookingId={booking.id}
                                            legs={seg.legs}
                                            vehicleName={seg.vehicle_name}
                                            drivers={segDrivers}
                                            isFullyAssigned={seg.isFullyAssigned}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ── Sidebar ─────────────────────────────────────────────── */}
                <div className="flex flex-col gap-4">

                    <SideCard title="Booking Details">
                        <div className="flex flex-col gap-3">
                            <InfoItem icon={Users}        label="Customer"     value={booking.user?.name} />
                            <InfoItem icon={Mail}         label="Email"        value={booking.contactEmail ?? booking.user?.email} />
                            <InfoItem icon={Phone}        label="Phone"        value={booking.contactPhone} />
                            <InfoItem icon={Car}          label="Package"      value={booking.package?.title} />
                            <InfoItem icon={MapPin}       label="Destination"  value={booking.destination?.name} />
                            <InfoItem icon={CalendarDays} label="Travel Dates" value={`${fmtDate(booking.startDate)} – ${fmtDate(booking.endDate)}`} />
                            <InfoItem icon={Users}        label="Travellers"   value={`${booking.travellers} pax · ${booking.duration}D`} />
                            <InfoItem icon={Car}          label="Cab Type"     value={titleCase(booking.cabType)} />
                            <div className="mt-1 flex items-center justify-between rounded-lg bg-dashboard-base-200 px-3 py-2.5">
                                <span className="text-xs font-medium text-dashboard-neutral">Total Amount</span>
                                <span className="text-sm font-bold text-dashboard-base-content">{formatPaise(booking.totalAmount_paise)}</span>
                            </div>
                        </div>
                    </SideCard>

                    {/* Segment checklist */}
                    {segments.length > 0 && (
                        <SideCard title={segments.length > 1 ? "Segment Checklist" : "Transfer Checklist"}>
                            <div className="flex flex-col gap-2">
                                {segments.map((seg) => (
                                    <div
                                        key={seg.idx}
                                        className={`rounded-lg px-3 py-2.5 border ${
                                            seg.isFullyAssigned
                                                ? "bg-green-50 border-green-100"
                                                : "bg-dashboard-base-200/50 border-dashboard-base-300/40"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-dashboard-base-content truncate">
                                                    {seg.vehicle_name ?? "Segment"}
                                                </p>
                                                <p className="text-[10px] text-dashboard-neutral">
                                                    Day{seg.day_from !== seg.day_to ? `s ${seg.day_from}–${seg.day_to}` : ` ${seg.day_from}`} · {seg.legs.length} transfer{seg.legs.length !== 1 ? "s" : ""}
                                                </p>
                                                {seg.assignedDriver && (
                                                    <p className="text-[10px] font-semibold text-green-700 mt-0.5 truncate">
                                                        👤 {seg.assignedDriver.name}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`shrink-0 text-[10px] font-bold ${seg.isFullyAssigned ? "text-green-700" : "text-amber-600"}`}>
                                                {seg.isFullyAssigned ? "✓ Done" : "Pending"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t border-dashboard-base-300/50">
                                <div className="flex items-center justify-between mb-1.5 text-xs">
                                    <span className="text-dashboard-neutral">Overall progress</span>
                                    <span className={`font-bold ${allAssigned ? "text-green-700" : "text-dashboard-neutral"}`}>{pct}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-dashboard-base-300/60 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${allAssigned ? "bg-green-500" : pct > 50 ? "bg-amber-400" : "bg-red-400"}`}
                                        style={{ width: `${Math.max(pct, 2)}%` }}
                                    />
                                </div>
                            </div>
                        </SideCard>
                    )}
                </div>
            </div>
        </div>
    );
}
