import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Car, CheckCircle2, Clock, Mail, MapPin, Phone, Users } from "lucide-react";
import { db } from "@/app/lib/db";
import { formatPaiseRoundedUp } from "@/app/lib/money";
import { PaymentPill, StatusPill } from "../../package-bookings/pills";
import CabConfirmPanel from "./CabConfirmPanel";
import BulkCabConfirmPanel from "./BulkCabConfirmPanel";

export const metadata: Metadata = {
    title: "Cab Verification - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

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

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden shadow-lg">
            <div className="border-b border-dashboard-base-300 bg-dashboard-base-content px-4 py-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-dashboard-base-100">{title}</h3>
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

    const transferDays = allDays.filter((d) => (d.transfers ?? []).length > 0);
    const confirmedMap = new Map(booking.cabBookings.map((cb) => [cb.legNumber, cb]));

    const totalCount     = transferDays.length;
    const confirmedCount = transferDays.filter((d) => confirmedMap.get(d.day)?.isConfirmed).length;
    const pct            = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 100) : 0;
    const allDone        = pct === 100 && totalCount > 0;

    function segForDay(day: number): SnapCab | undefined {
        return cabSegs.find((s) => day >= s.day_from && day <= s.day_to);
    }

    // `seg.total` is the WHOLE segment's cost (a segment can span several
    // consecutive days behind one vehicle), not any single day's share — so
    // it can't be used as-is per day. Split it evenly across the segment's
    // day span to get this day's own slice (matches `seg.price_used`, the
    // already-per-day rate, for the common PER_DAY case).
    function segDayCost(seg: SnapCab | undefined): number {
        if (!seg?.total) return 0;
        const spanDays = Math.max(1, seg.day_to - seg.day_from + 1);
        return seg.total / spanDays;
    }

    const startMs = booking.startDate.getTime();
    function dayDate(day: number): Date {
        return new Date(startMs + (day - 1) * 86_400_000);
    }

    const pendingLegs = transferDays
        .filter((d) => !(confirmedMap.get(d.day)?.isConfirmed))
        .map((d) => {
            const seg = segForDay(d.day);
            const date = d.day_date ? new Date(`${d.day_date}T00:00:00`) : dayDate(d.day);
            return {
                day: d.day,
                from: d.transfers?.[0]?.pickup_name ?? "—",
                to: d.transfers?.[d.transfers.length - 1]?.drop_name ?? "—",
                dateISO: date.toISOString().split("T")[0],
                km: seg?.km ?? 0,
                baselineTotal: segDayCost(seg),
            };
        });

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
            <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-3.5 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-dashboard-base-content">Verification Progress</span>
                    <span className={`text-sm font-medium ${allDone ? "text-dashboard-success" : "text-dashboard-error"}`}>
                        {confirmedCount} / {totalCount} verified
                    </span>
                </div>
                <div className="h-2 rounded-full bg-dashboard-base-300 overflow-hidden">
                    <div
                        className={`h-2 rounded-full transition-all duration-500 ${allDone ? "bg-dashboard-success" : "bg-dashboard-error"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${allDone ? "text-dashboard-success" : "text-dashboard-error"}`}>
                    {allDone
                        ? <><CheckCircle2 className="size-3.5" /> All transfers verified — booking will advance to Cab Confirmed.</>
                        : <><Clock className="size-3.5" /> {totalCount - confirmedCount} transfer{totalCount - confirmedCount !== 1 ? "s" : ""} still need verification</>
                    }
                </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                {/* ── Cab day cards ─────────────────────────────────────────── */}
                <div className="lg:col-span-2 flex flex-col gap-3">

                    {pendingLegs.length > 0 && (
                        <BulkCabConfirmPanel
                            bookingId={booking.id}
                            pendingLegs={pendingLegs}
                            destinationId={booking.destinationId}
                        />
                    )}

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
                                    className={`rounded-xl overflow-hidden shadow-lg border ${isDone ? "border-green-200" : "border-amber-200"}`}
                                >
                                    {/* Top bar */}
                                    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                                        isDone ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
                                    }`}>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className={`shrink-0 rounded-md px-2.5 py-0.5 text-xs font-bold ${
                                                isDone ? "bg-green-600 text-white" : "bg-amber-500 text-white"
                                            }`}>
                                                Day {d.day}
                                            </span>
                                            <span className="text-sm font-semibold text-dashboard-base-content truncate">
                                                {d.day_title ?? `Day ${d.day}`}
                                            </span>
                                            <span className={`shrink-0 text-xs font-medium ${isDone ? "text-green-700" : "text-amber-700"}`}>
                                                · {fmtDate(date)}
                                            </span>
                                        </div>
                                        {isDone ? (
                                            <span className="shrink-0 ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                                                <CheckCircle2 className="size-3" /> Cab Verified
                                            </span>
                                        ) : (
                                            <span className="shrink-0 ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                                                <Clock className="size-3" /> Pending
                                            </span>
                                        )}
                                    </div>

                                    <div className="px-4 py-3 flex flex-col gap-3 bg-white">
                                        {/* Route */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex items-center gap-3">
                                                <div className="mt-0.5 shrink-0 rounded-md bg-blue-50 p-1.5 text-blue-600">
                                                    <Car className="size-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-dashboard-base-content">{from}</p>
                                                    <p className="flex items-center gap-1 mt-0.5 text-xs text-dashboard-neutral">
                                                        <span>→</span>
                                                        <span className="truncate">{to}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="shrink-0 rounded border border-dashboard-base-300 bg-dashboard-base-200 px-1.5 py-0.5 text-[10px] font-medium text-dashboard-neutral uppercase tracking-wide">
                                                {seg?.vehicle_name ?? titleCase(booking.cabType)}
                                            </span>
                                        </div>

                                        {/* Cab segment details */}
                                        {seg && (
                                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/60 px-3 py-2.5">
                                                <p className="text-[10px] uppercase tracking-widest text-dashboard-neutral font-semibold mb-2">
                                                    Cab Details &nbsp;·&nbsp; {booking.travellers} guest{booking.travellers !== 1 ? "s" : ""}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {seg.vehicle_name && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 py-0.5 text-xs text-dashboard-base-content">
                                                            <Car className="size-3" /> {seg.vehicle_name}{seg.upgraded ? " (upgraded)" : ""}
                                                        </span>
                                                    )}
                                                    {seg.vehicle_capacity && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 py-0.5 text-xs text-dashboard-base-content">
                                                            <Users className="size-3" /> {seg.vehicle_capacity}-seater
                                                        </span>
                                                    )}
                                                    {seg.destination_name && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-dashboard-base-300 bg-dashboard-base-100 px-2.5 py-0.5 text-xs text-dashboard-base-content">
                                                            <MapPin className="size-3" /> {seg.destination_name}
                                                        </span>
                                                    )}
                                                </div>
                                                {seg.total != null && seg.total > 0 && (
                                                    <div className="mt-2 flex items-center justify-between rounded bg-dashboard-base-100/80 px-2.5 py-1.5 text-sm">
                                                        <span className="text-xs text-dashboard-neutral">
                                                            {seg.pricing_type === "PER_KM"
                                                                ? `${inr(seg.price_used ?? 0)}/km × ${seg.km ?? "?"}km`
                                                                : `Fixed price${seg.day_to > seg.day_from ? " (this day)" : ""}`}
                                                        </span>
                                                        <span className="font-semibold text-dashboard-base-content">
                                                            {inr(seg.pricing_type === "PER_KM" ? seg.total : segDayCost(seg))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Multiple transfer stops */}
                                        {transfers.length > 1 && (
                                            <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-200/60 px-3 py-2.5">
                                                <p className="text-[10px] uppercase tracking-widest text-dashboard-neutral font-semibold mb-2">Transfer Stops</p>
                                                <div className="flex flex-col gap-1.5">
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
                                            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800">
                                                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-green-600" />
                                                <div>
                                                    <span className="font-semibold">Cab Verified</span> by {confirmed.confirmedBy?.name ?? "—"} · {fmtDateTime(confirmed.confirmedAt)}
                                                    {(confirmed.driverName || confirmed.driverPhone || confirmed.vehicleNumber) && (
                                                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 opacity-90">
                                                            {confirmed.driverName    && <span className="flex items-center gap-1"><Users className="size-3" />{confirmed.driverName}</span>}
                                                            {confirmed.driverPhone   && <span className="flex items-center gap-1"><Phone className="size-3" />{confirmed.driverPhone}</span>}
                                                            {confirmed.vehicleNumber && <span className="flex items-center gap-1"><Car className="size-3" />{confirmed.vehicleNumber}</span>}
                                                        </p>
                                                    )}
                                                    {confirmed.notes && <p className="mt-0.5 text-green-700">Note: {confirmed.notes}</p>}
                                                </div>
                                            </div>
                                        )}

                                        {/* Confirm form */}
                                        {!isDone && (
                                            <CabConfirmPanel
                                                bookingId={booking.id}
                                                legNumber={d.day}
                                                fromLocation={from}
                                                toLocation={to}
                                                destinationId={booking.destinationId}
                                                legDateISO={date.toISOString().split("T")[0]}
                                                currentVehicleName={seg?.vehicle_name ?? titleCase(booking.cabType)}
                                                baselineRate={seg?.price_used ?? 0}
                                                baselineTotal={segDayCost(seg)}
                                                pricingType={seg?.pricing_type === "PER_KM" ? "PER_KM" : "PER_DAY"}
                                                km={seg?.km ?? 0}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ── Sidebar ───────────────────────────────────────────────── */}
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
                                <span className="text-sm font-bold text-dashboard-base-content">{formatPaiseRoundedUp(booking.totalAmount_paise)}</span>
                            </div>
                        </div>
                    </SideCard>

                    {totalCount > 0 && (
                        <SideCard title="Transfer Checklist">
                            <div className="flex flex-col gap-1">
                                {transferDays.map((d) => {
                                    const c    = confirmedMap.get(d.day);
                                    const done = c?.isConfirmed ?? false;
                                    const f    = c?.fromLocation ?? d.transfers?.[0]?.pickup_name ?? "—";
                                    const t    = c?.toLocation   ?? d.transfers?.[d.transfers.length - 1]?.drop_name ?? "—";
                                    return (
                                        <div
                                            key={d.day}
                                            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 ${
                                                done
                                                    ? "bg-green-50 border border-green-100"
                                                    : "bg-dashboard-base-200/50 border border-dashboard-base-300/40"
                                            }`}
                                        >
                                            <div className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                                                done ? "bg-green-200 text-green-700" : "bg-dashboard-base-300/70 text-dashboard-neutral"
                                            }`}>
                                                {done
                                                    ? <CheckCircle2 className="size-3.5" />
                                                    : <span className="text-[10px] font-bold">{d.day}</span>}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-medium text-dashboard-base-content">
                                                    {f} → {t}
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
