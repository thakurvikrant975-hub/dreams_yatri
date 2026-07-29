"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import { Building2, Package, Users } from "lucide-react";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { PaymentPill, StatusPill } from "./pills";
import BookingRowActions from "./BookingRowActions";
import { formatPaiseRoundedUp } from "@/app/lib/money";

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

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// The lead traveller — not the account holder — is who actually travelled,
// so that's the name shown as "Traveller" here. Falls back to the account
// name (and then the contact email) only if no traveller was ever recorded.
function travellerName(b: Booking): string {
    const t = b.travellersList[0];
    if (t) return t.fullName || [t.firstName, t.lastName].filter(Boolean).join(" ") || "—";
    return b.user?.name ?? b.contactEmail ?? "—";
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
    contactPhone: string | null;
    packageId: number | null;
    user: { name: string | null; email: string | null } | null;
    travellersList: { fullName: string; firstName: string | null; lastName: string | null }[];
    package: { title: string } | null;
    destination: { name: string } | null;
    packageUrl: string | null;
    hotelBookings: { hotel: { name: string; city: string | null } }[];
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
        updateParam("search", value);
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
            sortKey: (b) => b.bookingNumber?.toLowerCase() ?? "",
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
            header: "Traveller",
            sortKey: (b) => travellerName(b).toLowerCase(),
            cell: (b) => {
                const name = travellerName(b);
                const bookedByAccount = b.user?.name && b.user.name !== name;
                return (
                    <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dashboard-primary/10 text-[11px] font-semibold text-dashboard-primary">
                            {initials(name)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-dashboard-base-content truncate max-w-40">
                                {name}
                            </p>
                            <p className="text-xs text-dashboard-base-content/55 truncate max-w-40">
                                {b.contactEmail ?? b.user?.email ?? b.contactPhone ?? ""}
                            </p>
                            {bookedByAccount && (
                                <p className="text-[11px] text-dashboard-base-content/40 truncate max-w-40">
                                    Booked by {b.user!.name}
                                </p>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Package / Hotel",
            cell: (b) => {
                if (b.packageId == null) {
                    const stay = b.hotelBookings[0];
                    return (
                        <div className="flex items-start gap-2">
                            <Building2 size={14} className="mt-0.5 shrink-0 text-dashboard-base-content/40" />
                            <div>
                                <p className="text-sm font-medium text-dashboard-base-content line-clamp-1 max-w-44">
                                    {stay?.hotel.name ?? "—"}
                                </p>
                                <p className="text-xs text-dashboard-base-content/55">
                                    Direct hotel booking{stay?.hotel.city ? ` · ${stay.hotel.city}` : ""}
                                </p>
                            </div>
                        </div>
                    );
                }
                const href = b.packageUrl
                    ? (() => {
                        const params = new URLSearchParams();
                        params.set("adults", String(b.travellers));
                        if (b.startDate) params.set("date", new Date(b.startDate).toISOString().slice(0, 10));
                        return `${b.packageUrl}?${params.toString()}`;
                    })()
                    : null;
                return (
                    <div className="flex items-start gap-2">
                        <Package size={14} className="mt-0.5 shrink-0 text-dashboard-base-content/40" />
                        <div>
                            {href ? (
                                <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm font-medium text-dashboard-primary hover:underline line-clamp-1 max-w-44 block"
                                >
                                    {b.package?.title ?? "—"}
                                </a>
                            ) : (
                                <p className="text-sm text-dashboard-base-content line-clamp-1 max-w-44">
                                    {b.package?.title ?? "—"}
                                </p>
                            )}
                            <p className="text-xs text-dashboard-base-content/55">
                                {b.destination?.name ?? ""}
                            </p>
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Travel Dates",
            width: "w-[140px]",
            sortKey: (b) => b.startDate ? new Date(b.startDate).getTime() : 0,
            cell: (b) => {
                const nights = b.startDate && b.endDate ? differenceInCalendarDays(new Date(b.endDate), new Date(b.startDate)) : null;
                return (
                    <div className="space-y-1.5">
                        <div>
                            <p className="text-[10px] font-medium text-dashboard-base-content/50 uppercase tracking-wide leading-none mb-0.5">Arrival</p>
                            <p className="text-xs text-dashboard-base-content whitespace-nowrap">{fmtDate(b.startDate)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-medium text-dashboard-base-content/50 uppercase tracking-wide leading-none mb-0.5">Departure</p>
                            <p className="text-xs text-dashboard-base-content whitespace-nowrap">{fmtDate(b.endDate)}</p>
                        </div>
                        {nights !== null && nights > 0 && (
                            <p className="text-[11px] text-dashboard-base-content/40">{nights} night{nights > 1 ? "s" : ""}</p>
                        )}
                    </div>
                );
            },
        },
        {
            header: "Pax",
            align: "center",
            width: "w-[70px]",
            sortKey: (b) => b.travellers ?? 0,
            cell: (b) => (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-dashboard-base-content">
                    <Users size={13} className="text-dashboard-base-content/40" />
                    {b.travellers}
                </span>
            ),
        },
        {
            header: "Amount",
            align: "right",
            sortKey: (b) => b.totalAmount_paise ?? 0,
            cell: (b) => (
                <div className="text-right">
                    <p className="text-sm font-medium text-dashboard-base-content whitespace-nowrap">
                        {formatPaiseRoundedUp(b.totalAmount_paise)}
                    </p>
                    {b.paymentPlan === "DEPOSIT" && (
                        <p className="text-xs text-dashboard-base-content/55">Deposit plan</p>
                    )}
                </div>
            ),
        },
        {
            header: "Payment",
            sortKey: (b) => b.paymentStatus?.toLowerCase() ?? "",
            cell: (b) => <PaymentPill status={b.paymentStatus} />,
        },
        {
            header: "Status",
            sortKey: (b) => b.status?.toLowerCase() ?? "",
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
                    search={search}
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
