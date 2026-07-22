import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
    CalendarDays, Mail, MapPin, Phone, Users, IndianRupee,
    Building2, Car, Ticket, CheckCircle2, AlertCircle, Eye, Send,
} from "lucide-react";
import { db } from "@/app/lib/db";
import { VerifyButton } from "./VerifyButton";

export const metadata: Metadata = {
    title: "Package Verification - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// ── Locked pricing snapshot — frozen at send time, see package-builder/action.ts ──
type PricingSnapshot = {
    lockedAt: string;
    currency: string;
    hotel: { subtotal: number; nightsCounted: number; lines: { day: number; hotelName: string; roomName: string; pricePerRoom: number; roomsNeeded: number; mattresses: number; extraBedRate: number; total: number }[] };
    cab: { subtotal: number; daysCounted: number; lines: { day: number; vehicleName: string; pricingType: string; rate: number; distanceKm: number | null; total: number }[] };
    tickets: { subtotal: number; lines: { type: string; provider: string; fromPlace: string; toPlace: string; fare: number | null; ticketCount: number }[] };
    baseCost: number;
    marginPercentage: number;
    hotelCabMarginAmount: number;
    ticketsMarginAmount: number;
    marginAmount: number;
    taxable: number;
    gstPercentage: number;
    gstAmount: number;
    finalPrice: number;
    pricePerPerson: number;
    displayedTotalPrice: number | null;
    displayedPricePerPerson: number | null;
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
const inr = (n: number | null) => n != null ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—";

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

function BreakdownCard({ icon: Icon, title, subtotal, children }: {
    icon: React.ElementType; title: string; subtotal: number; children: React.ReactNode;
}) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden shadow-lg">
            <div className="flex items-center justify-between border-b border-dashboard-base-300 bg-dashboard-base-200/60 px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-semibold text-dashboard-base-content">
                    <Icon className="size-4 text-dashboard-neutral" /> {title}
                </span>
                <span className="text-sm font-bold text-dashboard-base-content">{inr(subtotal)}</span>
            </div>
            <div className="divide-y divide-dashboard-base-300/60">{children}</div>
        </div>
    );
}

export default async function VerifyPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const pkg = await db.custom_packages.findUnique({
        where: { id },
        select: {
            id: true, title: true, destination: true, startingPoint: true,
            totalDays: true, totalNights: true, travelDate: true,
            adults: true, children: true, infants: true,
            pricePerPerson: true, totalPrice: true, currency: true,
            marginPercentage: true, gstPercentage: true,
            status: true, builtByName: true, sentAt: true,
            viewedAt: true, viewCount: true, pricingSnapshot: true,
            verified: true, verifiedAt: true, verifiedByName: true,
            query: {
                select: {
                    id: true, name: true, phone: true, countryCode: true, email: true,
                    message: true, groupSize: true,
                },
            },
        },
    });

    // sentAt is only ever set once a package has a linked query (a "blank"
    // package can't be sent — see sendPackageToClient), so this also
    // guarantees pkg.query below.
    if (!pkg || !pkg.sentAt || !pkg.query) notFound();

    const s = pkg.pricingSnapshot as unknown as PricingSnapshot | null;
    const drifted = s?.displayedTotalPrice != null && Math.round(s.displayedTotalPrice) !== Math.round(s.finalPrice);
    const pax = pkg.adults + pkg.children + pkg.infants;

    return (
        <div className="flex flex-col gap-5">
            <Link href="/dashboard/verify-packages" className="text-sm text-dashboard-neutral hover:text-dashboard-primary cursor-pointer transition-colors">
                ← Back to verify packages
            </Link>

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{pkg.title}</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">
                        Sent {fmtDateTime(pkg.sentAt)} by {pkg.builtByName ?? "—"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {pkg.verified ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">
                            <CheckCircle2 className="size-3.5" /> Verified by {pkg.verifiedByName ?? "—"} · {fmtDateTime(pkg.verifiedAt)}
                        </span>
                    ) : (
                        <VerifyButton packageId={pkg.id} />
                    )}
                </div>
            </div>

            {!s ? (
                <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-5 py-10 text-center text-sm text-dashboard-neutral shadow-lg">
                    No locked pricing snapshot found for this package — nothing to verify yet.
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-3 items-start">
                    {/* ── Pricing breakdown ─────────────────────────────────── */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <p className="text-xs text-dashboard-neutral">
                            Frozen {fmtDateTime(new Date(s.lockedAt))} — the exact hotel/cab/ticket costs behind the price sent to the client.
                        </p>

                        {drifted && s.displayedTotalPrice != null && (
                            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg">
                                <AlertCircle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">Hand-overridden price</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        The exec sent {inr(s.displayedTotalPrice)} instead of the computed {inr(s.finalPrice)}
                                        {" "}({inr(Math.abs(s.displayedTotalPrice - s.finalPrice))} {s.displayedTotalPrice > s.finalPrice ? "higher" : "lower"}).
                                    </p>
                                </div>
                            </div>
                        )}

                        {s.hotel.lines.length > 0 && (
                            <BreakdownCard icon={Building2} title="Hotel" subtotal={s.hotel.subtotal}>
                                {s.hotel.lines.map((l, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                        <div>
                                            <p className="text-dashboard-base-content">Day {l.day}: {l.hotelName} — {l.roomName}</p>
                                            <p className="text-xs text-dashboard-neutral mt-0.5">
                                                {l.roomsNeeded} room{l.roomsNeeded !== 1 ? "s" : ""} × {inr(l.pricePerRoom)}
                                                {l.mattresses > 0 && ` + ${l.mattresses} mattress${l.mattresses !== 1 ? "es" : ""} × ${inr(l.extraBedRate)}`}
                                            </p>
                                        </div>
                                        <span className="font-semibold text-dashboard-base-content shrink-0 ml-3">{inr(l.total)}</span>
                                    </div>
                                ))}
                            </BreakdownCard>
                        )}

                        {s.cab.lines.length > 0 && (
                            <BreakdownCard icon={Car} title="Cab" subtotal={s.cab.subtotal}>
                                {s.cab.lines.map((l, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                        <p className="text-dashboard-base-content">Day {l.day}: {l.vehicleName} ({l.pricingType})</p>
                                        <span className="font-semibold text-dashboard-base-content shrink-0 ml-3">{inr(l.total)}</span>
                                    </div>
                                ))}
                            </BreakdownCard>
                        )}

                        {s.tickets.lines.length > 0 && (
                            <BreakdownCard icon={Ticket} title="Tickets" subtotal={s.tickets.subtotal}>
                                {s.tickets.lines.map((l, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                        <p className="text-dashboard-base-content">
                                            {l.type} {l.provider && `(${l.provider})`}: {l.fromPlace} → {l.toPlace} × {l.ticketCount}
                                        </p>
                                        <span className="font-semibold text-dashboard-base-content shrink-0 ml-3">{l.fare != null ? inr(l.fare) : "—"}</span>
                                    </div>
                                ))}
                            </BreakdownCard>
                        )}

                        {/* Totals */}
                        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-3.5 shadow-lg text-sm space-y-1.5">
                            <div className="flex justify-between"><span className="text-dashboard-neutral">Base cost</span><span className="text-dashboard-base-content">{inr(s.baseCost)}</span></div>
                            <div className="flex justify-between"><span className="text-dashboard-neutral">Margin ({s.marginPercentage}% hotel/cab + 5% tickets)</span><span className="text-dashboard-base-content">{inr(s.marginAmount)}</span></div>
                            <div className="flex justify-between"><span className="text-dashboard-neutral">GST ({s.gstPercentage}%)</span><span className="text-dashboard-base-content">{inr(s.gstAmount)}</span></div>
                            <div className="flex justify-between font-bold border-t border-dashboard-base-300 pt-1.5 mt-1.5">
                                <span className="text-dashboard-base-content">Computed total</span>
                                <span className="text-dashboard-base-content">{inr(s.finalPrice)}</span>
                            </div>
                            <p className="text-xs text-dashboard-neutral">{inr(s.pricePerPerson)} per person</p>
                        </div>
                    </div>

                    {/* ── Sidebar ──────────────────────────────────────────── */}
                    <div className="flex flex-col gap-4">
                        <SideCard title="Client Details">
                            <div className="flex flex-col gap-3">
                                <InfoItem icon={Users}        label="Name"        value={pkg.query.name} />
                                <InfoItem
                                    icon={Phone} label="Phone"
                                    value={
                                        <a href={`tel:+${pkg.query.countryCode}${pkg.query.phone}`} className="text-dashboard-primary hover:underline">
                                            +{pkg.query.countryCode} {pkg.query.phone}
                                        </a>
                                    }
                                />
                                {pkg.query.email && (
                                    <InfoItem
                                        icon={Mail} label="Email"
                                        value={<a href={`mailto:${pkg.query.email}`} className="text-dashboard-primary hover:underline">{pkg.query.email}</a>}
                                    />
                                )}
                                <InfoItem icon={MapPin}       label="Destination"  value={`${pkg.destination}${pkg.startingPoint ? ` (from ${pkg.startingPoint})` : ""}`} />
                                <InfoItem icon={CalendarDays} label="Travel Date"  value={fmtDate(pkg.travelDate)} />
                                <InfoItem icon={Users}        label="Travellers"   value={`${pax} pax · ${pkg.totalDays}D/${pkg.totalNights}N`} />
                                {pkg.query.message && (
                                    <div className="mt-1 rounded-lg bg-dashboard-base-200 border border-dashboard-base-300 px-3 py-2">
                                        <p className="text-xs text-dashboard-base-content/60 italic">&quot;{pkg.query.message}&quot;</p>
                                    </div>
                                )}
                            </div>
                        </SideCard>

                        <SideCard title="Package Status">
                            <div className="flex flex-col gap-3">
                                <InfoItem icon={Send}  label="Sent" value={fmtDateTime(pkg.sentAt)} />
                                <InfoItem
                                    icon={Eye} label="Client Viewed"
                                    value={pkg.viewedAt ? `Yes — ${fmtDate(pkg.viewedAt)} (${pkg.viewCount}×)` : "Not yet"}
                                />
                                <div className="mt-1 flex items-center justify-between rounded-lg bg-dashboard-base-200 px-3 py-2.5">
                                    <span className="text-xs font-medium text-dashboard-neutral flex items-center gap-1"><IndianRupee className="size-3" /> Sent Price</span>
                                    <span className="text-sm font-bold text-dashboard-base-content">{inr(pkg.totalPrice ?? s.finalPrice)}</span>
                                </div>
                            </div>
                        </SideCard>
                    </div>
                </div>
            )}
        </div>
    );
}
