"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { PaymentPill, StatusPill } from "./pills";
import BookingRowActions from "./BookingRowActions";
import { formatPaise } from "@/app/lib/money";

const PAYMENT_STATUSES = [
    "PENDING", "ADVANCE_PAID", "FULLY_PAID", "REFUNDED", "PARTIALLY_REFUNDED", "FAILED",
];
const BOOKING_STATUSES = [
    "UPCOMING", "ONGOING", "COMPLETED", "CANCELLED", "PENDING_REVIEW", "HOTEL_VERIFICATION",
    "HOTEL_CONFIRMED", "CAB_VERIFICATION", "CAB_CONFIRMED", "OPS_REVIEW", "CONFIRMED",
    "REJECTED", "MODIFICATION_REQUESTED",
];

const titleCase = (s: string) =>
    s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function fmtDate(d: Date | null): string {
    if (!d) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric", month: "short", year: "numeric",
    }).format(d);
}

type Booking = {
    id: string;
    bookingNumber: string;
    startDate: Date | null;
    endDate: Date | null;
    travellers: number;
    totalAmount_paise: number;
    paymentStatus: string;
    status: string;
    paymentPlan: string | null;
    createdAt: Date;
    contactEmail: string | null;
    user: { name: string | null; email: string | null } | null;
    package: { title: string } | null;
    destination: { name: string } | null;
};

export function PackageBookingsTable({
    bookings,
    currentPage,
    totalPages,
    totalCount,
    limit,
    search,
    paymentStatus,
    status,
}: {
    bookings: Booking[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    search: string;
    paymentStatus: string;
    status: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [localSearch, setLocalSearch] = useState(search);
    const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { setLocalSearch(search); }, [search]);

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all" || value === "") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        params.delete("page");
        startTransition(() => router.replace(`?${params.toString()}`));
    }

    function handleSearch(value: string) {
        setLocalSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => updateParam("search", value), 400);
    }

    function buildHref(p: number) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(p));
        return `?${params.toString()}`;
    }

    const from = totalCount === 0 ? 0 : (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);
    const paginationLabel = `Showing ${from}–${to} of ${totalCount} booking${totalCount !== 1 ? "s" : ""}`;

    const columns: ColumnDef<Booking>[] = [
        {
            header: "Booking",
            width: "w-[160px]",
            cell: (b) => (
                <div>
                    <Link
                        href={`/dashboard/package-bookings/${b.id}`}
                        className="font-medium text-dashboard-primary hover:underline text-sm"
                    >
                        {b.bookingNumber}
                    </Link>
                    <p className="text-xs text-dashboard-base-content/55 mt-0.5">
                        {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                    </p>
                </div>
            ),
        },
        {
            header: "Customer",
            cell: (b) => (
                <div>
                    <p className="text-sm font-medium text-dashboard-base-content">
                        {b.user?.name ?? "—"}
                    </p>
                    <p className="text-xs text-dashboard-base-content/55">
                        {b.contactEmail ?? b.user?.email ?? ""}
                    </p>
                </div>
            ),
        },
        {
            header: "Package",
            cell: (b) => (
                <div>
                    <p className="text-sm text-dashboard-base-content line-clamp-1 max-w-48">
                        {b.package?.title ?? "—"}
                    </p>
                    <p className="text-xs text-dashboard-base-content/55">
                        {b.destination?.name ?? ""}
                    </p>
                </div>
            ),
        },
        {
            header: "Travel Dates",
            cell: (b) => (
                <span className="text-sm text-dashboard-base-content whitespace-nowrap">
                    {fmtDate(b.startDate)} – {fmtDate(b.endDate)}
                </span>
            ),
        },
        {
            header: "Pax",
            align: "center",
            width: "w-[70px]",
            cell: (b) => (
                <span className="text-sm font-medium text-dashboard-base-content">{b.travellers}</span>
            ),
        },
        {
            header: "Amount",
            align: "right",
            cell: (b) => (
                <div className="text-right">
                    <p className="text-sm font-medium text-dashboard-base-content whitespace-nowrap">
                        {formatPaise(b.totalAmount_paise)}
                    </p>
                    {b.paymentPlan === "DEPOSIT" && (
                        <p className="text-xs text-dashboard-base-content/55">Deposit plan</p>
                    )}
                </div>
            ),
        },
        {
            header: "Payment",
            cell: (b) => <PaymentPill status={b.paymentStatus} />,
        },
        {
            header: "Status",
            cell: (b) => <StatusPill status={b.status} />,
        },
        {
            header: "Actions",
            align: "right",
            width: "w-[80px]",
            cell: (b) => (
                <div className="flex justify-end">
                    <BookingRowActions
                        bookingId={b.id}
                        bookingNumber={b.bookingNumber}
                        cancellable={!["CANCELLED", "COMPLETED"].includes(b.status)}
                        hasPendingPayments={b.paymentStatus === "PENDING"}
                    />
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <TableFilters
                    search={localSearch}
                    onSearchChange={handleSearch}
                    searchPlaceholder="Search booking #, name, email, phone…"
                    className="flex-1"
                    filters={[
                        {
                            value: paymentStatus || "all",
                            onChange: (v) => updateParam("payment", v),
                            placeholder: "All Payments",
                            width: "w-44",
                            options: PAYMENT_STATUSES.map((s) => ({ label: titleCase(s), value: s })),
                        },
                        {
                            value: status || "all",
                            onChange: (v) => updateParam("status", v),
                            placeholder: "All Statuses",
                            width: "w-52",
                            options: BOOKING_STATUSES.map((s) => ({ label: titleCase(s), value: s })),
                        },
                    ]}
                />

                <Select
                    value={String(limit)}
                    onValueChange={(v) => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("limit", v);
                        params.delete("page");
                        startTransition(() => router.replace(`?${params.toString()}`));
                    }}
                >
                    <SelectTrigger className="w-32 h-10 text-sm shrink-0 border-dashboard-base-300 bg-dashboard-base-100 text-dashboard-base-content/70 rounded-lg focus:ring-dashboard-primary/30 focus:border-dashboard-primary">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-dashboard-base-300 bg-dashboard-base-100">
                        {[10, 20, 50].map((n) => (
                            <SelectItem
                                key={n}
                                value={String(n)}
                                className="text-sm text-dashboard-base-content focus:bg-dashboard-base-200 focus:text-dashboard-base-content rounded-lg cursor-pointer"
                            >
                                {n} / page
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DataTable
                data={bookings}
                columns={columns}
                rowKey={(b) => b.id}
                emptyState={
                    <TableEmptyState
                        title="No bookings found"
                        description="Try adjusting your filters to find bookings"
                    />
                }
                pagination={{
                    currentPage,
                    totalPages,
                    buildHref,
                    label: paginationLabel,
                }}
            />
        </div>
    );
}
