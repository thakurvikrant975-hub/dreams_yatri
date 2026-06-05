import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { formatPaise } from "@/app/lib/money";
import { PaymentPill } from "../package-bookings/pills";

export const metadata: Metadata = {
    title: "Verify Hotels - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const VALID_LIMITS = [10, 20, 50] as const;

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export default async function VerifyHotelsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>;
}) {
    const sp = await searchParams;
    const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
    const rawLim = parseInt(sp.limit ?? "20", 10);
    const limit = (VALID_LIMITS as readonly number[]).includes(rawLim) ? rawLim : 20;
    const search = (sp.search ?? "").trim();

    const where: Prisma.BookingWhereInput = {
        status: "HOTEL_VERIFICATION",
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
                totalAmount_paise: true, paymentStatus: true, createdAt: true,
                user: { select: { name: true, email: true } },
                package: { select: { title: true } },
                destination: { select: { name: true } },
                _count: { select: { hotelBookings: true } },
                hotelBookings: {
                    where: { isConfirmed: false },
                    select: { id: true },
                },
            },
        }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    const qs = (next: Record<string, string | number>) => {
        const p = new URLSearchParams();
        if (search) p.set("search", search);
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
                    <h1 className="text-xl font-semibold text-dashboard-base-content">Verify Hotels</h1>
                    <p className="text-sm text-dashboard-neutral mt-0.5">
                        {total} booking{total !== 1 ? "s" : ""} awaiting hotel confirmation
                    </p>
                </div>
            </div>

            <form method="GET" className="flex gap-2">
                <input
                    name="search"
                    defaultValue={search}
                    placeholder="Search by booking number, customer name, email…"
                    className="flex-1 rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-2 text-sm text-dashboard-base-content placeholder:text-dashboard-neutral outline-none focus:border-dashboard-primary"
                />
                <button
                    type="submit"
                    className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-2 text-sm text-dashboard-base-content hover:bg-dashboard-base-200 transition-colors"
                >
                    Search
                </button>
                {search && (
                    <Link
                        href="/dashboard/verify-hotels"
                        className="rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-4 py-2 text-sm text-dashboard-neutral hover:bg-dashboard-base-200 transition-colors"
                    >
                        Clear
                    </Link>
                )}
            </form>

            <div className="overflow-x-auto rounded-xl border border-dashboard-base-300 bg-dashboard-base-100">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-dashboard-base-300 text-left text-xs uppercase tracking-wide text-dashboard-neutral">
                            <th className="px-4 py-3 font-medium">Booking</th>
                            <th className="px-4 py-3 font-medium">Customer</th>
                            <th className="px-4 py-3 font-medium">Package / Destination</th>
                            <th className="px-4 py-3 font-medium">Travel dates</th>
                            <th className="px-4 py-3 font-medium text-center">Pax</th>
                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                            <th className="px-4 py-3 font-medium">Payment</th>
                            <th className="px-4 py-3 font-medium text-center">Hotels pending</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-12 text-center text-dashboard-neutral">
                                    {search ? "No bookings match this search." : "No bookings are awaiting hotel verification."}
                                </td>
                            </tr>
                        ) : (
                            bookings.map((b) => {
                                const pending = b.hotelBookings.length;
                                const total = b._count.hotelBookings;
                                return (
                                    <tr key={b.id} className="border-b border-dashboard-base-300/60 last:border-0 hover:bg-dashboard-base-200/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/dashboard/verify-hotels/${b.id}`}
                                                className="font-medium text-dashboard-primary hover:underline"
                                            >
                                                {b.bookingNumber}
                                            </Link>
                                            <div className="text-xs text-dashboard-neutral mt-0.5">{fmtDate(b.createdAt)}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-dashboard-base-content">{b.user?.name ?? "—"}</div>
                                            <div className="text-xs text-dashboard-neutral">{b.user?.email ?? ""}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-dashboard-base-content">{b.package?.title ?? "—"}</div>
                                            <div className="text-xs text-dashboard-neutral">{b.destination?.name ?? ""}</div>
                                        </td>
                                        <td className="px-4 py-3 text-dashboard-base-content whitespace-nowrap">
                                            {fmtDate(b.startDate)} – {fmtDate(b.endDate)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-dashboard-base-content">{b.travellers}</td>
                                        <td className="px-4 py-3 text-right font-medium text-dashboard-base-content whitespace-nowrap">
                                            {formatPaise(b.totalAmount_paise)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <PaymentPill status={b.paymentStatus} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                pending === 0
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-amber-100 text-amber-700"
                                            }`}>
                                                {pending} / {total} left
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

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
        return (
            <span className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-dashboard-neutral/50 cursor-not-allowed">
                {label}
            </span>
        );
    }
    return (
        <Link
            href={`/dashboard/verify-hotels${href}`}
            className="rounded-md border border-dashboard-base-300 px-3 py-1.5 text-dashboard-base-content hover:bg-dashboard-primary/10 hover:text-dashboard-primary transition-colors"
        >
            {label}
        </Link>
    );
}
