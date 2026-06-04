import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import { PaymentPill, StatusPill } from "../pills";

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

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, bookingNumber: true, status: true, paymentStatus: true, paymentPlan: true, tripType: true,
            startDate: true, endDate: true, duration: true, travellers: true, createdAt: true, currency: true,
            totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
            contactEmail: true, contactPhone: true, gstStateCode: true, cancelReason: true, cancelledAt: true,
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
                            <Field label="Package" value={booking.package?.title} />
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
                    <Section title="Customer">
                        <dl className="flex flex-col gap-3">
                            <Field label="Name" value={booking.user?.name} />
                            <Field label="Account email" value={booking.user?.email} />
                            <Field label="Contact email" value={booking.contactEmail} />
                            <Field label="Contact phone" value={booking.contactPhone} />
                            <Field label="GST state" value={booking.gstStateCode} />
                        </dl>
                    </Section>

                    <Section title="Payment summary">
                        <dl className="flex flex-col gap-3">
                            <Field label="Plan" value={booking.paymentPlan ? (isFull ? "Pay in full" : "Deposit + balance") : "—"} />
                            <Field label="Trip total" value={formatPaise(booking.totalAmount_paise)} />
                            {!isFull && <Field label="Deposit" value={formatPaise(booking.advanceAmount_paise)} />}
                            {!isFull && <Field label="Balance" value={`${formatPaise(booking.balanceAmount_paise)}${booking.balanceDueDate ? ` · due ${fmtDate(booking.balanceDueDate)}` : ""}`} />}
                        </dl>

                        {booking.installments.length > 0 && (
                            <div className="mt-4 border-t border-dashboard-base-300/60 pt-3">
                                <div className="text-xs uppercase tracking-wide text-dashboard-neutral mb-2">Installments</div>
                                <ul className="flex flex-col gap-2">
                                    {booking.installments.map((leg) => (
                                        <li key={leg.id} className="flex items-center justify-between text-sm">
                                            <span className="text-dashboard-base-content">
                                                {titleCase(leg.type)}{leg.dueDate ? <span className="text-dashboard-neutral"> · {fmtDate(leg.dueDate)}</span> : ""}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span className="text-dashboard-base-content">{formatPaise(leg.amount_paise)}</span>
                                                <span className="text-xs text-dashboard-neutral">{titleCase(leg.status)}</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Section>
                </div>
            </div>
        </div>
    );
}
