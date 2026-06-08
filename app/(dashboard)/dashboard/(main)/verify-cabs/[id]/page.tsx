import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Car, CheckCircle2, Clock, Mail, MapPin, Phone, Users } from "lucide-react";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import { PaymentPill, StatusPill } from "../../package-bookings/pills";
import CabConfirmPanel from "./CabConfirmPanel";

export const metadata: Metadata = {
    title: "Cab Verification - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// ── Snapshot types ────────────────────────────────────────────────────────────
type SnapTransfer = {
    id?: number;
    pickup_name?: string | null;
    drop_name?: string | null;
    vehicle_name?: string | null;
};
type SnapCab = {
    day_from: number; day_to: number;
    vehicle_name?: string; vehicle_capacity?: number;
    cab_type_id?: number; vehicle_id?: number;
    pricing_type?: string; price_used?: number; total?: number;
    km?: number; days?: number; destination_name?: string; upgraded?: boolean;
};
type SnapDay = {
    day: number; day_title?: string; day_date?: string | null;
    transfers?: SnapTransfer[];
};
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

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
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// ── Sidebar helpers (same pattern as verify-hotels) ───────────────────────────
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

export default async function VerifyCabDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true,
            startDate: true, endDate: true, duration: true, travellers: true, createdAt: true,
            totalAmount_paise: true, contactEmail: true, contactPhone: true, cabType: true,
            destinationId: true, priceSnapshot: true,
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

    const snapshot   = (booking.priceSnapshot ?? {}) as Snapshot;
    const allDays    = snapshot.days ?? [];
    const cabSegs    = snapshot.cab_segments ?? [];

    // Days that have transfers
    const transferDays = allDays.filter((d) => (d.transfers ?? []).length > 0);

    const confirmedMap = new Map(booking.cabBookings.map((cb) => [cb.legNumber, cb]));

    const totalCount     = transferDays.length;
    const confirmedCount = transferDays.filter((d) => confirmedMap.get(d.day)?.isConfirmed).length;
    const pct            = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;
    const allDone        = pct === 100 && totalCount > 0;

    // Helper: find the segment for a given day
    function segForDay(day: number): SnapCab | undefined {
        return cabSegs.find((s) => day >= s.day_from && day <= s.day_to);
    }

    // Day date from startDate + offset
    const startMs = booking.startDate.getTime();
    function dayDate(day: number): Date {
        return new Date(startMs + (day - 1) * 86_400_000);
    }

    return (
        <div className="flex flex-col gap-5">
            <Link href="/dashboard/verify-cabs" className="text-sm text-dashboard-neutral hover:text-dashboard-primary cursor-pointer transition-colors">
                ← Back to verify cabs
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
                        ? "✓ All transfers confirmed — booking will advance to Cab Confirmed."
                        : `${totalCount - confirmedCount} transfer${totalCount - confirmedCount !== 1 ? "s" : ""} still need confirmation`}
                </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                {/* ── Cab day cards ────────────────────────────────────────── */}
                <div className="lg:col-span-2 flex flex-col gap-3">
                    {totalCount === 0 ? (
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral">
                            No cab transfers found in the booking itinerary snapshot.
                        </div>
                    ) : (
                        transferDays.map((d) => {
                            const transfers = d.transfers ?? [];
                            const seg       = segForDay(d.day);
                            const confirmed = confirmedMap.get(d.day);
                            const isDone    = confirmed?.isConfirmed ?? false;
                            const date      = d.day_date ? new Date(`${d.day_date}T00:00:00`) : dayDate(d.day);

                            const from = confirmed?.fromLocation ?? transfers[0]?.pickup_name ?? "—";
                            const to   = confirmed?.toLocation   ?? transfers[transfers.length - 1]?.drop_name ?? "—";

                            return (
                                <div
                                    key={d.day}
                                    className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden"
                                >
                                    {/* Top bar */}
                                    <div className="flex items-center justify-between px-4 py-2 border-b bg-dashboard-base-200 border-dashboard-base-300">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="shrink-0 rounded bg-dashboard-primary px-2 py-0.5 text-[11px] font-bold text-dashboard-primary-content">
                                                Day {d.day}
                                            </span>
                                            <span className="text-sm font-medium text-dashboard-base-content truncate">
                                                {d.day_title ?? `Day ${d.day}`}
                                            </span>
                                            <span className="shrink-0 text-xs text-dashboard-neutral">· {fmtDate(date)}</span>
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
                                        {/* Route */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span className="shrink-0 flex size-7 items-center justify-center rounded-full bg-dashboard-primary/10">
                                                    <Car className="size-3.5 text-dashboard-primary" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-dashboard-base-content truncate">
                                                        {from}
                                                    </p>
                                                    <p className="text-xs text-dashboard-neutral mt-0.5 flex items-center gap-1">
                                                        <span>→</span>
                                                        <span className="truncate">{to}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Cab type chip */}
                                            <span className="shrink-0 rounded-md border border-dashboard-base-300 bg-dashboard-base-200/60 px-2.5 py-1 text-xs font-medium text-dashboard-base-content">
                                                {seg?.vehicle_name ?? titleCase(booking.cabType)}
                                            </span>
                                        </div>

                                        {/* Segment info */}
                                        {seg && (
                                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/60 px-3 py-2.5">
                                                <p className="text-[10px] uppercase tracking-widest text-dashboard-neutral font-semibold mb-2">
                                                    Cab Details &nbsp;·&nbsp; {booking.travellers} guest{booking.travellers !== 1 ? "s" : ""}
                                                </p>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-dashboard-base-content">
                                                    {seg.vehicle_name && (
                                                        <span>🚗 {seg.vehicle_name}{seg.upgraded ? " (upgraded)" : ""}</span>
                                                    )}
                                                    {seg.vehicle_capacity && (
                                                        <span>👤 {seg.vehicle_capacity}-seater</span>
                                                    )}
                                                    {seg.total != null && seg.total > 0 && (
                                                        <span className="font-semibold">
                                                            {seg.pricing_type === "PER_KM"
                                                                ? `${inr(seg.price_used ?? 0)}/km × ${seg.km ?? "?"}km = ${inr(seg.total)}`
                                                                : `${inr(seg.total)}`}
                                                        </span>
                                                    )}
                                                    {seg.destination_name && (
                                                        <span className="text-dashboard-neutral">📍 {seg.destination_name}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Multiple transfer stops on this day */}
                                        {transfers.length > 1 && (
                                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/60 px-3 py-2.5">
                                                <p className="text-[10px] uppercase tracking-widest text-dashboard-neutral font-semibold mb-2">Transfer Stops</p>
                                                <div className="flex flex-col gap-1">
                                                    {transfers.map((t, i) => (
                                                        <div key={i} className="flex items-center gap-2 text-xs">
                                                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/15 text-[9px] font-bold text-dashboard-primary">
                                                                {i + 1}
                                                            </span>
                                                            <span className="text-dashboard-base-content">{t.pickup_name ?? "—"}</span>
                                                            <span className="text-dashboard-neutral">→</span>
                                                            <span className="text-dashboard-base-content">{t.drop_name ?? "—"}</span>
                                                            {t.vehicle_name && (
                                                                <span className="ml-auto text-dashboard-neutral">· {t.vehicle_name}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Confirmed banner */}
                                        {isDone && confirmed && (
                                            <div className="rounded-lg border border-dashboard-success/25 bg-dashboard-success/8 px-3 py-2 text-xs text-dashboard-success">
                                                <span className="font-semibold">Confirmed</span> by {confirmed.confirmedBy?.name ?? "—"} · {fmtDateTime(confirmed.confirmedAt)}
                                                {(confirmed.driverName || confirmed.driverPhone || confirmed.vehicleNumber) && (
                                                    <p className="mt-1 opacity-90">
                                                        {[
                                                            confirmed.driverName    ? `Driver: ${confirmed.driverName}`       : null,
                                                            confirmed.driverPhone   ? `📞 ${confirmed.driverPhone}`           : null,
                                                            confirmed.vehicleNumber ? `🚗 ${confirmed.vehicleNumber}`        : null,
                                                        ].filter(Boolean).join("  ·  ")}
                                                    </p>
                                                )}
                                                {confirmed.notes && <p className="mt-0.5 opacity-80">Note: {confirmed.notes}</p>}
                                            </div>
                                        )}

                                        {/* Confirm form */}
                                        {!isDone && (
                                            <CabConfirmPanel
                                                bookingId={booking.id}
                                                legNumber={d.day}
                                                fromLocation={from}
                                                toLocation={to}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <div className="flex flex-col gap-4">

                    {/* Booking Details */}
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

                    {/* Cab Checklist */}
                    {totalCount > 0 && (
                        <SideCard title="Transfer Checklist">
                            <div className="flex flex-col gap-1">
                                {transferDays.map((d) => {
                                    const c      = confirmedMap.get(d.day);
                                    const done   = c?.isConfirmed ?? false;
                                    const from   = c?.fromLocation ?? d.transfers?.[0]?.pickup_name ?? "—";
                                    const to     = c?.toLocation   ?? d.transfers?.[d.transfers.length - 1]?.drop_name ?? "—";
                                    return (
                                        <div
                                            key={d.day}
                                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${
                                                done
                                                    ? "bg-green-50 border border-green-100"
                                                    : "bg-dashboard-base-200/50 border border-dashboard-base-300/40"
                                            }`}
                                        >
                                            <div className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                                                done ? "bg-green-200 text-green-800" : "bg-dashboard-base-300/70 text-dashboard-neutral"
                                            }`}>
                                                {done ? "✓" : d.day}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-medium text-dashboard-base-content">
                                                    {from} → {to}
                                                </p>
                                                <p className="text-[10px] text-dashboard-neutral">Day {d.day}</p>
                                            </div>
                                            <span className={`shrink-0 text-[10px] font-semibold ${done ? "text-green-700" : "text-amber-600"}`}>
                                                {done ? "Done" : "Pending"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Mini progress */}
                            <div className="mt-3 pt-3 border-t border-dashboard-base-300/50">
                                <div className="flex items-center justify-between mb-1.5 text-xs">
                                    <span className="text-dashboard-neutral">Progress</span>
                                    <span className={`font-semibold ${allDone ? "text-green-700" : "text-dashboard-neutral"}`}>{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-dashboard-base-300/60 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${allDone ? "bg-green-500" : pct > 50 ? "bg-amber-400" : "bg-red-400"}`}
                                        style={{ width: `${pct}%` }}
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
