import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import BookingsFilters from "./BookingsFilters";
import BookingRowActions from "./BookingRowActions";
import { PaymentPill, StatusPill } from "./pills";

export const metadata: Metadata = {
    title: "Package Bookings - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;
const PAYMENT_STATUSES = ["PENDING", "ADVANCE_PAID", "FULLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED"];
const BOOKING_STATUSES = [
    "UPCOMING", "ONGOING", "COMPLETED", "CANCELLED", "PENDING_REVIEW", "HOTEL_VERIFICATION",
    "HOTEL_CONFIRMED", "CAB_VERIFICATION", "CAB_CONFIRMED", "OPS_REVIEW", "CONFIRMED", "REJECTED", "MODIFICATION_REQUESTED",
];

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export default async function PackageBookingsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;
    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();
    const paymentStatus = PAYMENT_STATUSES.includes(sp.payment ?? "") ? sp.payment : "";
    const status = BOOKING_STATUSES.includes(sp.status ?? "") ? sp.status : "";

    const where: Prisma.BookingWhereInput = {
        ...(paymentStatus ? { paymentStatus: paymentStatus as Prisma.BookingWhereInput["paymentStatus"] } : {}),
        ...(status ? { status: status as Prisma.BookingWhereInput["status"] } : {}),
        ...(search
            ? {
                  OR: [
                      { bookingNumber: { contains: search, mode: "insensitive" } },
                      { contactEmail: { contains: search, mode: "insensitive" } },
                      { contactPhone: { contains: search, mode: "insensitive" } },
                      { user: { name: { contains: search, mode: "insensitive" } } },
                  ],
              }
            : {}),
    };

    const [total, bookings] = await Promise.all([
        db.booking.count({ where }),
        db.booking.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, bookingNumber: true, startDate: true, endDate: true, travellers: true,
                totalAmount_paise: true, paymentStatus: true, status: true, paymentPlan: true,
                createdAt: true, contactEmail: true,
                user: { select: { name: true, email: true } },
                package: { select: { title: true } },
                destination: { select: { name: true } },
            },
        }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    const qs = (next: Record<string, string | number>) => {
        const p = new URLSearchParams();
        if (search) p.set("search", search);
        if (paymentStatus) p.set("payment", paymentStatus);
        if (status) p.set("status", status);
        if (limit !== 20) p.set("limit", String(limit));
        for (const [k, v] of Object.entries(next)) {
            if (v === "" || v == null) p.delete(k);
            else p.set(k, String(v));
        }
        const s = p.toString();
        return s ? `?${s}` : "";
    };

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-dashboard-base-content">Package Bookings</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">{total} booking{total !== 1 ? "s" : ""} total</p>
                </div>
            </div>

            <BookingsFilters
                search={search}
                payment={paymentStatus ?? ""}
                status={status ?? ""}
                paymentOptions={PAYMENT_STATUSES}
                statusOptions={BOOKING_STATUSES}
            />

            <div className="overflow-x-auto rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-dashboard-base-300 text-left text-xs uppercase tracking-wide text-dashboard-neutral">
                            <th className="px-4 py-3 font-medium">Booking</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Package</th>
                            <th className="px-4 py-3 font-medium">Travel dates</th>
                            <th className="px-4 py-3 font-medium text-center">Pax</th>
                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                            <th className="px-4 py-3 font-medium">Payment</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-12 text-center text-dashboard-neutral">No bookings match these filters.</td>
                            </tr>
                        ) : (
                            bookings.map((b) => (
                                <tr key={b.id} className="border-b border-dashboard-base-300/60 last:border-0 hover:bg-dashboard-base-200/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <Link href={`/dashboard/package-bookings/${b.id}`} className="font-medium text-dashboard-primary hover:underline">
                                            {b.bookingNumber}
                                        </Link>
                                        <div className="text-xs text-dashboard-neutral mt-0.5">{fmtDate(b.createdAt)}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-dashboard-base-content">{b.user?.name ?? "—"}</div>
                                        <div className="text-xs text-dashboard-neutral">{b.contactEmail ?? b.user?.email ?? ""}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-dashboard-base-content">{b.package?.title ?? "—"}</div>
                                        <div className="text-xs text-dashboard-neutral">{b.destination?.name ?? ""}</div>
                                    </td>
                                    <td className="px-4 py-3 text-dashboard-base-content whitespace-nowrap">{fmtDate(b.startDate)} – {fmtDate(b.endDate)}</td>
                                    <td className="px-4 py-3 text-center text-dashboard-base-content">{b.travellers}</td>
                                    <td className="px-4 py-3 text-right font-medium text-dashboard-base-content whitespace-nowrap">
                                        {formatPaise(b.totalAmount_paise)}
                                        {b.paymentPlan === "DEPOSIT" && <div className="text-xs font-normal text-dashboard-neutral">Deposit plan</div>}
                                    </td>
                                    <td className="px-4 py-3"><PaymentPill status={b.paymentStatus} /></td>
                                    <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end">
                                            <BookingRowActions
                                                bookingId={b.id}
                                                bookingNumber={b.bookingNumber}
                                                cancellable={!["CANCELLED", "COMPLETED"].includes(b.status)}
                                                hasPendingPayments={b.paymentStatus === "PENDING"}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-dashboard-neutral">Showing {from}–{to} of {total}</span>
                <div className="flex items-center gap-2">
                    <PageLink disabled={page <= 1} href={qs({ page: page - 1 })} label="Previous" />
                    <span className="text-dashboard-neutral px-1">Page {page} of {totalPages}</span>
                    <PageLink disabled={page >= totalPages} href={qs({ page: page + 1 })} label="Next" />
                </div>
            </div>
        </div>
    );
}

function PageLink({ href, label, disabled }: { href: string; label: string; disabled: boolean }) {
    if (disabled) {
        return <span className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-dashboard-neutral/50 cursor-not-allowed">{label}</span>;
    }
    return (
        <Link href={`/dashboard/package-bookings${href}`} className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-dashboard-base-content hover:bg-dashboard-primary/10 hover:text-dashboard-primary transition-colors">
            {label}
        </Link>
    );
}
