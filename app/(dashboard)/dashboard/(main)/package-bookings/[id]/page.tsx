import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import { PaymentPill, StatusPill } from "../pills";
import BookingAdminActions from "./BookingAdminActions";
import FulfillmentPanel from "./FulfillmentPanel";
import { getBookingFulfillment } from "@/app/services/fulfillment/status.service";

export const metadata: Metadata = {
    title: "Booking detail - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function addNightsISO(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
            <div className="flex items-center justify-between border-b border-dashboard-base-300 px-5 py-3">
                <h2 className="text-sm font-semibold text-dashboard-base-content">{title}</h2>
                {action}
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-dashboard-neutral">{label}</dt>
            <dd className="mt-0.5 text-sm text-dashboard-base-content">{value || "—"}</dd>
        </div>
    );
}

// Minimal shape of the (enriched) FullPricingBreakdown snapshot we render for ops.
type SnapHotel = { hotel_id: number; room_pricing_id: number; room_id: number | null; hotel_name: string; hotel_city: string | null; hotel_state: string | null; hotel_address: string | null; check_in_time: string | null; check_out_time: string | null; room_name: string | null; plan_name: string | null; occupancy_selected: number; rooms_count: number; num_nights: number; price_per_room: number; total: number };
type SnapActivity = { id: number; variant_id: number | null; variant_label: string | null; name: string; is_optional: boolean; pricing_type?: string; adult_price?: number; child_price?: number; infant_price?: number; adult_count?: number; child_count?: number; infant_count?: number; total?: number };
type SnapTransfer = { id: number; route_id: number | null; vehicle_id: number | null; pickup_name: string | null; drop_name: string | null; vehicle_name: string | null };
type SnapDay = { day: number; day_title: string; day_date: string | null; hotel: SnapHotel | null; meals: { label: string }[]; activities: SnapActivity[]; transfers: SnapTransfer[] };
type SnapCab = { day_from: number; day_to: number; cab_type_id: number; vehicle_id: number; vehicle_name: string; vehicle_capacity: number; upgraded: boolean; pricing_type?: string; price_used?: number; total?: number; km?: number; days?: number; destination_name?: string };
type Snapshot = { days?: SnapDay[]; cab_segments?: SnapCab[] };

const ref = (label: string, id: number | null | undefined) => (id == null ? null : <span className="text-[11px] text-dashboard-neutral/80">{label} #{id}</span>);

const installmentStatusStyle: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    PENDING: "bg-amber-100 text-amber-700",
    OVERDUE: "bg-red-100 text-red-700",
    WAIVED: "bg-gray-100 text-gray-500",
};
function InstallmentPill({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${installmentStatusStyle[status] ?? "bg-gray-100 text-gray-500"}`}>
            {titleCase(status)}
        </span>
    );
}

function PricingBreakdown({ snapshot, total_paise }: { snapshot: Snapshot; total_paise: number }) {
    const days = snapshot.days ?? [];
    const cabs = snapshot.cab_segments ?? [];

    const hotelsTotal = days.reduce((s, d) => s + (d.hotel?.total ?? 0), 0);
    const activitiesTotal = days.reduce((s, d) => s + d.activities.reduce((a, act) => a + (!act.is_optional && act.total != null ? act.total : 0), 0), 0);
    const cabsTotal = cabs.reduce((s, c) => s + (c.total ?? 0), 0);
    const hasBreakdown = hotelsTotal > 0 || activitiesTotal > 0 || cabsTotal > 0;

    return (
        <div>
            {hasBreakdown && (
                <div className="mb-3 rounded-lg border border-dashboard-base-300/70 divide-y divide-dashboard-base-300/50 overflow-hidden">
                    {hotelsTotal > 0 && (
                        <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                            <span className="flex items-center gap-1.5 text-dashboard-neutral"><span>🏨</span> Hotels</span>
                            <span className="font-medium tabular-nums text-dashboard-base-content">{inr(hotelsTotal)}</span>
                        </div>
                    )}
                    {activitiesTotal > 0 && (
                        <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                            <span className="flex items-center gap-1.5 text-dashboard-neutral"><span>🎟</span> Activities</span>
                            <span className="font-medium tabular-nums text-dashboard-base-content">{inr(activitiesTotal)}</span>
                        </div>
                    )}
                    {cabsTotal > 0 && (
                        <div className="flex items-center justify-between px-3 py-2.5 text-sm">
                            <span className="flex items-center gap-1.5 text-dashboard-neutral"><span>🚗</span> Transportation</span>
                            <span className="font-medium tabular-nums text-dashboard-base-content">{inr(cabsTotal)}</span>
                        </div>
                    )}
                </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-dashboard-primary/10 px-4 py-3">
                <span className="text-sm font-medium text-dashboard-base-content">Trip Total</span>
                <span className="text-xl font-bold tabular-nums text-dashboard-primary">{formatPaise(total_paise)}</span>
            </div>
        </div>
    );
}

function BookedItinerary({ snapshot }: { snapshot: Snapshot }) {
    const days = snapshot.days ?? [];
    const cabs = snapshot.cab_segments ?? [];
    if (days.length === 0) return <p className="text-sm text-dashboard-neutral">No itinerary snapshot stored for this booking.</p>;

    return (
        <div className="flex flex-col gap-3">
            {days.map((d) => (
                <div key={d.day} className="rounded-lg border border-dashboard-base-300/70 overflow-hidden">
                    {/* Day header */}
                    <div className="flex items-center gap-2.5 border-b border-dashboard-base-300/60 bg-dashboard-base-200/50 px-4 py-2.5">
                        <span className="rounded bg-dashboard-primary/10 px-2 py-0.5 text-[11px] font-bold text-dashboard-primary">Day {d.day}</span>
                        <span className="text-sm font-semibold text-dashboard-base-content">{d.day_title}</span>
                        {d.day_date && <span className="ml-auto text-xs text-dashboard-neutral">{fmtDate(new Date(`${d.day_date}T00:00:00`))}</span>}
                    </div>

                    <div className="px-4 py-3 flex flex-col gap-3">
                        {/* Hotel */}
                        {d.hotel && (
                            <div className="rounded-md border border-dashboard-base-300/60 overflow-hidden">
                                <div className="flex items-start justify-between gap-2 bg-blue-50/60 px-3 py-2">
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm">🏨</span>
                                            <span className="text-sm font-semibold text-dashboard-base-content">{d.hotel.hotel_name}</span>
                                            {(d.hotel.hotel_city || d.hotel.hotel_state) && (
                                                <span className="text-xs text-dashboard-neutral">{[d.hotel.hotel_city, d.hotel.hotel_state].filter(Boolean).join(", ")}</span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 text-xs text-dashboard-neutral">
                                            {d.hotel.room_name}{d.hotel.plan_name ? ` · ${d.hotel.plan_name}` : ""}
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-sm font-bold tabular-nums text-dashboard-base-content">{inr(d.hotel.total)}</span>
                                </div>
                                {/* Pricing calculation row */}
                                <div className="grid grid-cols-4 divide-x divide-dashboard-base-300/50 border-t border-dashboard-base-300/50 text-center text-xs">
                                    <div className="px-2 py-2">
                                        <div className="text-dashboard-neutral">Rate/room/night</div>
                                        <div className="mt-0.5 font-semibold tabular-nums text-dashboard-base-content">{inr(d.hotel.price_per_room)}</div>
                                    </div>
                                    <div className="px-2 py-2">
                                        <div className="text-dashboard-neutral">Rooms</div>
                                        <div className="mt-0.5 font-semibold text-dashboard-base-content">{d.hotel.rooms_count}</div>
                                    </div>
                                    <div className="px-2 py-2">
                                        <div className="text-dashboard-neutral">Nights</div>
                                        <div className="mt-0.5 font-semibold text-dashboard-base-content">{d.hotel.num_nights}</div>
                                    </div>
                                    <div className="px-2 py-2">
                                        <div className="text-dashboard-neutral">Total</div>
                                        <div className="mt-0.5 font-bold tabular-nums text-dashboard-base-content">{inr(d.hotel.total)}</div>
                                    </div>
                                </div>
                                {/* Check-in / out */}
                                {d.day_date && (
                                    <div className="flex items-center gap-1.5 border-t border-dashboard-base-300/50 px-3 py-1.5 text-[11px] text-dashboard-neutral">
                                        <span>Check-in {fmtDate(new Date(`${d.day_date}T00:00:00`))}{d.hotel.check_in_time ? ` · ${d.hotel.check_in_time}` : ""}</span>
                                        <span className="text-dashboard-base-300">→</span>
                                        <span>Check-out {fmtDate(new Date(`${addNightsISO(d.day_date, d.hotel.num_nights)}T00:00:00`))}{d.hotel.check_out_time ? ` · ${d.hotel.check_out_time}` : ""}</span>
                                        <span className="ml-auto">{ref("hotel", d.hotel.hotel_id)} {ref("room_pricing", d.hotel.room_pricing_id)} {ref("room", d.hotel.room_id)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Activities */}
                        {d.activities.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                {d.activities.map((a) => {
                                    const hasPricing = (a.adult_price ?? 0) > 0 || (a.total ?? 0) > 0;
                                    return (
                                        <div key={a.id} className="flex items-start justify-between gap-2 rounded-md border border-dashboard-base-300/50 px-3 py-2">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-sm">🎟</span>
                                                    <span className="text-sm text-dashboard-base-content">{a.name}</span>
                                                    {a.variant_label && <span className="text-xs text-dashboard-neutral">· {a.variant_label}</span>}
                                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${a.is_optional ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                                                        {a.is_optional ? "optional" : "included"}
                                                    </span>
                                                </div>
                                                {hasPricing && (
                                                    <div className="mt-1 flex items-center gap-2 text-xs text-dashboard-neutral">
                                                        {a.adult_price != null && a.adult_price > 0 && <span>{inr(a.adult_price)}/adult{a.adult_count ? ` × ${a.adult_count}` : ""}</span>}
                                                        {a.child_price != null && a.child_price > 0 && <span>{inr(a.child_price)}/child{a.child_count ? ` × ${a.child_count}` : ""}</span>}
                                                        {a.infant_price != null && a.infant_price > 0 && <span>{inr(a.infant_price)}/infant{a.infant_count ? ` × ${a.infant_count}` : ""}</span>}
                                                    </div>
                                                )}
                                                <div className="mt-0.5 text-[11px] text-dashboard-neutral/70">{ref("activity", a.id)} {ref("variant", a.variant_id)}</div>
                                            </div>
                                            {hasPricing && a.total != null && a.total > 0 && (
                                                <span className="shrink-0 text-sm font-semibold tabular-nums text-dashboard-base-content">
                                                    {a.is_optional ? <span className="text-amber-600">{inr(a.total)}</span> : inr(a.total)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Transfers */}
                        {d.transfers.length > 0 && (
                            <div className="flex flex-col gap-1.5">
                                {d.transfers.map((t) => (
                                    <div key={t.id} className="flex items-center gap-2 rounded-md border border-dashboard-base-300/50 px-3 py-2 text-sm">
                                        <span>🚐</span>
                                        <span className="font-medium text-dashboard-base-content">{t.pickup_name ?? "—"}</span>
                                        <span className="text-dashboard-neutral">→</span>
                                        <span className="font-medium text-dashboard-base-content">{t.drop_name ?? "—"}</span>
                                        {t.vehicle_name && <span className="text-xs text-dashboard-neutral">· {t.vehicle_name}</span>}
                                        <span className="ml-auto text-[11px] text-dashboard-neutral/70">{ref("route", t.route_id)} {ref("vehicle", t.vehicle_id)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Meals */}
                        {d.meals.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-dashboard-neutral">Meals:</span>
                                {d.meals.map((m) => (
                                    <span key={m.label} className="rounded-full bg-dashboard-base-200 px-2 py-0.5 text-[11px] text-dashboard-neutral">{m.label}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {cabs.length > 0 && (
                <div className="rounded-lg border border-dashboard-base-300/70 overflow-hidden">
                    <div className="border-b border-dashboard-base-300/60 bg-dashboard-base-200/50 px-4 py-2.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-dashboard-neutral">🚗 Cab segments</span>
                    </div>
                    <div className="px-4 py-3 flex flex-col gap-2">
                        {cabs.map((c, i) => (
                            <div key={i} className="rounded-md border border-dashboard-base-300/50 overflow-hidden">
                                <div className="flex items-start justify-between gap-2 px-3 py-2">
                                    <div>
                                        <div className="text-sm font-medium text-dashboard-base-content">
                                            Day {c.day_from}–{c.day_to}: {c.vehicle_name}
                                            <span className="ml-1 text-xs text-dashboard-neutral">({c.vehicle_capacity}-seater{c.upgraded ? " · upgraded" : ""})</span>
                                        </div>
                                        {c.destination_name && <div className="text-xs text-dashboard-neutral mt-0.5">{c.destination_name}</div>}
                                        <div className="mt-0.5 text-[11px] text-dashboard-neutral/70">{ref("cabType", c.cab_type_id)} {ref("vehicle", c.vehicle_id)}</div>
                                    </div>
                                    {c.total != null && <span className="shrink-0 text-sm font-bold tabular-nums text-dashboard-base-content">{inr(c.total)}</span>}
                                </div>
                                {(c.price_used != null || c.total != null) && (
                                    <div className="grid grid-cols-3 divide-x divide-dashboard-base-300/50 border-t border-dashboard-base-300/50 text-center text-xs">
                                        <div className="px-2 py-1.5">
                                            <div className="text-dashboard-neutral">Rate/{c.pricing_type === "PER_KM" ? "km" : "day"}</div>
                                            <div className="mt-0.5 font-semibold tabular-nums text-dashboard-base-content">{c.price_used != null ? inr(c.price_used) : "—"}</div>
                                        </div>
                                        <div className="px-2 py-1.5">
                                            <div className="text-dashboard-neutral">{c.pricing_type === "PER_KM" ? "km" : "days"}</div>
                                            <div className="mt-0.5 font-semibold text-dashboard-base-content">{c.pricing_type === "PER_KM" ? (c.km ?? "—") : (c.days ?? "—")}</div>
                                        </div>
                                        <div className="px-2 py-1.5">
                                            <div className="text-dashboard-neutral">Total</div>
                                            <div className="mt-0.5 font-bold tabular-nums text-dashboard-base-content">{c.total != null ? inr(c.total) : "—"}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true, paymentPlan: true, tripType: true,
            startDate: true, endDate: true, duration: true, travellers: true, createdAt: true, currency: true,
            totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
            contactEmail: true, contactPhone: true, gstStateCode: true, cancelReason: true, cancelledAt: true,
            packageId: true, packageUrl: true, priceSnapshot: true,
            user: { select: { name: true, email: true } },
            package: { select: { title: true } },
            destination: { select: { name: true } },
            travellersList: { orderBy: { isLead: "desc" }, select: { id: true, fullName: true, type: true, gender: true, dateOfBirth: true, isLead: true } },
            installments: { orderBy: { sequence: "asc" }, select: { id: true, type: true, sequence: true, amount_paise: true, dueDate: true, status: true, paidAt: true } },
            payments: { orderBy: { createdAt: "desc" }, select: { id: true, gateway: true, method: true, amount_paise: true, status: true, purpose: true, gatewayPaymentId: true, gatewayOrderId: true, failureReason: true, createdAt: true, paidAt: true } },
            timeline: { orderBy: { createdAt: "desc" }, select: { id: true, action: true, note: true, fromStatus: true, toStatus: true, performedByName: true, createdAt: true } },
        },
    });

    if (!booking) notFound();

    const isFull = booking.paymentPlan === "FULL";
    const snapshot = (booking.priceSnapshot ?? {}) as Snapshot;
    const fulfillment = await getBookingFulfillment(id);

    return (
        <div className="flex flex-col gap-5">
            <Link href="/dashboard/package-bookings" className="text-sm text-dashboard-neutral hover:text-dashboard-primary">← Back to bookings</Link>

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">{booking.bookingNumber}</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">Created {fmtDateTime(booking.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={booking.status} />
                    <PaymentPill status={booking.paymentStatus} />
                    <Link href={`/bookings/${booking.id}/invoice`} target="_blank" className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-sm text-dashboard-base-content hover:bg-dashboard-base-200">Invoice</Link>
                    <Link href={`/bookings/${booking.id}/voucher`} target="_blank" className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-sm text-dashboard-base-content hover:bg-dashboard-base-200">Voucher</Link>
                </div>
            </div>

            {booking.status === "CANCELLED" && booking.cancelReason && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Cancelled {booking.cancelledAt ? `on ${fmtDate(booking.cancelledAt)}` : ""} — {booking.cancelReason}
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-3 items-start">
                <div className="lg:col-span-2 flex flex-col gap-5">
                    <Section title="Trip">
                        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            <Field
                                label="Package"
                                value={booking.packageUrl && booking.package?.title ? (() => {
                                    const params = new URLSearchParams();
                                    params.set("adults", String(booking.travellers));
                                    params.set("date", booking.startDate.toISOString().slice(0, 10));
                                    return (
                                        <Link href={`${booking.packageUrl}?${params.toString()}`} target="_blank" className="inline-flex items-center gap-1 text-dashboard-primary hover:underline">
                                            {booking.package.title}
                                            <ExternalLink className="size-3.5" />
                                        </Link>
                                    );
                                })() : booking.package?.title}
                            />
                            <Field label="Destination" value={booking.destination?.name} />
                            <Field label="Trip type" value={titleCase(booking.tripType)} />
                            <Field label="Travel dates" value={`${fmtDate(booking.startDate)} – ${fmtDate(booking.endDate)}`} />
                            <Field label="Duration" value={`${booking.duration} day${booking.duration !== 1 ? "s" : ""}`} />
                            <Field label="Travellers" value={booking.travellers} />
                        </dl>
                    </Section>

                    <Section title={`Travellers (${booking.travellersList.length})`}>
                        {booking.travellersList.length === 0 ? (
                            <p className="text-sm text-dashboard-neutral">No traveller details captured.</p>
                        ) : (
                            <ul className="divide-y divide-dashboard-base-300/60">
                                {booking.travellersList.map((t) => (
                                    <li key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                                        <div>
                                            <span className="text-sm text-dashboard-base-content">{t.fullName}</span>
                                            {t.isLead && <span className="ml-2 rounded bg-dashboard-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-dashboard-primary">Lead</span>}
                                        </div>
                                        <div className="text-xs text-dashboard-neutral">
                                            {titleCase(t.type)}{t.gender ? ` · ${titleCase(t.gender)}` : ""}{t.dateOfBirth ? ` · DOB ${fmtDate(t.dateOfBirth)}` : ""}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>

                    <Section
                        title="Itinerary (as booked)"
                        action={
                            <Link
                                href={`/dashboard/verify-hotels/${booking.id}`}
                                className="inline-flex items-center gap-1 rounded-md border border-dashboard-base-300 px-2.5 py-1 text-xs text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                            >
                                🏨 Manage Hotels →
                            </Link>
                        }
                    >
                        <BookedItinerary snapshot={snapshot} />
                    </Section>

                    {fulfillment && (
                        <Section title="Fulfilment status">
                            <FulfillmentPanel bookingId={booking.id} fulfillment={fulfillment} />
                        </Section>
                    )}

                    {/* Price Changes log — entries tagged [PRICE CHANGE] by confirmHotelStay */}
                    {booking.timeline.some((e) => e.note?.startsWith("[PRICE CHANGE]")) && (
                        <Section title="Price Changes">
                            {(() => {
                                const snap = (booking.priceSnapshot ?? {}) as { final_price?: number };
                                const originalPaise = snap.final_price != null
                                    ? Math.round(snap.final_price * 100)
                                    : booking.totalAmount_paise;
                                const totalDiff = booking.totalAmount_paise - originalPaise;
                                return (
                                    <div className="flex flex-col gap-3">
                                        {/* Current vs original total banner */}
                                        <div className="flex items-center justify-between rounded-lg border border-dashboard-base-300/70 bg-dashboard-base-200/40 px-4 py-3">
                                            <div className="text-xs text-dashboard-neutral">
                                                <span className="block font-medium text-dashboard-base-content text-sm">
                                                    Current total: {formatPaise(booking.totalAmount_paise)}
                                                </span>
                                                {originalPaise !== booking.totalAmount_paise && (
                                                    <span>Original: {formatPaise(originalPaise)}</span>
                                                )}
                                            </div>
                                            {totalDiff !== 0 && (
                                                <span className={`text-sm font-bold tabular-nums ${totalDiff > 0 ? "text-red-600" : "text-green-600"}`}>
                                                    {totalDiff > 0 ? "+" : "−"}{formatPaise(Math.abs(totalDiff))}
                                                </span>
                                            )}
                                        </div>
                                        {/* Individual change entries */}
                                        <ul className="flex flex-col gap-2">
                                            {booking.timeline
                                                .filter((e) => e.note?.startsWith("[PRICE CHANGE]"))
                                                .map((e) => {
                                                    const note = e.note!.replace("[PRICE CHANGE] ", "");
                                                    const isIncrease = note.includes("increased");
                                                    const isDecrease = note.includes("decreased");
                                                    return (
                                                        <li key={e.id} className={`flex gap-3 rounded-lg border px-4 py-3 ${
                                                            isIncrease ? "border-red-100 bg-red-50/40"
                                                            : isDecrease ? "border-green-100 bg-green-50/40"
                                                            : "border-amber-100 bg-amber-50/40"
                                                        }`}>
                                                            <span className="mt-0.5 shrink-0 text-base select-none">
                                                                {isIncrease ? "📈" : isDecrease ? "📉" : "🔄"}
                                                            </span>
                                                            <div>
                                                                <div className="text-sm text-dashboard-base-content">{note}</div>
                                                                <div className="mt-0.5 text-xs text-dashboard-neutral">
                                                                    {e.performedByName} · {fmtDateTime(e.createdAt)}
                                                                </div>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                        </ul>
                                    </div>
                                );
                            })()}
                        </Section>
                    )}

                    <Section title="Payments">
                        {booking.payments.length === 0 ? (
                            <p className="text-sm text-dashboard-neutral">No payment attempts yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wide text-dashboard-neutral">
                                            <th className="py-2 pr-4 font-medium">When</th>
                                            <th className="py-2 pr-4 font-medium">Gateway</th>
                                            <th className="py-2 pr-4 font-medium">Purpose</th>
                                            <th className="py-2 pr-4 font-medium text-right">Amount</th>
                                            <th className="py-2 pr-4 font-medium">Status</th>
                                            <th className="py-2 font-medium">Gateway ref</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {booking.payments.map((p) => (
                                            <tr key={p.id} className="border-t border-dashboard-base-300/60 align-top">
                                                <td className="py-2.5 pr-4 whitespace-nowrap text-dashboard-base-content">{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                                                <td className="py-2.5 pr-4 text-dashboard-base-content">{titleCase(p.gateway)}{p.method ? ` · ${titleCase(p.method)}` : ""}</td>
                                                <td className="py-2.5 pr-4 text-dashboard-neutral">{titleCase(p.purpose)}</td>
                                                <td className="py-2.5 pr-4 text-right whitespace-nowrap text-dashboard-base-content">{formatPaise(p.amount_paise)}</td>
                                                <td className="py-2.5 pr-4"><PaymentPill status={p.status} /></td>
                                                <td className="py-2.5 text-xs text-dashboard-neutral break-all">
                                                    {p.gatewayPaymentId ?? p.gatewayOrderId ?? "—"}
                                                    {p.failureReason && <div className="text-red-600">{p.failureReason}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>

                    <Section title="Timeline">
                        {booking.timeline.length === 0 ? (
                            <p className="text-sm text-dashboard-neutral">No timeline events.</p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {booking.timeline.map((e) => (
                                    <li key={e.id} className="flex gap-3">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-dashboard-primary/60" />
                                        <div>
                                            <div className="text-sm text-dashboard-base-content">
                                                {titleCase(e.action)}
                                                {e.fromStatus && e.toStatus && <span className="text-dashboard-neutral"> · {titleCase(e.fromStatus)} → {titleCase(e.toStatus)}</span>}
                                            </div>
                                            {e.note && <div className="text-xs text-dashboard-neutral mt-0.5">{e.note}</div>}
                                            <div className="text-xs text-dashboard-neutral mt-0.5">{e.performedByName} · {fmtDateTime(e.createdAt)}</div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                </div>

                <div className="flex flex-col gap-5">
                    {/* Pricing — cost breakdown + payment plan at a glance */}
                    <Section title="Pricing">
                        <PricingBreakdown snapshot={snapshot} total_paise={booking.totalAmount_paise} />

                        {booking.paymentPlan && (
                            <div className="mt-4 border-t border-dashboard-base-300/60 pt-4">
                                <div className="text-xs uppercase tracking-wide text-dashboard-neutral mb-2.5">
                                    Payment plan · {isFull ? "Pay in full" : "Deposit + balance"}
                                </div>
                                {isFull ? (
                                    <div className="flex items-center justify-between rounded-lg bg-dashboard-base-200 px-3 py-2.5">
                                        <span className="text-sm text-dashboard-base-content">Full payment</span>
                                        <PaymentPill status={booking.paymentStatus} />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-3">
                                            <div className="text-xs text-dashboard-neutral">Deposit</div>
                                            <div className="mt-1 text-base font-semibold tabular-nums text-dashboard-base-content">{formatPaise(booking.advanceAmount_paise)}</div>
                                        </div>
                                        <div className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 p-3">
                                            <div className="text-xs text-dashboard-neutral">Balance</div>
                                            <div className="mt-1 text-base font-semibold tabular-nums text-dashboard-base-content">{formatPaise(booking.balanceAmount_paise)}</div>
                                            {booking.balanceDueDate && <div className="mt-0.5 text-[11px] text-dashboard-neutral">Due {fmtDate(booking.balanceDueDate)}</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {booking.installments.length > 0 && (
                            <div className="mt-4 border-t border-dashboard-base-300/60 pt-4">
                                <div className="text-xs uppercase tracking-wide text-dashboard-neutral mb-2.5">Installments</div>
                                <ul className="flex flex-col gap-2">
                                    {booking.installments.map((leg) => (
                                        <li key={leg.id} className="flex items-start justify-between rounded-lg bg-dashboard-base-200 px-3 py-2.5">
                                            <div>
                                                <div className="text-sm font-medium text-dashboard-base-content">{titleCase(leg.type)}</div>
                                                {leg.dueDate && <div className="text-xs text-dashboard-neutral mt-0.5">{fmtDate(leg.dueDate)}</div>}
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-semibold tabular-nums text-dashboard-base-content">{formatPaise(leg.amount_paise)}</div>
                                                <div className="mt-1"><InstallmentPill status={leg.status} /></div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Section>

                    <Section title="Actions">
                        <BookingAdminActions
                            bookingId={booking.id}
                            cancellable={!["CANCELLED", "COMPLETED"].includes(booking.status)}
                            hasPendingPayments={booking.payments.some((p) => p.status === "PENDING")}
                        />
                    </Section>

                    <Section title="Customer">
                        <dl className="flex flex-col gap-3">
                            <Field label="Name" value={booking.user?.name} />
                            <Field label="Account email" value={booking.user?.email} />
                            <Field label="Contact email" value={booking.contactEmail} />
                            <Field label="Contact phone" value={booking.contactPhone} />
                            <Field label="GST state" value={booking.gstStateCode} />
                        </dl>
                    </Section>
                </div>
            </div>
        </div>
    );
}
